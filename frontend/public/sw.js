const CHANNEL_NAME = 'skillmap-sync'
const TREE_DIR = 'skill-trees'
const STATUS_DIR = 'statuses'
const DEFAULT_POINTS = 3
const DEFAULT_TREE_ID = 'default-skill-tree'
let cachedSkillTrees = []

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.resolve()
      .then(() => ensureDefaultTree())
      .then(() => refreshSkillTreeCacheFromDisk())
      .then(() => self.clients.claim()),
  )
})

const broadcastChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null

const isoNow = () => new Date().toISOString()

const normalizeUpdatedAt = (value, fallback) => {
  if (typeof value === 'string') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }
  if (typeof fallback === 'string' && fallback.length > 0) return fallback
  return isoNow()
}

const isStringArray = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string')

const normalizeReqMode = (value) => (value === 'or' ? 'or' : 'and')

const normalizeVersion = (value, fallback = 1) => {
  const num = Number(value)
  if (Number.isInteger(num) && num >= 1) return num
  if (Number.isInteger(fallback) && fallback >= 1) return fallback
  return 1
}

const normalizeSourceEtag = (value) => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const sanitizeTreeId = (value) => (typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : DEFAULT_TREE_ID)

const normalizeNodes = (rawNodes) => {
  if (!Array.isArray(rawNodes)) return []

  const seen = new Set()
  return rawNodes.flatMap((node) => {
    if (!node || typeof node !== 'object' || typeof node.id !== 'string') return []

    const id = node.id.trim()
    if (!id || seen.has(id)) return []

    const reqs = Array.isArray(node.reqs)
      ? Array.from(new Set(node.reqs.filter((req) => typeof req === 'string' && req.trim().length > 0)))
      : []

    const description = typeof node.description === 'string' ? node.description.trim() : ''
    seen.add(id)
    return [
      {
        id,
        x: Number.isFinite(Number(node.x)) ? Number(node.x) : 0,
        y: Number.isFinite(Number(node.y)) ? Number(node.y) : 0,
        name: typeof node.name === 'string' && node.name.trim().length > 0 ? node.name.trim() : id,
        cost: Math.max(0, Number.isFinite(Number(node.cost)) ? Number(node.cost) : 0),
        description,
        reqs,
        reqMode: normalizeReqMode(node.reqMode),
      },
    ]
  })
}

const normalizeConnections = (nodes, rawConnections) => {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const merged = Array.isArray(rawConnections) ? [...rawConnections] : []

  nodes.forEach((node) => {
    const reqs = Array.isArray(node.reqs) ? node.reqs : []
    reqs.forEach((req) => merged.push({ from: req, to: node.id }))
  })

  const seen = new Set()
  const connections = []

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

const normalizeSkillTreePayload = (payload, fallback) => {
  const safeFallback = fallback ?? {
    id: 'default-skill-tree',
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
    sourceUrl:
      typeof payload?.sourceUrl === 'string' && payload.sourceUrl.trim().length > 0
        ? payload.sourceUrl.trim()
        : safeFallback.sourceUrl,
  }
}

const normalizeStatusPayload = (treeId, payload) => {
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

const mergeByUpdatedAt = (incoming, existing) => {
  if (!existing) return incoming
  const incomingTime = new Date(incoming.updatedAt).getTime()
  const existingTime = new Date(existing.updatedAt).getTime()
  return incomingTime >= existingTime ? incoming : existing
}

const getRoot = async () => self.navigator.storage.getDirectory()

const ensureDefaultTree = async () => {
  const fallback = normalizeSkillTreePayload({ id: DEFAULT_TREE_ID })
  const existing = await readSkillTreeFile(DEFAULT_TREE_ID, null)
  if (!existing) {
    await writeSkillTreeFile(DEFAULT_TREE_ID, fallback)
  }
}

const refreshSkillTreeCacheFromDisk = async () => {
  try {
    cachedSkillTrees = await listSkillTreeFiles()
  } catch (error) {
    console.error('スキルツリーキャッシュの更新に失敗しました', error)
    cachedSkillTrees = []
  }
}

const safeRemoveEntry = async (dirHandle, name) => {
  try {
    // 事前に存在確認を行い、NotFoundは静かにスキップする
    const handle = await dirHandle.getFileHandle(name, { create: false })
    if (handle) {
      await dirHandle.removeEntry(name)
    }
  } catch (error) {
    if (error?.name === 'NotFoundError') return
    console.warn('removeEntry skipped', name, error?.message)
  }
}

const ensureDir = async (root, parts) => {
  let dir = root
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: true })
  }
  return dir
}

const readJsonFile = async (pathParts, fallback) => {
  try {
    const root = await getRoot()
    const filename = pathParts[pathParts.length - 1]
    const dirParts = pathParts.slice(0, -1)
    const dir = dirParts.length > 0 ? await ensureDir(root, dirParts) : root
    const fileHandle = await dir.getFileHandle(filename, { create: false })
    const file = await fileHandle.getFile()
    const content = await file.text()
    return JSON.parse(content)
  } catch (error) {
    // NotFound は初期状態なのでエラー扱いしない
    if (error?.name !== 'NotFoundError') {
      console.error('OPFS read failed', error)
    }
    return fallback
  }
}

