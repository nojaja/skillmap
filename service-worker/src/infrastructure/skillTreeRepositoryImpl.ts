/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param, jsdoc/require-returns */
import { readJsonFile, writeJsonFile } from './opfs/fileStore'
import { ensureDir, getRoot } from './opfs/opfsClient'
import { DEFAULT_TREE_ID } from '../domain/skillTypes'
import type { SwSkillTree, SwSkillStatus, SwSkillTreeSummary } from '../domain/skillTypes'
import { isoNow, normalizeUpdatedAt, normalizeVersion, normalizeSourceEtag, sanitizeTreeId, normalizeNodes, normalizeConnections, mergeByUpdatedAt } from '../domain/skillNormalizer'
import type { SkillTreeRepository } from '../application/skillTreeRepository'
import { evictCache, listCache, setCache, upsertCache } from './cache/skillTreeCache'

const TREE_DIR = 'skill-trees'
const STATUS_DIR = 'statuses'

type RepositoryDeps = {
  getRoot: typeof getRoot
  ensureDir: typeof ensureDir
  setCache: typeof setCache
  listCache: typeof listCache
  upsertCache: typeof upsertCache
  evictCache: typeof evictCache
}

const defaultDeps: RepositoryDeps = {
  getRoot,
  ensureDir,
  setCache,
  listCache,
  upsertCache,
  evictCache,
}

export class SkillTreeRepositoryImpl implements SkillTreeRepository {
  private readonly deps: RepositoryDeps

  constructor(deps: RepositoryDeps = defaultDeps) {
    this.deps = deps
  }

  async getTree(treeId: string, fallback?: Partial<SwSkillTree>): Promise<SwSkillTree> {
    const safeFallback: SwSkillTree = {
      id: DEFAULT_TREE_ID,
      name: 'Skill Tree',
      nodes: [],
      connections: [],
      updatedAt: isoNow(),
      version: 1,
      sourceUrl: undefined,
      sourceEtag: undefined,
      ...fallback,
    }
    const stored = await readJsonFile<SwSkillTree | null>([TREE_DIR, `${treeId}.json`], null)
    if (!stored) {
      await writeJsonFile([TREE_DIR, `${treeId}.json`], safeFallback)
      return safeFallback
    }
    return this.normalizeTree(stored, safeFallback)
  }

  async saveTree(treeId: string, incoming: Partial<SwSkillTree>): Promise<SwSkillTree> {
    const normalizedIncoming = this.normalizeTree(incoming as SwSkillTree)
    const stored = await readJsonFile<SwSkillTree | null>([TREE_DIR, `${treeId}.json`], null)
    const merged = mergeByUpdatedAt(normalizedIncoming, stored ? this.normalizeTree(stored, normalizedIncoming) : null)
    await writeJsonFile([TREE_DIR, `${treeId}.json`], merged)
    this.deps.upsertCache({
      id: merged.id,
      name: merged.name,
      updatedAt: merged.updatedAt,
      nodeCount: Array.isArray(merged.nodes) ? merged.nodes.length : 0,
      sourceUrl: merged.sourceUrl,
    })
    return merged
  }

  async exportTree(treeId: string, fallback?: Partial<SwSkillTree>): Promise<SwSkillTree> {
    const safeFallback: SwSkillTree = { id: treeId, name: 'Skill Tree', nodes: [], connections: [], updatedAt: isoNow(), version: 1, ...fallback }
    const stored = await readJsonFile<SwSkillTree | null>([TREE_DIR, `${treeId}.json`], null)
    if (!stored) return safeFallback
    return this.normalizeTree(stored, safeFallback)
  }

  async importTree(treeId: string, tree: Partial<SwSkillTree>): Promise<SwSkillTree> {
    const normalized = this.normalizeTree(tree as SwSkillTree)
    await writeJsonFile([TREE_DIR, `${treeId}.json`], normalized)
    return normalized
  }

  async deleteTree(treeId: string): Promise<{ ok: boolean }> {
    try {
      const root = await this.deps.getRoot()
      const treeDir = await this.deps.ensureDir(root, [TREE_DIR])
      const statusDir = await this.deps.ensureDir(root, [STATUS_DIR])
      await treeDir.removeEntry(`${treeId}.json`, { recursive: false })
      await statusDir.removeEntry(`${treeId}.json`, { recursive: false })
    } catch (error) {
      const name = (error as Record<string, unknown>).name
      if (name !== 'NotFoundError') {
        console.error('deleteTree failed', error)
      }
    }
    this.deps.evictCache(treeId)
    return { ok: true }
  }

