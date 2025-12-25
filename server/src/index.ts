import cors from 'cors'
import express, { type Request, type Response } from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'

import {
  builtinDefaultSkillTree,
  loadDefaultSkillTree,
  normalizeSkillTreePayload,
  parseJsonArray,
  parseUnlocked,
  type SkillTree,
} from './skillTreeService.js'

const prisma = new PrismaClient()
const app = express()
const PORT = Number(process.env.PORT ?? 3000)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const defaultSkillTreePath = path.resolve(__dirname, '../data/default-skill-tree.json')

const defaultSkillTree: SkillTree = await loadDefaultSkillTree(defaultSkillTreePath, builtinDefaultSkillTree)

interface SkillStatusRecord {
  id: number
  availablePoints: number
  unlockedSkillIds: string
}

interface SkillTreeRecord {
  id: number
  treeId: string
  name: string
  nodes: string
  connections: string
}

/**
 * 処理名: ステータス取得または作成
 *
 * 処理概要: ステータスレコードを取得し、存在しない場合は初期値で新規作成して返却する。
 *
 * 実装理由: API呼び出しが常に有効なステータスを扱えるようにするため。
 */
/**
 * @returns ステータスレコード
 */
const getOrCreateStatus = async (): Promise<SkillStatusRecord> => {
  const existing = await prisma.skillStatus.findUnique({ where: { id: 1 } })
  if (existing) return existing as SkillStatusRecord

  return (await prisma.skillStatus.create({
    data: {
      id: 1,
    },
  })) as SkillStatusRecord
}

/**
 * 処理名: スキルツリー取得または作成
 *
 * 処理概要: スキルツリーレコードを取得し、無い場合は既定値で初期作成する。
 *
 * 実装理由: データ欠損時でもAPIが正常に応答できるようにするため。
 */
/**
 * @returns スキルツリーレコード
 */
const getOrCreateSkillTree = async (): Promise<SkillTreeRecord> => {
  const existing = await prisma.skillTree.findUnique({ where: { id: 1 } })
  if (existing) return existing as SkillTreeRecord

  return (await prisma.skillTree.create({
    data: {
      id: 1,
      treeId: defaultSkillTree.id,
      name: defaultSkillTree.name,
      nodes: JSON.stringify(defaultSkillTree.nodes),
      connections: JSON.stringify(defaultSkillTree.connections),
    },
  })) as SkillTreeRecord
}

/**
 * 処理名: 正規化済みスキルツリー取得
 *
 * 処理概要: DB上のスキルツリーを取得し、ノードと接続を正規化して返す。
 *
 * 実装理由: 永続化データの揺らぎを抑制し、APIレスポンスの一貫性を保つため。
 */
/**
 * @returns 正規化済みスキルツリー
 */
const fetchNormalizedSkillTree = async (): Promise<SkillTree> => {
  const record = await getOrCreateSkillTree()
  const nodes = parseJsonArray(record.nodes, defaultSkillTree.nodes)
  const connections = parseJsonArray(record.connections, defaultSkillTree.connections)

  return normalizeSkillTreePayload(
    {
      id: record.treeId,
      name: record.name,
      nodes,
      connections,
    },
    defaultSkillTree,
  )
}

/**
 * 処理名: スキルツリーレコード保存
 *
 * 処理概要: 正規化済みスキルツリーをUPSERTで永続化する。
 *
 * 実装理由: インポート/保存の両ケースで同一処理を再利用するため。
 */
/**
 * @param normalized 正規化済みスキルツリー
 * @returns 保存後レコード
 */
const saveSkillTreeRecord = async (normalized: SkillTree): Promise<SkillTreeRecord> => {
  return (await prisma.skillTree.upsert({
    where: { id: 1 },
    update: {
      treeId: normalized.id,
      name: normalized.name,
      nodes: JSON.stringify(normalized.nodes),
      connections: JSON.stringify(normalized.connections),
    },
    create: {
      id: 1,
      treeId: normalized.id,
      name: normalized.name,
      nodes: JSON.stringify(normalized.nodes),
      connections: JSON.stringify(normalized.connections),
    },
  })) as SkillTreeRecord
}

app.use(cors())
app.use(express.json())

/**
 * 処理名: ステータスAPI応答
 *
 * 処理概要: 現在の残ポイントとアンロックスキルを返却する。
 *
 * 実装理由: フロントエンドの状態同期に利用するため。
 */
/**
 * @param _req リクエスト
 * @param res レスポンス
 * @returns void
 */
const handleGetStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = await getOrCreateStatus()
    res.json({
      availablePoints: status.availablePoints,
      unlockedSkillIds: parseUnlocked(status.unlockedSkillIds),
    })
  } catch (error) {
    console.error('ステータス取得に失敗しました', error)
    res.status(500).json({ error: 'ステータスの取得に失敗しました' })
  }
}

/**
 * 処理名: ステータス保存API
 *
 * 処理概要: 受信したステータスを検証し、UPSERTで永続化する。
 *
 * 実装理由: 進捗保存を確実に行い、無効データを遮断するため。
 */
