import fs from 'fs/promises'
import path from 'path'

export interface SkillNode {
  id: string
  name: string
  description: string
  x: number
  y: number
  cost: number
  reqs: string[]
}

export interface SkillConnection {
  from: string
  to: string
}

export interface SkillTree {
  id: string
  name: string
  nodes: SkillNode[]
  connections: SkillConnection[]
}

export const builtinDefaultSkillTree: SkillTree = {
  id: 'destruction_magic',
  name: '破壊魔法 (Destruction Magic)',
  nodes: [
    {
      id: 'novice',
      x: 500,
      y: 520,
      name: '素人',
      description: '破壊魔法の基礎を学ぶ初歩の心得。',
      cost: 0,
      reqs: [],
    },
    {
      id: 'apprentice',
      x: 420,
      y: 420,
      name: '見習い',
      description: '魔力の扱いに慣れ、より効率的に詠唱できる段階。',
      cost: 0,
      reqs: ['novice'],
    },
    {
      id: 'dual_cast',
      x: 600,
      y: 450,
      name: '二連の唱え',
      description: '破壊魔法を二連続で詠唱し威力を高める技術。',
      cost: 0,
      reqs: ['novice'],
    },
    {
      id: 'adept',
      x: 350,
      y: 340,
      name: '精鋭',
      description: '中級の破壊魔法を自在に操る熟練の域。',
      cost: 0,
      reqs: ['apprentice'],
    },
    {
      id: 'impact',
      x: 650,
      y: 360,
      name: '衝撃',
      description: '魔法に衝撃を付与し敵をひるませる技。',
      cost: 0,
      reqs: ['dual_cast'],
    },
    {
      id: 'expert',
      x: 500,
      y: 300,
      name: '熟練者',
      description: '破壊魔法の高度な技術を極めた達人。',
      cost: 0,
      reqs: ['adept', 'impact'],
    },
  ],
  connections: [
    { from: 'novice', to: 'apprentice' },
    { from: 'novice', to: 'dual_cast' },
    { from: 'apprentice', to: 'adept' },
    { from: 'dual_cast', to: 'impact' },
    { from: 'adept', to: 'expert' },
    { from: 'impact', to: 'expert' },
  ],
}

/**
 * 処理名: 数値変換
 *
 * 処理概要: 与えられた値を数値へ変換し、失敗時はフォールバックを返す。
 *
 * 実装理由: 型が揺らぐ入力に対して安全に数値を得るため。
 * @param value 任意値
 * @param fallback フォールバック値
 * @returns 数値
 */
const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

// eslint-disable-next-line jsdoc/require-jsdoc
const toReqs = (rawReqs: unknown): string[] =>
  Array.isArray(rawReqs)
    ? Array.from(new Set(rawReqs.filter((req): req is string => typeof req === 'string')))
    : []

// eslint-disable-next-line jsdoc/require-jsdoc
const toSanitizedNode = (node: unknown): SkillNode | null => {
  if (!node || typeof (node as SkillNode).id !== 'string') return null

  const id = (node as SkillNode).id
  const description = typeof (node as SkillNode).description === 'string' ? (node as SkillNode).description.trim() : ''

  return {
    id,
    name:
      typeof (node as SkillNode).name === 'string' && (node as SkillNode).name.trim().length > 0
        ? (node as SkillNode).name.trim()
        : id,
    description,
    x: toNumber((node as SkillNode).x, 0),
    y: toNumber((node as SkillNode).y, 0),
    cost: Math.max(0, toNumber((node as SkillNode).cost, 0)),
    reqs: toReqs((node as SkillNode).reqs),
  }
}

/**
 * 処理名: JSON配列パース
 *
 * 処理概要: 文字列または配列入力を安全に配列へ変換し、不正な場合はフォールバックを返す。
 *
 * 実装理由: 永続化データが破損してもAPI全体を止めないため。
 * @param raw 入力値
 * @param fallback フォールバック配列
 * @returns パース結果配列
 */
export const parseJsonArray = <T>(raw: unknown, fallback: T[]): T[] => {
  try {
    const parsed = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw
    return Array.isArray(parsed) ? (parsed as T[]) : fallback
  } catch (error) {
    console.error('JSON配列の解析に失敗したため既定値を利用します', error)
    return fallback
  }
}

/**
 * 処理名: アンロックスキルパース
 *
 * 処理概要: アンロックID配列を安全に抽出し、不正時は空配列を返す。
 *
 * 実装理由: 進行状況読み込み時の堅牢性を確保するため。
 * @param raw 入力値
 * @returns アンロックID配列
 */