  async listTrees(): Promise<SwSkillTreeSummary[]> {
    try {
      const root = await this.deps.getRoot()
      const dir = await this.deps.ensureDir(root, [TREE_DIR])
      const items: SwSkillTreeSummary[] = []
      const dirWithEntries = dir as FileSystemDirectoryHandle & { entries(): AsyncIterable<[string, FileSystemHandle]> }

      for await (const [name, handle] of dirWithEntries.entries()) {
        const handleKind = (handle as unknown as Record<string, unknown>).kind
        if (handleKind !== 'file' || !name.endsWith('.json')) continue
        try {
          const file = await (handle as FileSystemFileHandle).getFile()
          const content = await file.text()
          const parsed = JSON.parse(content) as Partial<SwSkillTree>
          const normalized = this.normalizeTree(parsed as SwSkillTree)
          items.push({
            id: normalized.id,
            name: normalized.name,
            updatedAt: normalized.updatedAt,
            nodeCount: Array.isArray(normalized.nodes) ? normalized.nodes.length : 0,
            sourceUrl: normalized.sourceUrl,
          })
        } catch (error) {
          console.error('listTrees parse failed', name, error)
        }
      }

      const sorted = items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      this.deps.setCache(sorted)
      return sorted
    } catch (error) {
      console.error('listTrees failed', error)
      const cached = this.deps.listCache()
      return cached
    }
  }

  async getStatus(treeId: string, fallback?: Partial<SwSkillStatus>): Promise<SwSkillStatus> {
    const stored = await readJsonFile<SwSkillStatus | null>([STATUS_DIR, `${treeId}.json`], null)
    if (!stored) {
      const safeFallbackPoints = typeof fallback?.availablePoints === 'number' ? fallback.availablePoints : 3
      const safe: SwSkillStatus = {
        treeId: sanitizeTreeId(treeId),
        availablePoints: safeFallbackPoints,
        unlockedSkillIds: Array.isArray(fallback?.unlockedSkillIds)
          ? fallback.unlockedSkillIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          : [],
        updatedAt: normalizeUpdatedAt(fallback?.updatedAt),
      }
      await writeJsonFile([STATUS_DIR, `${treeId}.json`], safe)
      return safe
    }
    return {
      treeId: sanitizeTreeId(treeId),
      availablePoints: typeof stored?.availablePoints === 'number' ? stored.availablePoints : 3,
      unlockedSkillIds: Array.isArray(stored?.unlockedSkillIds)
        ? stored.unlockedSkillIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        : [],
      updatedAt: normalizeUpdatedAt(stored?.updatedAt),
    }
  }

  async saveStatus(treeId: string, incoming: Partial<SwSkillStatus>): Promise<SwSkillStatus> {
    const safeIncoming: SwSkillStatus = {
      treeId: sanitizeTreeId(treeId),
      availablePoints: typeof incoming.availablePoints === 'number' ? incoming.availablePoints : 3,
      unlockedSkillIds: Array.isArray(incoming.unlockedSkillIds)
        ? incoming.unlockedSkillIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        : [],
      updatedAt: normalizeUpdatedAt(incoming.updatedAt),
    }
    const stored = await readJsonFile<SwSkillStatus | null>([STATUS_DIR, `${treeId}.json`], null)
    const merged = mergeByUpdatedAt(safeIncoming, stored ? {
      treeId: sanitizeTreeId(treeId),
      availablePoints: typeof stored?.availablePoints === 'number' ? stored.availablePoints : 3,
      unlockedSkillIds: Array.isArray(stored?.unlockedSkillIds)
        ? stored.unlockedSkillIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        : [],
      updatedAt: normalizeUpdatedAt(stored?.updatedAt),
    } : null)
    await writeJsonFile([STATUS_DIR, `${treeId}.json`], merged)
    return merged
  }

  private normalizeTree(payload: Partial<SwSkillTree>, fallback?: SwSkillTree): SwSkillTree {
    const safeFallback: SwSkillTree = fallback ?? {
      id: DEFAULT_TREE_ID,
      name: 'Skill Tree',
      nodes: [],
      connections: [],
      updatedAt: isoNow(),
      version: 1,
      sourceUrl: undefined,
      sourceEtag: undefined,
    }
    const nodes = normalizeNodes((payload?.nodes ?? safeFallback.nodes) ?? [])
    const connections = normalizeConnections(nodes, (payload?.connections ?? safeFallback.connections) ?? [])
    return {
      id: typeof payload?.id === 'string' && payload.id.trim().length > 0 ? payload.id.trim() : safeFallback.id,
      name: typeof payload?.name === 'string' && payload.name.trim().length > 0 ? payload.name.trim() : safeFallback.name,
      nodes,
      connections,
      updatedAt: normalizeUpdatedAt(payload?.updatedAt, safeFallback.updatedAt),
      version: normalizeVersion(payload?.version, safeFallback.version),
      sourceEtag: normalizeSourceEtag(payload?.sourceEtag) ?? safeFallback.sourceEtag,
      sourceUrl: typeof payload?.sourceUrl === 'string' && payload.sourceUrl.trim().length > 0 ? payload.sourceUrl.trim() : safeFallback.sourceUrl,
    }
  }
}
