/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param, jsdoc/require-returns */
import { DEFAULT_TREE_ID, DEFAULT_POINTS } from './skillTypes.ts'
import type { SwSkillNode, SwSkillTreeConnection, SwSkillTree, SwSkillStatus } from './skillTypes.ts'

export const isoNow = (): string => new Date().toISOString()

export const normalizeUpdatedAt = (value: unknown, fallback?: string): string => {
  if (typeof value === 'string') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }
  if (typeof fallback === 'string' && fallback.length > 0) {
    const fb = new Date(fallback)
    if (!Number.isNaN(fb.getTime())) return fb.toISOString()
    return fallback
  }
  return isoNow()
}

export const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((v) => typeof v === 'string')

const normalizeReqMode = (value: unknown): 'and' | 'or' => (value === 'or' ? 'or' : 'and')

export const normalizeVersion = (value: unknown, fallback = 1): number => {
  const num = Number(value)
  if (Number.isInteger(num) && num >= 1) return num
  if (Number.isInteger(fallback) && fallback >= 1) return fallback
  return 1
}

export const normalizeSourceEtag = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export const sanitizeTreeId = (value: unknown): string => (typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : DEFAULT_TREE_ID)

const extractAndNormalizeReqs = (reqsValue: unknown): string[] => {
  if (!Array.isArray(reqsValue)) return []
  return Array.from(new Set((reqsValue as unknown[]).filter((r): r is string => typeof r === 'string' && r.trim().length > 0).map((r) => r.trim())))
}

const normalizeName = (nodeObj: Record<string, unknown>, id: string): string => {
  if (typeof nodeObj.name === 'string' && nodeObj.name.trim().length > 0) return nodeObj.name.trim()
  return id
}

const normalizeNode = (node: unknown, seen: Set<string>): SwSkillNode | null => {
  if (!node || typeof node !== 'object') return null
  const obj = node as Record<string, unknown>
  if (typeof obj.id !== 'string') return null
  const id = obj.id.trim()
  if (!id || seen.has(id)) return null
  const reqs = extractAndNormalizeReqs(obj.reqs)
  const description = typeof obj.description === 'string' ? obj.description.trim() : ''
  seen.add(id)
  return {
    id,
    x: Number.isFinite(Number(obj.x)) ? Number(obj.x) : 0,
    y: Number.isFinite(Number(obj.y)) ? Number(obj.y) : 0,
    name: normalizeName(obj, id),
    cost: Math.max(0, Number.isFinite(Number(obj.cost)) ? Number(obj.cost) : 0),
    description,
    reqs,
    reqMode: normalizeReqMode(obj.reqMode),
  }
}

export const normalizeNodes = (rawNodes: unknown): SwSkillNode[] => {
  if (!Array.isArray(rawNodes)) return []
  const seen = new Set<string>()
  const results: SwSkillNode[] = []
  for (const node of rawNodes) {
    const normalized = normalizeNode(node, seen)
    if (normalized) results.push(normalized)
  }
  return results
}

const createConnectionKey = (from: string, to: string): string => `${from}->${to}`
const isValidConnectionPair = (from: string, to: string): boolean => !(!from || !to || from === to)

const validateConnection = (connection: unknown, nodeIds: Set<string>): [string, SwSkillTreeConnection] | null => {
  if (!connection || typeof connection !== 'object') return null
  const connObj = connection as Record<string, unknown>
  const from = typeof connObj.from === 'string' ? connObj.from : ''
  const to = typeof connObj.to === 'string' ? connObj.to : ''
  if (!isValidConnectionPair(from, to)) return null
  if (!nodeIds.has(from) || !nodeIds.has(to)) return null
  return [createConnectionKey(from, to), { from, to }]
}

export const normalizeConnections = (nodes: SwSkillNode[], rawConnections: unknown): SwSkillTreeConnection[] => {
  const nodeIds = new Set(nodes.map((n) => n.id))
  const merged: Array<{ from?: unknown; to?: unknown }> = Array.isArray(rawConnections) ? [...(rawConnections as Array<{ from?: unknown; to?: unknown }>)] : []

  nodes.forEach((node) => {
    const reqs = Array.isArray(node.reqs) ? node.reqs : []
    reqs.forEach((req) => merged.push({ from: req, to: node.id }))
  })

  const seen = new Set<string>()
  const connections: SwSkillTreeConnection[] = []

  merged.forEach((connection) => {
    const result = validateConnection(connection, nodeIds)
    if (result) {
      const [key, conn] = result
      if (!seen.has(key)) {
        seen.add(key)
        connections.push(conn)
      }
    }
  })

  return connections
}

export const mergeByUpdatedAt = <T extends { updatedAt: string }>(incoming: T, existing: T | null): T => {
  if (!existing) return incoming
  const incomingTime = new Date(incoming.updatedAt).getTime()
  const existingTime = new Date(existing.updatedAt).getTime()
  return incomingTime >= existingTime ? incoming : existing
}

export const normalizeSkillTreePayload = (payload: Partial<SwSkillTree>, fallback?: SwSkillTree): SwSkillTree => {
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

export const normalizeStatusPayload = (treeId: unknown, payload: Partial<SwSkillStatus>): SwSkillStatus => {
  const safeTreeId = sanitizeTreeId(treeId)
  const availablePoints = typeof payload?.availablePoints === 'number' ? payload.availablePoints : DEFAULT_POINTS
  const unlockedSkillIds = Array.isArray(payload?.unlockedSkillIds)
    ? payload.unlockedSkillIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : []
  return {
    treeId: safeTreeId,
    availablePoints,
    unlockedSkillIds,
    updatedAt: normalizeUpdatedAt(payload?.updatedAt),
  }
}
