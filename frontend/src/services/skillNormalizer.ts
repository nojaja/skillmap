import defaultSkillTreeJson from '../assets/default-skill-tree.json'
import {
  DEFAULT_AVAILABLE_POINTS,
  type SkillConnection,
  type SkillDraft,
  type SkillNode,
  type SkillStatus,
  type SkillTree,
} from '../types/skill'

/**
 * ISO文字列の現在時刻を返す。
 * @returns 現在時刻のISO文字列
 */
const isoNow = (): string => new Date().toISOString()

/**
 * 文字列配列かどうかを判定する。
 * @param value 判定対象
 * @returns 文字列配列ならtrue
 */
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

/**
 * updatedAtを正規化する。無効な値の場合はfallbackか現在時刻を返す。
 * @param value 正規化対象
 * @param fallback 代替値
 * @returns 正規化済みのISO文字列
 */
const normalizeUpdatedAt = (value?: unknown, fallback?: string): string => {
  if (typeof value === 'string') {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString()
    }
  }
  if (typeof fallback === 'string' && fallback.length > 0) return fallback
  return isoNow()
}

/**
 * reqsを安全に正規化する。
 * @param node 対象ノード
 * @returns 重複除去済みのreqs
 */
const normalizeReqs = (node: SkillNode): string[] => {
  if (!Array.isArray(node.reqs)) return []
  return Array.from(new Set(node.reqs.filter((req): req is string => typeof req === 'string' && req.trim().length > 0)))
}

/**
 * 数値入力を有限値に丸める。
 * @param value 入力値
 * @returns 有効な数値または0
 */
const toFiniteNumber = (value: unknown): number => (Number.isFinite(Number(value)) ? Number(value) : 0)

/**
 * 名称を正規化する。
 * @param name 候補名
 * @param fallback 代替名
 * @returns 正規化済み名称
 */
const normalizeName = (name: unknown, fallback: string): string =>
  typeof name === 'string' && name.trim().length > 0 ? name.trim() : fallback

/**
 * コストを0以上で正規化する。
 * @param value 値
 * @returns 0以上のコスト
 */
const normalizeCost = (value: unknown): number => Math.max(0, toFiniteNumber(value))

/**
 * 単一ノードを正規化する。無効な場合はnullを返す。
 * @param node 入力ノード
 * @param seen ID重複検知用セット
 * @returns 正規化済みノードまたはnull
 */
const sanitizeNode = (node: unknown, seen: Set<string>): SkillDraft | null => {
  if (!node || typeof node !== 'object') return null
  const typed = node as SkillNode
  const id = typeof typed.id === 'string' ? typed.id.trim() : ''
  if (!id || seen.has(id)) return null

  const description = typeof typed.description === 'string' ? typed.description.trim() : ''
  const reqs = normalizeReqs(typed)

  seen.add(id)

  return {
    id,
    x: toFiniteNumber(typed.x),
    y: toFiniteNumber(typed.y),
    name: normalizeName(typed.name, id),
    cost: normalizeCost(typed.cost),
    description,
    reqs,
  }
}

/**
 * ノード配列を正規化する。
 * @param rawNodes 入力ノード配列
 * @returns 正規化済みノード配列
 */
export const normalizeNodes = (rawNodes: unknown[]): SkillDraft[] => {
  if (!Array.isArray(rawNodes)) return []

  const seen = new Set<string>()
  return rawNodes.flatMap((node) => {
    const normalized = sanitizeNode(node, seen)
    return normalized ? [normalized] : []
  })
}

/**
 * 接続候補を生成する。ノードのreqsも統合する。
 * @param nodes ノード集合
 * @param rawConnections 元の接続配列
 * @returns 接続候補配列
 */
const buildConnectionCandidates = (nodes: SkillNode[], rawConnections: unknown[]): unknown[] => {
  const merged = Array.isArray(rawConnections) ? [...rawConnections] : []
  nodes.forEach((node) => {
    const reqs = Array.isArray(node.reqs) ? node.reqs : []
    reqs.forEach((req) => merged.push({ from: req, to: node.id }))
  })
  return merged
}

/**
 * 単一接続を正規化する。重複・無効はnullを返す。
 * @param connection 入力接続
 * @param nodeIds 有効ノードID集合
 * @param seen 重複検知用セット
 * @returns 正規化済み接続またはnull
 */
