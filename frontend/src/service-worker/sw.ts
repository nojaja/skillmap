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
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- Command union with string for extensibility

type SkillmapRequestPayload = {
  fallback?: unknown
  tree?: unknown
  status?: unknown
}

type SkillmapRequest = {
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- Allow extensibility with unknown command types
  type?: SkillmapCommand | string
  treeId?: unknown
  payload?: SkillmapRequestPayload
  requestId?: unknown
}

type NavigatorWithOPFS = Navigator & {
  storage?: StorageManager & { getDirectory?: () => Promise<FileSystemDirectoryHandle> }
}

/** Service Worker グローバルスコープ。ブラウザ環境でのみ定義される */
const swScope: ServiceWorkerGlobalScope | null = typeof self !== 'undefined' ? (self as unknown as ServiceWorkerGlobalScope) : null
const broadcastChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null

/**
 * 現在時刻をISO 8601形式で取得します。
 * @returns ISO形式の現在時刻文字列
 */
export const isoNow = (): string => new Date().toISOString()

/**
 * 更新日時を正規化します。無効な値はフォールバック値を使用します。
 * @param value - 正規化する値
 * @param fallback - フォールバック値
 * @returns 正規化された更新日時
 */
export const normalizeUpdatedAt = (
  /** 正規化する値 */ value: unknown,
  /** フォールバック値 */ fallback?: string,
): string => {
  if (typeof value === 'string') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }
  if (typeof fallback === 'string' && fallback.length > 0) return fallback
  return isoNow()
}

/**
 * 値が文字列配列かどうかを判定します。
 * @param value - 判定する値
 * @returns 文字列配列の場合true
 */
export const isStringArray = (
  /** 判定する値 */ value: unknown,
): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string')

/**
 * リクエストモードを正規化します。
 * @param value - リクエストモード
 * @returns 正規化されたリクエストモード
 */
const normalizeReqMode = (
  /** リクエストモード */ value: unknown,
): ReqMode => (value === 'or' ? 'or' : 'and')

/**
 * バージョン番号を正規化します。
 * @param value - バージョン値
 * @param fallback - フォールバック値
 * @returns 正規化されたバージョン番号
 */
export const normalizeVersion = (
  /** バージョン値 */ value: unknown,
  /** フォールバック値 */ fallback = 1,
): number => {
  const num = Number(value)
  if (Number.isInteger(num) && num >= 1) return num
  if (Number.isInteger(fallback) && fallback >= 1) return fallback
  return 1
}

/**
 * ソースEtagを正規化します。無効な値はundefinedを返します。
 * @param value - Etag値
 * @returns 正規化されたEtag または undefined
 */
export const normalizeSourceEtag = (
  /** Etag値 */ value: unknown,
): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * ツリーIDを安全な値に変換します。
 * @param value - ツリーID
 * @returns 正規化されたツリーID
 */
export const sanitizeTreeId = (
  /** ツリーID */ value: unknown,
): string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : DEFAULT_TREE_ID

/**
 * ノードから依存IDを抽出して正規化します。
 * @param reqsValue - 依存IDの値
 * @returns 正規化された依存IDの配列
 */
const extractAndNormalizeReqs = (
  /** 依存IDの値 */ reqsValue: unknown,
): string[] => {
  if (!Array.isArray(reqsValue)) return []
  return Array.from(
    new Set(
      (reqsValue as unknown[])
        .filter((req): req is string => typeof req === 'string' && req.trim().length > 0)
        .map((req) => req.trim()),
    ),
  )
}

/**
 * ノード名を正規化します。
 * @param nodeObj - ノードオブジェクト
 * @param id - デフォルトで使用するID
 * @returns 正規化された名称
 */
const normalizeName = (nodeObj: Record<string, unknown>, id: string): string => {
  if (typeof nodeObj.name === 'string' && nodeObj.name.trim().length > 0) {
    return nodeObj.name.trim()
  }
  return id
}