export const parseUnlocked = (raw: unknown): string[] => {
  try {
    const parsed = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch (error) {
    console.error('アンロックスキルIDの解析に失敗したため空配列に初期化しました', error)
    return []
  }
}

/**
 * 処理名: ノード正規化
 *
 * 処理概要: ノード配列を検証し、欠損・重複・型不正を取り除いて正規化する。
 *
 * 実装理由: API内部で扱うノード構造の整合性を保つため。
 * @param rawNodes ノード入力
 * @returns 正規化済みノード配列
 */
export const sanitizeNodes = (rawNodes: unknown): SkillNode[] => {
  if (!Array.isArray(rawNodes)) return []

  const seen = new Set<string>()
  const result: SkillNode[] = []

  for (const node of rawNodes) {
    const sanitized = toSanitizedNode(node)
    if (!sanitized) continue
    if (seen.has(sanitized.id)) continue
    seen.add(sanitized.id)
    result.push(sanitized)
  }

  return result
}

// eslint-disable-next-line jsdoc/require-jsdoc
const collectExplicitConnections = (rawConnections: unknown): SkillConnection[] => {
  if (!Array.isArray(rawConnections)) return []

  // eslint-disable-next-line jsdoc/require-jsdoc
  const isConnectionLike = (connection: unknown): connection is { from?: unknown; to?: unknown } =>
    typeof connection === 'object' && connection !== null

  return rawConnections
    .filter(isConnectionLike)
    .map(({ from, to }) => ({
      from: typeof from === 'string' ? from : '',
      to: typeof to === 'string' ? to : '',
    }))
    .filter(({ from, to }) => Boolean(from && to))
}

// eslint-disable-next-line jsdoc/require-jsdoc
const collectReqConnections = (nodes: SkillNode[]): SkillConnection[] =>
  nodes.flatMap((node) => node.reqs.map((req) => ({ from: req, to: node.id })))

// eslint-disable-next-line jsdoc/require-jsdoc
const isValidConnection = (
  connection: SkillConnection,
  nodeIds: Set<string>,
  seen: Set<string>,
): boolean => {
  const { from, to } = connection
  if (!from || !to || from === to) return false
  if (!nodeIds.has(from) || !nodeIds.has(to)) return false
  const key = `${from}->${to}`
  if (seen.has(key)) return false
  seen.add(key)
  return true
}

/**
 * 処理名: 接続正規化
 *
 * 処理概要: 明示接続と依存関係をマージし、自己参照や無効ノードを除去する。
 *
 * 実装理由: グラフ整合性を維持し、描画や保存で矛盾を出さないため。
 * @param rawConnections 接続入力
 * @param nodes ノード配列
 * @returns 正規化済み接続配列
 */
export const sanitizeConnections = (
  rawConnections: unknown,
  nodes: SkillNode[],
): SkillConnection[] => {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const seen = new Set<string>()
  const result: SkillConnection[] = []

  const candidates = [
    ...collectExplicitConnections(rawConnections),
    ...collectReqConnections(nodes),
  ]

  candidates.forEach((connection) => {
    if (isValidConnection(connection, nodeIds, seen)) {
      result.push({ from: connection.from, to: connection.to })
    }
  })

  return result
}

/**
 * 処理名: スキルツリーペイロード正規化
 *
 * 処理概要: 任意のスキルツリーデータを既定値と突き合わせ、ID・名称・ノード・接続を整形する。
 *
 * 実装理由: API境界で常に安全なデータ形状を保証するため。
 * @param payload 入力ペイロード
 * @param fallback フォールバックするスキルツリー
 * @returns 正規化済みスキルツリー
 */
export const normalizeSkillTreePayload = (
  payload: Partial<SkillTree> | undefined,
  fallback: SkillTree = builtinDefaultSkillTree,
): SkillTree => {
  const base = fallback ?? builtinDefaultSkillTree
  const nodes = sanitizeNodes(payload?.nodes ?? base.nodes)
  const connections = sanitizeConnections(payload?.connections ?? base.connections, nodes)

  return {
    id: typeof payload?.id === 'string' && payload.id.trim().length > 0 ? payload.id.trim() : base.id,
    name: typeof payload?.name === 'string' && payload.name.trim().length > 0 ? payload.name.trim() : base.name,
    nodes,
    connections,
  }
}

/**
 * 処理名: 既定スキルツリー読み込み
 *
 * 処理概要: 指定パスのJSONを読み込み正規化する。失敗時はフォールバックを返す。
 *
 * 実装理由: サーバー起動時に必須データを安全に初期化するため。
 * @param defaultSkillTreePath デフォルトデータのパス
 * @param fallback フォールバックするスキルツリー
 * @returns 正規化済みスキルツリー
 */
export const loadDefaultSkillTree = async (
  defaultSkillTreePath: string,
  fallback: SkillTree = builtinDefaultSkillTree,
): Promise<SkillTree> => {
  try {
    const resolved = path.resolve(defaultSkillTreePath)
    const raw = await fs.readFile(resolved, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<SkillTree>
    return normalizeSkillTreePayload(parsed, fallback)
  } catch (error) {
    console.error('初期スキルツリーの読み込みに失敗したため組み込みの既定値を利用します', error)
    return fallback
  }
}
