/// <reference lib="WebWorker" />

const CHANNEL_NAME = 'skillmap-sync'
const TREE_DIR = 'skill-trees'
const STATUS_DIR = 'statuses'
export const DEFAULT_POINTS = 3
export const DEFAULT_TREE_ID = 'default-skill-tree'

type ReqMode = 'and' | 'or'

type SkillNode = {
  id: string
  x: number
  y: number
  name: string
  cost: number
  description: string
  reqs: string[]
  reqMode: ReqMode
}

type SkillTreeConnection = {
  from: string
  to: string
}

type SkillTreePayload = {
  id?: unknown
  name?: unknown
  nodes?: unknown
  connections?: unknown
  updatedAt?: unknown
  version?: unknown
  sourceUrl?: unknown
  sourceEtag?: unknown
}

type NormalizedSkillTree = {
  id: string
  name: string
  nodes: SkillNode[]
  connections: SkillTreeConnection[]
  updatedAt: string
  version: number
  sourceUrl?: string
  sourceEtag?: string
}

type StatusPayload = {
  availablePoints?: unknown
  unlockedSkillIds?: unknown
  updatedAt?: unknown
}

type SkillStatus = {
  treeId: string
  availablePoints: number
  unlockedSkillIds: string[]
  updatedAt: string
}

type SkillTreeSummary = {
  id: string
  name: string
  updatedAt: string
  nodeCount: number
  sourceUrl?: string
}

type SkillmapCommand =
  | 'get-status'
  | 'save-status'
  | 'get-skill-tree'
  | 'save-skill-tree'
  | 'export'
  | 'import'
  | 'delete-skill-tree'
  | 'list-skill-trees'

type SkillmapRequestPayload = {
  fallback?: unknown
  tree?: unknown
  status?: unknown
}

type SkillmapRequest = {
  type?: SkillmapCommand | string
  treeId?: unknown
  payload?: SkillmapRequestPayload
  requestId?: unknown
}

type NavigatorWithOPFS = Navigator & {
  storage?: StorageManager & { getDirectory?: () => Promise<FileSystemDirectoryHandle> }
}

const swScope: ServiceWorkerGlobalScope | null = typeof self !== 'undefined' ? (self as ServiceWorkerGlobalScope) : null
const broadcastChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null

export const isoNow = (): string => new Date().toISOString()

export const normalizeUpdatedAt = (value: unknown, fallback?: string): string => {
  if (typeof value === 'string') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }
  if (typeof fallback === 'string' && fallback.length > 0) return fallback
  return isoNow()
}

export const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

const normalizeReqMode = (value: unknown): ReqMode => (value === 'or' ? 'or' : 'and')

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

export const sanitizeTreeId = (value: unknown): string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : DEFAULT_TREE_ID

export const normalizeNodes = (rawNodes: unknown): SkillNode[] => {
  if (!Array.isArray(rawNodes)) return []

  const seen = new Set<string>()
  return rawNodes.flatMap((node) => {
    if (!node || typeof node !== 'object' || typeof (node as { id?: unknown }).id !== 'string') return []

    const id = (node as { id: string }).id.trim()
    if (!id || seen.has(id)) return []

    const reqs = Array.isArray((node as { reqs?: unknown }).reqs)
      ? Array.from(
          new Set(
            ((node as { reqs?: unknown[] }).reqs ?? [])
              .filter((req) => typeof req === 'string' && req.trim().length > 0)
              .map((req) => req.trim()),
          ),
        )
      : []

    const description = typeof (node as { description?: unknown }).description === 'string'
      ? (node as { description?: string }).description?.trim() ?? ''
      : ''

    seen.add(id)
    return [
      {
        id,
        x: Number.isFinite(Number((node as { x?: unknown }).x)) ? Number((node as { x?: unknown }).x) : 0,
        y: Number.isFinite(Number((node as { y?: unknown }).y)) ? Number((node as { y?: unknown }).y) : 0,
        name:
          typeof (node as { name?: unknown }).name === 'string' && (node as { name?: string }).name?.trim().length
            ? (node as { name?: string }).name?.trim() ?? id
            : id,
        cost: Math.max(0, Number.isFinite(Number((node as { cost?: unknown }).cost)) ? Number((node as { cost?: unknown }).cost) : 0),
        description,
        reqs,
        reqMode: normalizeReqMode((node as { reqMode?: unknown }).reqMode),
      },
    ]
  })
}