/**
 * ノードオブジェクトを正規化して返します。
 * @param node - ノードオブジェクト
 * @param seen - 処理済みIDのSet
 * @returns 正規化されたノード
 */
const normalizeNode = (
  /** ノードオブジェクト */ node: unknown,
  /** 処理済みIDのSet */ seen: Set<string>,
): SkillNode | null => {
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

/**
 * スキルノードの配列を正規化します。不正なデータは除去し、ID重複も排除されます。
 * @param rawNodes - 正規化前のノード配列
 * @returns 正規化されたスキルノード配列
 */
export const normalizeNodes = (
  /** 正規化前のノード配列 */ rawNodes: unknown,
): SkillNode[] => {
  if (!Array.isArray(rawNodes)) return []

  const seen = new Set<string>()
  const results: SkillNode[] = []
  for (const node of rawNodes) {
    const normalized = normalizeNode(node, seen)
    if (normalized) results.push(normalized)
  }
  return results
}

/**
 * 接続の方向を文字列キーに変換します。
 * @param from - From ノードID
 * @param to - To ノードID
 * @returns 接続キー
 */
const createConnectionKey = (
  /** From ノードID */ from: string,
  /** To ノードID */ to: string,
): string => `${from}->${to}`

/**
 * 接続が有効かどうかをチェックします。
 * @param from - From ノードID
 * @param to - To ノードID
 * @returns 有効な場合true
 */
const isValidConnectionPair = (
  /** From ノードID */ from: string,
  /** To ノードID */ to: string,
): boolean => !(!from || !to || from === to)

/**
 * 接続の有効性を検証します。
 * @param connection - 検証する接続
 * @param nodeIds - 有効なノードIDのSet
 * @returns 有効な接続の場合は接続キーと接続を返す、無効な場合はnull
 */
const validateConnection = (
  /** 検証する接続 */ connection: unknown,
  /** 有効なノードIDのSet */ nodeIds: Set<string>,
): [string, SkillTreeConnection] | null => {
  if (!connection || typeof connection !== 'object') return null
  const connObj = connection as Record<string, unknown>
  const from = typeof connObj.from === 'string' ? connObj.from : ''
  const to = typeof connObj.to === 'string' ? connObj.to : ''

  if (!isValidConnectionPair(from, to)) return null
  if (!nodeIds.has(from) || !nodeIds.has(to)) return null

  return [createConnectionKey(from, to), { from, to }]
}

/**
 * スキルツリーの接続を正規化します。依存関係を統合し、自己参照や存在しないノードを除外します。
 * @param nodes - 正規化されたスキルノード配列
 * @param rawConnections - 正規化前の接続配列
 * @returns 正規化されたスキルツリー接続配列
 */
export const normalizeConnections = (
  /** 正規化されたスキルノード配列 */ nodes: SkillNode[],
  /** 正規化前の接続配列 */ rawConnections: unknown,
): SkillTreeConnection[] => {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const merged: Array<{ from?: unknown; to?: unknown }> = Array.isArray(rawConnections)
    ? [...(rawConnections as Array<{ from?: unknown; to?: unknown }>)]
    : []

  nodes.forEach((node) => {
    const reqs = Array.isArray(node.reqs) ? node.reqs : []
    reqs.forEach((req) => merged.push({ from: req, to: node.id }))
  })

  const seen = new Set<string>()
  const connections: SkillTreeConnection[] = []

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

/**
 * スキルツリーペイロードを正規化します。
 * @param payload - スキルツリーペイロード
 * @param fallback - フォールバック値
 * @returns 正規化されたスキルツリー
 */
export const normalizeSkillTreePayload = (
  /** スキルツリーペイロード */ payload: SkillTreePayload,
  /** フォールバック値 */ fallback?: NormalizedSkillTree,
): NormalizedSkillTree => {
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

/**
 * ステータスペイロードを正規化します。
 * @param treeId - ツリーID
 * @param payload - ステータスペイロード
 * @returns 正規化されたスキルステータス
 */
export const normalizeStatusPayload = (
  /** ツリーID */ treeId: unknown,
  /** ステータスペイロード */ payload: StatusPayload,
): SkillStatus => {
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

/**
 * 2つのオブジェクトを更新日時でマージします。より新しい方を優先します。
 * @param incoming - 新しいデータ
 * @param existing - 既存データ
 * @returns より新しい方のデータ
 */
export const mergeByUpdatedAt = <T extends { updatedAt: string }>(
  /** 新しいデータ */ incoming: T,
  /** 既存データ */ existing: T | null,
): T => {
  if (!existing) return incoming
  const incomingTime = new Date(incoming.updatedAt).getTime()
  const existingTime = new Date(existing.updatedAt).getTime()
  return incomingTime >= existingTime ? incoming : existing
}

/**
 * OPFS ルートディレクトリを取得します。
 * @param scope - Service Worker スコープ
 * @returns ファイルシステムディレクトリハンドル
 */
const getRoot = async (
  /** Service Worker スコープ */ scope: ServiceWorkerGlobalScope | null = swScope,
): Promise<FileSystemDirectoryHandle> => {
  if (!scope) throw new Error('Service Worker scope is not available')
  const storage = (scope.navigator as NavigatorWithOPFS).storage
  if (!storage?.getDirectory) {
    throw new Error('OPFS がサポートされていません')
  }
  return storage.getDirectory()
}

/**
 * デフォルトスキルツリーが存在しない場合は作成します。
 * @returns void
 */
const ensureDefaultTree = async (): Promise<void> => {
  const fallback = normalizeSkillTreePayload({ id: DEFAULT_TREE_ID })
  const existing = await readSkillTreeFile(DEFAULT_TREE_ID, null)
  if (!existing) {
    await writeSkillTreeFile(DEFAULT_TREE_ID, fallback)
  }
}

let cachedSkillTrees: SkillTreeSummary[] = []

/**
 * スキルツリーキャッシュをディスクから更新します。
 * @returns void
 */
const refreshSkillTreeCacheFromDisk = async (): Promise<void> => {
  try {
    cachedSkillTrees = await listSkillTreeFiles()
  } catch (error) {
    console.error('スキルツリーキャッシュの更新に失敗しました', error)
    cachedSkillTrees = []
  }
}

/**
 * ディレクトリエントリを安全に削除します。エラーは無視されます。
 * @param dirHandle - ディレクトリハンドル
 * @param name - 削除するエントリ名
 */
const safeRemoveEntry = async (
  /** ディレクトリハンドル */ dirHandle: FileSystemDirectoryHandle,
  /** 削除するエントリ名 */ name: string,
): Promise<void> => {
  try {
    const handle = await dirHandle.getFileHandle(name, { create: false })
    if (handle) {
      await dirHandle.removeEntry(name)
    }
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- Error handling
    if ((error as Record<string, unknown>).name === 'NotFoundError') return
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Error handling
    console.warn('removeEntry skipped', name, (error as Record<string, unknown>).message)
  }
}

/**
 * ディレクトリパスを確保します。存在しない場合は作成します。
 * @param root - ルートディレクトリハンドル
 * @param parts - ディレクトリパスの配列
 * @returns 確保されたディレクトリハンドル
 */
const ensureDir = async (
  /** ルートディレクトリハンドル */ root: FileSystemDirectoryHandle,
  /** ディレクトリパスの配列 */ parts: string[],
): Promise<FileSystemDirectoryHandle> => {
  let dir = root
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: true })
  }
  return dir
}

/**
 * JSON ファイルを読み込みます。
 * @param pathParts - ファイルパス（ディレクトリ部分とファイル名）
 * @param fallback - 読み込み失敗時のフォールバック値
 * @returns 読み込んだデータまたはフォールバック
 */
const readJsonFile = async <T>(
  /** ファイルパス */ pathParts: string[],
  /** フォールバック値 */ fallback: T,
): Promise<T> => {
  try {
    const root = await getRoot()
    const filename = pathParts[pathParts.length - 1]
    const dirParts = pathParts.slice(0, -1)
    const dir = dirParts.length > 0 ? await ensureDir(root, dirParts) : root
    // filename is guaranteed to be a string from pathParts
    const fileHandle = await dir.getFileHandle(filename ?? '', { create: false })
    const file = await fileHandle.getFile()
    const content = await file.text()
    return JSON.parse(content) as T
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Error handling
    if ((error as Record<string, unknown>).name !== 'NotFoundError') {
      console.error('OPFS read failed', error)
    }
    return fallback
  }
}

/**
 * JSON ファイルを書き込みます。
 * @param pathParts - ファイルパス（ディレクトリ部分とファイル名）
 * @param data - 書き込むデータ
 */
const writeJsonFile = async (
  /** ファイルパス */ pathParts: string[],
  /** 書き込むデータ */ data: unknown,
): Promise<void> => {
  const root = await getRoot()
  const filename = pathParts[pathParts.length - 1]
  const dirParts = pathParts.slice(0, -1)
  const dir = dirParts.length > 0 ? await ensureDir(root, dirParts) : root
  // filename is guaranteed to be a string from pathParts
  const fileHandle = await dir.getFileHandle(filename ?? '', { create: true })
  const writable = await fileHandle.createWritable()
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- JSON.stringify always returns string
  await writable.write(JSON.stringify(data))
  await writable.close()
}

/**
 * スキルツリーファイルを読み込みます。
 * @param treeId - ツリーID
 * @param fallback - フォールバック値
 * @returns スキルツリーまたはnull
 */
const readSkillTreeFile = async (
  /** ツリーID */ treeId: string,
  /** フォールバック値 */ fallback: NormalizedSkillTree | null,
): Promise<NormalizedSkillTree | null> => readJsonFile<NormalizedSkillTree | null>([TREE_DIR, `${treeId}.json`], fallback)

/**
 * スキルツリーファイルを書き込みます。
 * @param treeId - ツリーID
 * @param data - 書き込むデータ
 * @returns void
 */
const writeSkillTreeFile = async (
  /** ツリーID */ treeId: string,
  /** 書き込むデータ */ data: NormalizedSkillTree,
): Promise<void> => writeJsonFile([TREE_DIR, `${treeId}.json`], data)

/**
 * ステータスファイルを読み込みます。
 * @param treeId - ツリーID
 * @param fallback - フォールバック値
 * @returns ステータスまたはnull
 */
const readStatusFile = async (
  /** ツリーID */ treeId: string,
  /** フォールバック値 */ fallback: SkillStatus | null,
): Promise<SkillStatus | null> => readJsonFile<SkillStatus | null>([STATUS_DIR, `${treeId}.json`], fallback)

/**
 * ステータスファイルを書き込みます。
 * @param treeId - ツリーID
 * @param data - 書き込むデータ
 * @returns void
 */
const writeStatusFile = async (
  /** ツリーID */ treeId: string,
  /** 書き込むデータ */ data: SkillStatus,
): Promise<void> => writeJsonFile([STATUS_DIR, `${treeId}.json`], data)

/**
 * 保存されたスキルツリーファイルの一覧を取得します。
 * @returns スキルツリーサマリーの配列
 */
const listSkillTreeFiles = async (): Promise<SkillTreeSummary[]> => {
  const root = await getRoot()
  const dir = await ensureDir(root, [TREE_DIR])
  const items: SkillTreeSummary[] = []

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- dir.entries() is async iterable with entries method not in typings
  const dirWithEntries = dir as FileSystemDirectoryHandle & {
    entries(): AsyncIterable<[string, FileSystemHandle]>
  }
  for await (const [name, handle] of dirWithEntries.entries()) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment -- Check handle type dynamically
    const handleKind = (handle as unknown as Record<string, unknown>).kind
    if (handleKind !== 'file' || !name.endsWith('.json')) continue

    try {
      const file = await (handle as FileSystemFileHandle).getFile()
      const content = await file.text()
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Parsed JSON
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

/**
 * スキルツリーを取得します。
 * @param treeId - ツリーID
 * @param payload - リクエストペイロード
 * @returns 正規化されたスキルツリー
 */
const handleGetSkillTree = async (
  /** ツリーID */ treeId: string,
  /** リクエストペイロード */ payload: SkillmapRequestPayload,
): Promise<NormalizedSkillTree> => {
  const fallback = normalizeSkillTreePayload((payload?.fallback as SkillTreePayload) ?? {})
  const stored = await readSkillTreeFile(treeId, null)
  if (!stored) {
    await writeSkillTreeFile(treeId, fallback)
    return fallback
  }
  return normalizeSkillTreePayload(stored, fallback)
}

/**
 * スキルツリーを保存します。
 * @param treeId - ツリーID
 * @param payload - リクエストペイロード
 * @returns 正規化されたスキルツリー
 */
const handleSaveSkillTree = async (
  /** ツリーID */ treeId: string,
  /** リクエストペイロード */ payload: SkillmapRequestPayload,
): Promise<NormalizedSkillTree> => {
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

/**
 * ステータスを取得します。
 * @param treeId - ツリーID
 * @param payload - リクエストペイロード
 * @returns スキルステータス
 */
const handleGetStatus = async (
  /** ツリーID */ treeId: string,
  /** リクエストペイロード */ payload: SkillmapRequestPayload,
): Promise<SkillStatus> => {
  const fallback = normalizeStatusPayload(treeId, (payload?.fallback as StatusPayload) ?? {})
  const stored = await readStatusFile(treeId, null)
  if (!stored) {
    await writeStatusFile(treeId, fallback)
    return fallback
  }
  return normalizeStatusPayload(treeId, stored)
}

/**
 * ステータスを保存します。
 * @param treeId - ツリーID
 * @param payload - リクエストペイロード
 * @returns スキルステータス
 */
const handleSaveStatus = async (
  /** ツリーID */ treeId: string,
  /** リクエストペイロード */ payload: SkillmapRequestPayload,
): Promise<SkillStatus> => {
  const incoming = normalizeStatusPayload(treeId, (payload?.status as StatusPayload) ?? {})
  const stored = await readStatusFile(treeId, null)
  const merged = mergeByUpdatedAt(incoming, stored ? normalizeStatusPayload(treeId, stored) : null)
  await writeStatusFile(treeId, merged)
  if (broadcastChannel) {
    broadcastChannel.postMessage({ event: 'status-updated', treeId, updatedAt: merged.updatedAt })
  }
  return merged
}

/**
 * スキルツリーをエクスポートします。
 * @param treeId - ツリーID
 * @param payload - リクエストペイロード
 * @returns 正規化されたスキルツリー
 */
const handleExportSkillTree = async (
  /** ツリーID */ treeId: string,
  /** リクエストペイロード */ payload: SkillmapRequestPayload,
): Promise<NormalizedSkillTree> => {
  const fallback = normalizeSkillTreePayload((payload?.fallback as SkillTreePayload) ?? {})
  const stored = await readSkillTreeFile(treeId, null)
  if (!stored) return fallback
  return normalizeSkillTreePayload(stored, fallback)
}

/**
 * スキルツリーをインポートします。
 * @param treeId - ツリーID
 * @param payload - リクエストペイロード
 * @returns 正規化されたスキルツリー
 */
const handleImportSkillTree = async (
  /** ツリーID */ treeId: string,
  /** リクエストペイロード */ payload: SkillmapRequestPayload,
): Promise<NormalizedSkillTree> => {
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

/**
 * スキルツリーを削除します。
 * @param treeId - ツリーID
 * @returns 成功フラグ
 */
const handleDeleteSkillTree = async (
  /** ツリーID */ treeId: string,
): Promise<{ ok: boolean }> => {
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

/* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
// Handler interface requires unused params
/**
 * スキルツリーの一覧を取得します。
 * @param _unusedTreeId - ツリーID（未使用、ハンドラインターフェース遵守のため必須）
 * @param _unusedPayload - リクエストペイロード（未使用、ハンドラインターフェース遵守のため必須）
 * @returns スキルツリーサマリーの配列
 */
const handleListSkillTrees = async (
  _unusedTreeId: string,
  _unusedPayload: SkillmapRequestPayload,
): Promise<SkillTreeSummary[]> => {
  if (!cachedSkillTrees || cachedSkillTrees.length === 0) {
    await refreshSkillTreeCacheFromDisk()
  }
  return cachedSkillTrees
}
/* eslint-enable no-unused-vars, @typescript-eslint/no-unused-vars */

// eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -- Function type parameters are unused in type context
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
  /**
   * Install イベントハンドラ
   */
  swScope.addEventListener('install', (event) => {
    event.waitUntil(swScope.skipWaiting())
  })

  /**
   * Activate イベントハンドラ
   */
  swScope.addEventListener('activate', (event) => {
    event.waitUntil(
      Promise.resolve()
        .then(() => ensureDefaultTree())
        .then(() => refreshSkillTreeCacheFromDisk())
        .then(() => swScope.clients.claim()),
    )
  })

  /**
   * リクエストメッセージを処理してレスポンスを返します。
   * @param request - リクエストオブジェクト
   * @param request.type - コマンドタイプ
   * @param request.treeId - スキルツリーID
   * @param request.payload - リクエストペイロード
   * @param request.requestId - リクエストID
   * @param reply - レスポンス送信関数
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Handler interface requires treeId and payload
  const processRequest = (
    /** リクエスト */ request: {
      type: string | undefined
      treeId: string
      payload: SkillmapRequestPayload
      requestId: string | undefined
    },
    // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars -- message param is part of callback signature only
    /** レスポンス送信関数 */ reply: (message: unknown) => void,
  ): void => {
    const { type, treeId, payload, requestId } = request
    const handler = handlers[type as SkillmapCommand]

    if (!handler || !requestId || typeof requestId !== 'string') {
      reply({ ok: false, error: '不正なリクエストです', requestId: requestId ?? 'unknown' })
      return
    }

    Promise.resolve()
      .then(() => handler(treeId, payload ?? {}))
      .then((data) => reply({ ok: true, data, requestId }))
      .catch((error: unknown) => {
        console.error('Service Worker 内でエラーが発生しました', error)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- Error object type check
        const errorMessage = (error as Record<string, unknown>).message ?? '処理に失敗しました'
        reply({ ok: false, error: errorMessage, requestId })
      })
  }

  /**
   * Message イベントハンドラ
   * @param event - Message event
   */
  swScope.addEventListener('message', (event: ExtendableMessageEvent): void => {
    const { type, treeId: rawTreeId, payload, requestId } = (event.data ?? {}) as SkillmapRequest
    const targetTreeId = sanitizeTreeId(
      rawTreeId ??
        (payload?.tree as { id?: unknown } | undefined)?.id ??
        (payload?.fallback as { id?: unknown } | undefined)?.id,
    )
    const responder = event.ports?.[0] ?? event.source

    /* eslint-disable no-unused-vars, @typescript-eslint/no-unused-vars */
    /**
     * リクエスト結果をクライアントに返信します。
     * @param message - 返信メッセージ
     */
    const reply = (message: unknown): void => {
      if ((responder as MessagePort | ServiceWorker | Client | null | undefined)?.postMessage) {
        (responder as MessagePort | ServiceWorker | Client).postMessage(message)
      }
    }
    /* eslint-enable no-unused-vars, @typescript-eslint/no-unused-vars */

    event.waitUntil(
      Promise.resolve().then(() => {
        processRequest(
          {
            type,
            treeId: targetTreeId,
            payload: payload ?? {},
            requestId: requestId as string | undefined,
          },
          reply,
        )
      }),
    )
  })
}