const writeJsonFile = async (pathParts, data) => {
  const root = await getRoot()
  const filename = pathParts[pathParts.length - 1]
  const dirParts = pathParts.slice(0, -1)
  const dir = dirParts.length > 0 ? await ensureDir(root, dirParts) : root
  const fileHandle = await dir.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()
  await writable.write(JSON.stringify(data))
  await writable.close()
}

const readSkillTreeFile = async (treeId, fallback) =>
  readJsonFile([TREE_DIR, `${treeId}.json`], fallback)

const writeSkillTreeFile = async (treeId, data) => writeJsonFile([TREE_DIR, `${treeId}.json`], data)

const readStatusFile = async (treeId, fallback) => readJsonFile([STATUS_DIR, `${treeId}.json`], fallback)

const writeStatusFile = async (treeId, data) => writeJsonFile([STATUS_DIR, `${treeId}.json`], data)

const listSkillTreeFiles = async () => {
  const root = await getRoot()
  const dir = await ensureDir(root, [TREE_DIR])
  const items = []

  for await (const [name, handle] of dir.entries()) {
    if (handle.kind !== 'file' || !name.endsWith('.json')) continue

    try {
      const file = await handle.getFile()
      const content = await file.text()
      const parsed = JSON.parse(content)
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

const handleGetSkillTree = async (treeId, payload) => {
  const fallback = normalizeSkillTreePayload(payload?.fallback)
  const stored = await readSkillTreeFile(treeId, null)
  if (!stored) {
    await writeSkillTreeFile(treeId, fallback)
    return fallback
  }
  return normalizeSkillTreePayload(stored, fallback)
}

const handleSaveSkillTree = async (treeId, payload) => {
  const incoming = normalizeSkillTreePayload(payload?.tree)
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

const handleGetStatus = async (treeId, payload) => {
  const fallback = normalizeStatusPayload(treeId, payload?.fallback)
  const stored = await readStatusFile(treeId, null)
  if (!stored) {
    await writeStatusFile(treeId, fallback)
    return fallback
  }
  return normalizeStatusPayload(treeId, stored)
}

const handleSaveStatus = async (treeId, payload) => {
  const incoming = normalizeStatusPayload(treeId, payload?.status)
  const stored = await readStatusFile(treeId, null)
  const merged = mergeByUpdatedAt(incoming, stored ? normalizeStatusPayload(treeId, stored) : null)
  await writeStatusFile(treeId, merged)
  if (broadcastChannel) {
    broadcastChannel.postMessage({ event: 'status-updated', treeId, updatedAt: merged.updatedAt })
  }
  return merged
}

const handleExportSkillTree = async (treeId, payload) => {
  const fallback = normalizeSkillTreePayload(payload?.fallback)
  const stored = await readSkillTreeFile(treeId, null)
  if (!stored) return fallback
  return normalizeSkillTreePayload(stored, fallback)
}

const handleImportSkillTree = async (treeId, payload) => {
  const normalized = normalizeSkillTreePayload(payload?.tree)
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

const handleDeleteSkillTree = async (treeId) => {
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

const handleListSkillTrees = async () => {
  if (!cachedSkillTrees || cachedSkillTrees.length === 0) {
    await refreshSkillTreeCacheFromDisk()
  }
  return cachedSkillTrees
}

const handlers = {
  'get-status': handleGetStatus,
  'save-status': handleSaveStatus,
  'get-skill-tree': handleGetSkillTree,
  'save-skill-tree': handleSaveSkillTree,
  export: handleExportSkillTree,
  import: handleImportSkillTree,
  'delete-skill-tree': handleDeleteSkillTree,
  'list-skill-trees': handleListSkillTrees,
}

self.addEventListener('message', (event) => {
  const { type, treeId: rawTreeId, payload, requestId } = event.data ?? {}
  const targetTreeId = sanitizeTreeId(rawTreeId ?? payload?.tree?.id ?? payload?.fallback?.id)
  const responder = event.ports?.[0] ?? event.source

  const reply = (message) => {
    if (responder?.postMessage) {
      responder.postMessage(message)
    }
  }

  const handler = handlers[type]
  if (!handler || !requestId) {
    reply({ ok: false, error: '不正なリクエストです', requestId: requestId ?? 'unknown' })
    return
  }

  event.waitUntil(
    Promise.resolve()
      .then(() => handler(targetTreeId, payload))
      .then((data) => reply({ ok: true, data, requestId }))
      .catch((error) => {
        console.error('Service Worker 内でエラーが発生しました', error)
        reply({ ok: false, error: error?.message ?? '処理に失敗しました', requestId })
      }),
  )
})