export const normalizeConnections = (nodes: SkillNode[], rawConnections: unknown): SkillTreeConnection[] => {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const merged: Array<{ from?: unknown; to?: unknown }> = Array.isArray(rawConnections) ? [...rawConnections] : []

  nodes.forEach((node) => {
    const reqs = Array.isArray(node.reqs) ? node.reqs : []
    reqs.forEach((req) => merged.push({ from: req, to: node.id }))
  })

  const seen = new Set<string>()
  const connections: SkillTreeConnection[] = []

  merged.forEach((connection) => {
    if (!connection || typeof connection !== 'object') return
    const from = typeof connection.from === 'string' ? connection.from : ''
    const to = typeof connection.to === 'string' ? connection.to : ''
    const key = `${from}->${to}`

    if (!from || !to || from === to) return
    if (!nodeIds.has(from) || !nodeIds.has(to)) return
    if (seen.has(key)) return

    seen.add(key)
    connections.push({ from, to })
  })

  return connections
}

export const normalizeSkillTreePayload = (payload: SkillTreePayload, fallback?: NormalizedSkillTree): NormalizedSkillTree => {
  const safeFallback: NormalizedSkillTree =
    fallback ??
    ({
      id: DEFAULT_TREE_ID,
      name: 'Skill Tree',
      nodes: [],
      connections: [],
      updatedAt: isoNow(),
      version: 1,
      sourceUrl: undefined,
      sourceEtag: undefined,
    } satisfies NormalizedSkillTree)

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
    sourceUrl:
      typeof payload?.sourceUrl === 'string' && payload.sourceUrl.trim().length > 0
        ? payload.sourceUrl.trim()
        : safeFallback.sourceUrl,
  }
}

export const normalizeStatusPayload = (treeId: unknown, payload: StatusPayload): SkillStatus => {
  const safeTreeId = sanitizeTreeId(treeId)
  const availablePoints = typeof payload?.availablePoints === 'number' ? payload.availablePoints : DEFAULT_POINTS
  const unlockedSkillIds = isStringArray(payload?.unlockedSkillIds)
    ? payload.unlockedSkillIds.filter((id) => id.trim().length > 0)
    : []

  return {
    treeId: safeTreeId,
    availablePoints,
    unlockedSkillIds,
    updatedAt: normalizeUpdatedAt(payload?.updatedAt),
  }
}

export const mergeByUpdatedAt = <T extends { updatedAt: string }>(incoming: T, existing: T | null): T => {
  if (!existing) return incoming
  const incomingTime = new Date(incoming.updatedAt).getTime()
  const existingTime = new Date(existing.updatedAt).getTime()
  return incomingTime >= existingTime ? incoming : existing
}

const getRoot = async (scope: ServiceWorkerGlobalScope | null = swScope): Promise<FileSystemDirectoryHandle> => {
  if (!scope) throw new Error('Service Worker scope is not available')
  const storage = (scope.navigator as NavigatorWithOPFS).storage
  if (!storage?.getDirectory) {
    throw new Error('OPFS がサポートされていません')
  }
  return storage.getDirectory()
}

const ensureDefaultTree = async (): Promise<void> => {
  const fallback = normalizeSkillTreePayload({ id: DEFAULT_TREE_ID })
  const existing = await readSkillTreeFile(DEFAULT_TREE_ID, null)
  if (!existing) {
    await writeSkillTreeFile(DEFAULT_TREE_ID, fallback)
  }
}

let cachedSkillTrees: SkillTreeSummary[] = []

const refreshSkillTreeCacheFromDisk = async (): Promise<void> => {
  try {
    cachedSkillTrees = await listSkillTreeFiles()
  } catch (error) {
    console.error('スキルツリーキャッシュの更新に失敗しました', error)
    cachedSkillTrees = []
  }
}

const safeRemoveEntry = async (dirHandle: FileSystemDirectoryHandle, name: string): Promise<void> => {
  try {
    const handle = await dirHandle.getFileHandle(name, { create: false })
    if (handle) {
      await dirHandle.removeEntry(name)
    }
  } catch (error) {
    if ((error as { name?: string } | undefined)?.name === 'NotFoundError') return
    console.warn('removeEntry skipped', name, (error as { message?: string } | undefined)?.message)
  }
}

const ensureDir = async (root: FileSystemDirectoryHandle, parts: string[]): Promise<FileSystemDirectoryHandle> => {
  let dir = root
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: true })
  }
  return dir
}

const readJsonFile = async <T>(pathParts: string[], fallback: T): Promise<T> => {
  try {
    const root = await getRoot()
    const filename = pathParts[pathParts.length - 1]
    const dirParts = pathParts.slice(0, -1)
    const dir = dirParts.length > 0 ? await ensureDir(root, dirParts) : root
    const fileHandle = await dir.getFileHandle(filename, { create: false })
    const file = await fileHandle.getFile()
    const content = await file.text()
    return JSON.parse(content) as T
  } catch (error) {
    if ((error as { name?: string } | undefined)?.name !== 'NotFoundError') {
      console.error('OPFS read failed', error)
    }
    return fallback
  }
}