/**
 * @param req リクエスト
 * @param res レスポンス
 * @returns void
 */
const handleSaveStatus = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as { availablePoints?: unknown; unlockedSkillIds?: unknown }
  const availablePoints = body.availablePoints
  const unlockedSkillIds = body.unlockedSkillIds
  const isValidArray = Array.isArray(unlockedSkillIds) && unlockedSkillIds.every((id) => typeof id === 'string')

  if (typeof availablePoints !== 'number' || !isValidArray) {
    res.status(400).json({ error: 'リクエストペイロードが不正です' })
    return
  }

  try {
    const updated = (await prisma.skillStatus.upsert({
      where: { id: 1 },
      update: {
        availablePoints,
        unlockedSkillIds: JSON.stringify(unlockedSkillIds),
      },
      create: {
        id: 1,
        availablePoints,
        unlockedSkillIds: JSON.stringify(unlockedSkillIds),
      },
    })) as SkillStatusRecord

    res.json({
      availablePoints: updated.availablePoints,
      unlockedSkillIds: parseUnlocked(updated.unlockedSkillIds),
    })
  } catch (error) {
    console.error('ステータス保存に失敗しました', error)
    res.status(500).json({ error: 'ステータスの保存に失敗しました' })
  }
}

/**
 * 処理名: スキルツリー取得API
 *
 * 処理概要: 正規化したスキルツリーを返す。失敗時は既定値を返却。
 *
 * 実装理由: UI初期表示とリロード時に安定したレスポンスを提供するため。
 */
/**
 * @param _req リクエスト
 * @param res レスポンス
 * @returns void
 */
const handleGetSkillTree = async (_req: Request, res: Response): Promise<void> => {
  try {
    const normalized = await fetchNormalizedSkillTree()
    res.json(normalized)
  } catch (error) {
    console.error('スキルツリー取得に失敗しました', error)
    res.status(500).json(normalizeSkillTreePayload(defaultSkillTree, defaultSkillTree))
  }
}

/**
 * 処理名: スキルツリー保存API
 *
 * 処理概要: 受信データを正規化し、永続化後に結果を返す。
 *
 * 実装理由: 編集内容をサーバー側に安全に保存するため。
 */
/**
 * @param req リクエスト
 * @param res レスポンス
 * @returns void
 */
const handlePostSkillTree = async (req: Request, res: Response): Promise<void> => {
  const payload = (req.body ?? {}) as Partial<SkillTree>
  const normalized = normalizeSkillTreePayload(payload, defaultSkillTree)

  try {
    await saveSkillTreeRecord(normalized)
    res.json(normalized)
  } catch (error) {
    console.error('スキルツリー保存に失敗しました', error)
    res.status(500).json({ error: 'スキルツリーの保存に失敗しました' })
  }
}

/**
 * 処理名: スキルツリーエクスポートAPI
 *
 * 処理概要: 正規化済みデータをダウンロード可能なJSONとして返却する。
 *
 * 実装理由: バックアップや共有用途のためにエクスポートを提供するため。
 */
/**
 * @param _req リクエスト
 * @param res レスポンス
 * @returns void
 */
const handleExportSkillTree = async (_req: Request, res: Response): Promise<void> => {
  try {
    const normalized = await fetchNormalizedSkillTree()
    res.setHeader('Content-Disposition', 'attachment; filename=skill-tree.json')
    res.setHeader('Content-Type', 'application/json')
    res.json(normalized)
  } catch (error) {
    console.error('スキルツリーのエクスポートに失敗しました', error)
    res.status(500).json({ error: 'スキルツリーのエクスポートに失敗しました' })
  }
}

/**
 * 処理名: スキルツリーインポートAPI
 *
 * 処理概要: 受信データを正規化して保存し、その結果を返す。
 *
 * 実装理由: 外部JSONを安全に取り込み、整合性を維持するため。
 */
/**
 * @param req リクエスト
 * @param res レスポンス
 * @returns void
 */
const handleImportSkillTree = async (req: Request, res: Response): Promise<void> => {
  const payload = (req.body ?? {}) as Partial<SkillTree>
  const normalized = normalizeSkillTreePayload(payload, defaultSkillTree)

  try {
    await saveSkillTreeRecord(normalized)
    res.json(normalized)
  } catch (error) {
    console.error('スキルツリーのインポートに失敗しました', error)
    res.status(500).json({ error: 'スキルツリーのインポートに失敗しました' })
  }
}

/**
 * 処理名: サーバー起動ログ出力
 *
 * 処理概要: リスナー起動時にポート番号付きでログ出力する。
 *
 * 実装理由: 起動確認とポートトラブルシュートを容易にするため。
 */
const logStartup = () => {
  console.log(`SkillMap APIサーバーがポート${PORT}で待機中です`)
}

app.get('/api/status', handleGetStatus)
app.post('/api/save', handleSaveStatus)
app.get('/api/skill-tree', handleGetSkillTree)
app.post('/api/skill-tree', handlePostSkillTree)
app.get('/api/skill-tree/export', handleExportSkillTree)
app.post('/api/skill-tree/import', handleImportSkillTree)

app.listen(PORT, logStartup)