const sanitizeConnection = (
  connection: unknown,
  nodeIds: Set<string>,
  seen: Set<string>,
): SkillConnection | null => {
  if (!connection || typeof connection !== 'object') return null

  const from = typeof (connection as SkillConnection).from === 'string' ? (connection as SkillConnection).from : ''
  const to = typeof (connection as SkillConnection).to === 'string' ? (connection as SkillConnection).to : ''
  const key = `${from}->${to}`

  if (!from || !to || from === to) return null
  if (!nodeIds.has(from) || !nodeIds.has(to)) return null
  if (seen.has(key)) return null

  seen.add(key)
  return { from, to }
}

/**
 * 接続配列を正規化する。
 * @param nodes ノード集合
 * @param rawConnections 元の接続配列
 * @returns 正規化済み接続配列
 */
export const normalizeConnections = (
  nodes: SkillNode[],
  rawConnections: unknown[],
): SkillConnection[] => {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const merged = buildConnectionCandidates(nodes, rawConnections)
  const seen = new Set<string>()

  return merged.flatMap((connection) => {
    const normalized = sanitizeConnection(connection, nodeIds, seen)
    return normalized ? [normalized] : []
  })
}

const rawDefaultSkillTree = defaultSkillTreeJson as unknown

/**
 * デフォルトツリーをベースに安全なfallbackツリーを構築する。
 * @param payload 任意の初期データ
 * @returns 正規化済みfallbackツリー
 */
const buildFallbackSkillTree = (payload?: Partial<SkillTree>): SkillTree => {
  const nodes = normalizeNodes((payload?.nodes as unknown[]) ?? []) as SkillNode[]
  const connections = normalizeConnections(nodes, (payload?.connections as unknown[]) ?? [])

  return {
    id: typeof payload?.id === 'string' && payload.id.trim().length > 0 ? payload.id : 'default-skill-tree',
    name: typeof payload?.name === 'string' && payload.name.trim().length > 0 ? payload.name.trim() : 'Skill Tree',
    nodes,
    connections,
    updatedAt: normalizeUpdatedAt(payload?.updatedAt),
  }
}

const fallbackSkillTree = buildFallbackSkillTree(rawDefaultSkillTree as Partial<SkillTree>)

/**
 * 任意のツリーペイロードを正規化する。
 * @param payload 入力ツリー
 * @param fallback 不足時に利用するデフォルト
 * @returns 正規化済みツリー
 */
export const normalizeSkillTree = (payload?: Partial<SkillTree>, fallback: SkillTree = fallbackSkillTree): SkillTree => {
  const nodes = normalizeNodes((payload?.nodes as unknown[]) ?? fallback.nodes) as SkillNode[]
  const connections = normalizeConnections(nodes, (payload?.connections as unknown[]) ?? fallback.connections)

  return {
    id: typeof payload?.id === 'string' && payload.id.trim().length > 0 ? payload.id.trim() : fallback.id,
    name: typeof payload?.name === 'string' && payload.name.trim().length > 0 ? payload.name.trim() : fallback.name,
    nodes,
    connections,
    updatedAt: normalizeUpdatedAt(payload?.updatedAt, fallback.updatedAt),
  }
}

/**
 * ステータスを正規化する。
 * @param treeId 対象ツリーID
 * @param payload 入力ステータス
 * @returns 正規化済みステータス
 */
export const normalizeStatus = (treeId: string, payload?: Partial<SkillStatus>): SkillStatus => {
  const safeTreeId = typeof treeId === 'string' && treeId.trim().length > 0 ? treeId.trim() : 'default-skill-tree'

  const availablePoints = typeof payload?.availablePoints === 'number' ? payload.availablePoints : DEFAULT_AVAILABLE_POINTS
  const unlockedSkillIds = isStringArray(payload?.unlockedSkillIds)
    ? payload?.unlockedSkillIds.filter((id) => id.trim().length > 0)
    : []

  return {
    treeId: safeTreeId,
    availablePoints,
    unlockedSkillIds,
    updatedAt: normalizeUpdatedAt(payload?.updatedAt),
  }
}

export { fallbackSkillTree as defaultSkillTree }