const writeJsonFile = async (pathParts: string[], data: unknown): Promise<void> => {
  const root = await getRoot()
  const filename = pathParts[pathParts.length - 1]
  const dirParts = pathParts.slice(0, -1)
  const dir = dirParts.length > 0 ? await ensureDir(root, dirParts) : root
  const fileHandle = await dir.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(JSON.stringify(data))
  await writable.close()
}

const readSkillTreeFile = async (treeId: string, fallback: NormalizedSkillTree | null): Promise<NormalizedSkillTree | null> =>
  readJsonFile<NormalizedSkillTree | null>([TREE_DIR, `${treeId}.json`], fallback)

const writeSkillTreeFile = async (treeId: string, data: NormalizedSkillTree): Promise<void> =>
  writeJsonFile([TREE_DIR, `${treeId}.json`], data)

const readStatusFile = async (treeId: string, fallback: SkillStatus | null): Promise<SkillStatus | null> =>
  readJsonFile<SkillStatus | null>([STATUS_DIR, `${treeId}.json`], fallback)

const writeStatusFile = async (treeId: string, data: SkillStatus): Promise<void> => writeJsonFile([STATUS_DIR, `${treeId}.json`], data)

const listSkillTreeFiles = async (): Promise<SkillTreeSummary[]> => {
  const root = await getRoot()
  const dir = await ensureDir(root, [TREE_DIR])
  const items: SkillTreeSummary[] = []

  for await (const [name, handle] of dir.entries()) {
    if ((handle as { kind?: string }).kind !== 'file' || !name.endsWith('.json')) continue

    try {
      const file = await (handle as FileSystemFileHandle).getFile()
      const content = await file.text()
      const parsed = JSON.parse(content) as SkillTreePayload
      const normalized = normalizeSkillTreePayload(parsed)
      items.push({
        id: normalized.id,
        name: normalized.name,
        updatedAt: normalized.updatedAt,
        nodeCount: Array.isArray(normalized.nodes) ? normalized.nodes.length : 0,
        sourceUrl: normalized.sourceUrl,
      })
    } catch (error) {
      console.error('ツリーファイルの読み込みに失敗しました', name, error)
    }
  }

  return items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

const handleGetSkillTree = async (treeId: string, payload: SkillmapRequestPayload): Promise<NormalizedSkillTree> => {
  const fallback = normalizeSkillTreePayload((payload?.fallback as SkillTreePayload) ?? {})
  const stored = await readSkillTreeFile(treeId, null)
  if (!stored) {
    await writeSkillTreeFile(treeId, fallback)
    return fallback
  }
  return normalizeSkillTreePayload(stored, fallback)
}

const handleSaveSkillTree = async (treeId: string, payload: SkillmapRequestPayload): Promise<NormalizedSkillTree> => {
  const incoming = normalizeSkillTreePayload((payload?.tree as SkillTreePayload) ?? {})
  const stored = await readSkillTreeFile(treeId, null)
  const merged = mergeByUpdatedAt(incoming, stored ? normalizeSkillTreePayload(stored, incoming) : null)
  await writeSkillTreeFile(treeId, merged)
  cachedSkillTrees = [
    ...cachedSkillTrees.filter((item) => item.id !== merged.id),
    {
      id: merged.id,
      name: merged.name,
      updatedAt: merged.updatedAt,
      nodeCount: Array.isArray(merged.nodes) ? merged.nodes.length : 0,
      sourceUrl: merged.sourceUrl,
    },
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  if (broadcastChannel) {
    broadcastChannel.postMessage({ event: 'skill-tree-updated', treeId, updatedAt: merged.updatedAt })
  }
  return merged
}

const handleGetStatus = async (treeId: string, payload: SkillmapRequestPayload): Promise<SkillStatus> => {
  const fallback = normalizeStatusPayload(treeId, (payload?.fallback as StatusPayload) ?? {})
  const stored = await readStatusFile(treeId, null)
  if (!stored) {
    await writeStatusFile(treeId, fallback)
    return fallback
  }
  return normalizeStatusPayload(treeId, stored)
}

const handleSaveStatus = async (treeId: string, payload: SkillmapRequestPayload): Promise<SkillStatus> => {
  const incoming = normalizeStatusPayload(treeId, (payload?.status as StatusPayload) ?? {})
  const stored = await readStatusFile(treeId, null)
  const merged = mergeByUpdatedAt(incoming, stored ? normalizeStatusPayload(treeId, stored) : null)
  await writeStatusFile(treeId, merged)
  if (broadcastChannel) {
    broadcastChannel.postMessage({ event: 'status-updated', treeId, updatedAt: merged.updatedAt })
  }
  return merged
}

const handleExportSkillTree = async (treeId: string, payload: SkillmapRequestPayload): Promise<NormalizedSkillTree> => {
  const fallback = normalizeSkillTreePayload((payload?.fallback as SkillTreePayload) ?? {})
  const stored = await readSkillTreeFile(treeId, null)
  if (!stored) return fallback
  return normalizeSkillTreePayload(stored, fallback)
}

const handleImportSkillTree = async (treeId: string, payload: SkillmapRequestPayload): Promise<NormalizedSkillTree> => {
  const normalized = normalizeSkillTreePayload((payload?.tree as SkillTreePayload) ?? {})
  await writeSkillTreeFile(treeId, normalized)
  cachedSkillTrees = [
    ...cachedSkillTrees.filter((item) => item.id !== normalized.id),
    {
      id: normalized.id,
      name: normalized.name,
      updatedAt: normalized.updatedAt,
      nodeCount: Array.isArray(normalized.nodes) ? normalized.nodes.length : 0,
      sourceUrl: normalized.sourceUrl,
    },
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  if (broadcastChannel) {
    broadcastChannel.postMessage({ event: 'skill-tree-updated', treeId, updatedAt: normalized.updatedAt })
  }
  return normalized
}

const handleDeleteSkillTree = async (treeId: string): Promise<{ ok: boolean }> => {
  const root = await getRoot()
  const treeDir = await ensureDir(root, [TREE_DIR])
  const statusDir = await ensureDir(root, [STATUS_DIR])
  await safeRemoveEntry(treeDir, `${treeId}.json`)
  await safeRemoveEntry(statusDir, `${treeId}.json`)

  cachedSkillTrees = cachedSkillTrees.filter((item) => item.id !== treeId)

  if (broadcastChannel) {
    broadcastChannel.postMessage({ event: 'skill-tree-updated', treeId, updatedAt: isoNow() })
  }

  return { ok: true }
}

const handleListSkillTrees = async (): Promise<SkillTreeSummary[]> => {
  if (!cachedSkillTrees || cachedSkillTrees.length === 0) {
    await refreshSkillTreeCacheFromDisk()
  }
  return cachedSkillTrees
}

const handlers: Record<SkillmapCommand, (treeId: string, payload: SkillmapRequestPayload) => Promise<unknown>> = {
  'get-status': handleGetStatus,
  'save-status': handleSaveStatus,
  'get-skill-tree': handleGetSkillTree,
  'save-skill-tree': handleSaveSkillTree,
  export: handleExportSkillTree,
  import: handleImportSkillTree,
  'delete-skill-tree': handleDeleteSkillTree,
  'list-skill-trees': handleListSkillTrees,
}

if (swScope) {
  swScope.addEventListener('install', (event) => {
    event.waitUntil(swScope.skipWaiting())
  })

  swScope.addEventListener('activate', (event) => {
    event.waitUntil(
      Promise.resolve()
        .then(() => ensureDefaultTree())
        .then(() => refreshSkillTreeCacheFromDisk())
        .then(() => swScope.clients.claim()),
    )
  })

  swScope.addEventListener('message', (event: ExtendableMessageEvent) => {
    const { type, treeId: rawTreeId, payload, requestId } = (event.data ?? {}) as SkillmapRequest
    const targetTreeId = sanitizeTreeId(
      rawTreeId ??
        (payload?.tree as { id?: unknown } | undefined)?.id ??
        (payload?.fallback as { id?: unknown } | undefined)?.id,
    )
    const responder = event.ports?.[0] ?? event.source

    const reply = (message: unknown) => {
      if ((responder as MessagePort | ServiceWorker | Client | null | undefined)?.postMessage) {
        ;(responder as MessagePort | ServiceWorker | Client).postMessage(message)
      }
    }

    const handler = handlers[type as SkillmapCommand]
    if (!handler || !requestId || typeof requestId !== 'string') {
      reply({ ok: false, error: '不正なリクエストです', requestId: (requestId as string | undefined) ?? 'unknown' })
      return
    }

    event.waitUntil(
      Promise.resolve()
        .then(() => handler(targetTreeId, payload ?? {}))
        .then((data) => reply({ ok: true, data, requestId }))
        .catch((error: unknown) => {
          console.error('Service Worker 内でエラーが発生しました', error)
          reply({ ok: false, error: (error as { message?: string } | undefined)?.message ?? '処理に失敗しました', requestId })
        }),
    )
  })
}