import axios from 'axios'
import { defineStore } from 'pinia'

import defaultSkillTreeJson from '../assets/default-skill-tree.json'

export const SKILL_POINT_SYSTEM_ENABLED = false

export interface SkillNode {
  id: string
  x: number
  y: number
  name: string
  cost: number
  description: string
  reqs?: string[]
}

export interface SkillDraft {
  id: string
  x: number
  y: number
  name: string
  cost: number
  description: string
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

const api = axios.create({
  baseURL: '/api',
})

const fallbackSkillTree = defaultSkillTreeJson as SkillTree

/**
 * 処理名: スキルノード正規化
 *
 * 処理概要: 任意の配列からスキルノードを抽出し、重複や不正値を除去したうえで座標・依存関係を正規化する。
 *
 * 実装理由: クライアント入力や外部データの揺らぎを吸収し、状態管理で扱える安全な構造を得るため。
 */
const normalizeNodes = (rawNodes: unknown[]): SkillDraft[] => {
  if (!Array.isArray(rawNodes)) return []

  const seen = new Set<string>()
  return rawNodes.flatMap((node) => {
    if (!node || typeof node !== 'object' || typeof (node as SkillNode).id !== 'string') return []

    const id = (node as SkillNode).id.trim()
    if (!id || seen.has(id)) return []

    const reqs = Array.isArray((node as SkillNode).reqs)
      ? Array.from(
          new Set(
            ((node as SkillNode).reqs as unknown[]).filter(
              (req): req is string => typeof req === 'string' && req.trim().length > 0,
            ),
          ),
        )
      : []

    const description =
      typeof (node as SkillNode).description === 'string'
        ? (node as SkillNode).description.trim()
        : ''

    seen.add(id)
    return [
      {
        id,
        x: Number.isFinite(Number((node as SkillNode).x)) ? Number((node as SkillNode).x) : 0,
        y: Number.isFinite(Number((node as SkillNode).y)) ? Number((node as SkillNode).y) : 0,
        name:
          typeof (node as SkillNode).name === 'string' && (node as SkillNode).name.trim().length > 0
            ? (node as SkillNode).name.trim()
            : id,
        cost: Math.max(0, Number.isFinite(Number((node as SkillNode).cost)) ? Number((node as SkillNode).cost) : 0),
        description,
        reqs,
      },
    ]
  })
}

/**
 * 処理名: スキル接続正規化
 *
 * 処理概要: ノード集合と接続配列を受け取り、自己参照・重複・存在しないノードへの接続を除去して正規化する。
 *
 * 実装理由: グラフ構造の一貫性を保ち、描画や保存時に不整合が起きないようにするため。
 */
const normalizeConnections = (
  nodes: SkillNode[],
  rawConnections: unknown[],
): SkillConnection[] => {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const merged = Array.isArray(rawConnections) ? [...rawConnections] : []

  nodes.forEach((node) => {
    const reqs = Array.isArray(node.reqs) ? node.reqs : []
    reqs.forEach((req) => merged.push({ from: req, to: node.id }))
  })

  const seen = new Set<string>()
  const connections: SkillConnection[] = []

  merged.forEach((connection) => {
    if (!connection || typeof connection !== 'object') return
    const from = typeof (connection as SkillConnection).from === 'string' ? (connection as SkillConnection).from : ''
    const to = typeof (connection as SkillConnection).to === 'string' ? (connection as SkillConnection).to : ''
    const key = `${from}->${to}`

    if (!from || !to || from === to) return
    if (!nodeIds.has(from) || !nodeIds.has(to)) return
    if (seen.has(key)) return

    seen.add(key)
    connections.push({ from, to })
  })

  return connections
}

/**
 * 処理名: スキルツリー正規化
 *
 * 処理概要: 任意のスキルツリーペイロードを既定値と突き合わせ、ID・名称・ノード・接続を安全に整形する。
 *
 * 実装理由: APIからのレスポンスやローカルファイル読込結果を常に同じ構造で扱うため。
 */
const normalizeSkillTree = (payload?: Partial<SkillTree>, fallback: SkillTree = fallbackSkillTree): SkillTree => {
  const nodes = normalizeNodes((payload?.nodes as unknown[]) ?? fallback.nodes)
  const connections = normalizeConnections(nodes, (payload?.connections as unknown[]) ?? fallback.connections)

  return {
    id: typeof payload?.id === 'string' && payload.id.trim().length > 0 ? payload.id : fallback.id,
    name: typeof payload?.name === 'string' && payload.name.trim().length > 0 ? payload.name.trim() : fallback.name,
    nodes,
    connections,
  }
}

const defaultSkillTree = normalizeSkillTree(defaultSkillTreeJson as SkillTree, fallbackSkillTree)

export { normalizeNodes, normalizeConnections, normalizeSkillTree }

export const useSkillStore = defineStore('skill', {
  state: () => ({
    availablePoints: 3,
    unlockedSkillIds: [] as string[],
    skillTreeData: normalizeSkillTree(),
    loading: false,
    editMode: false,
    selectedSkillIds: [] as string[],
    activeSkillId: null as string | null,
  }),
  getters: {
    /**
     * 処理名: アクティブスキル取得
     *
     * 処理概要: 現在選択中のスキルIDに紐づくノードを返し、見つからない場合はnullを返却する。
     *
     * 実装理由: 画面表示や編集操作で現在の対象スキルを簡潔に参照するため。
     */
    activeSkill(state): SkillNode | null {
      return state.skillTreeData.nodes.find((node) => node.id === state.activeSkillId) ?? null
    },
  },
  actions: {
    /**
     * 処理名: 空き座標の算出
     *
     * 処理概要: 指定座標を基点に既存ノードと重ならない最寄りのグリッド位置を探索して返す。
     *
     * 実装理由: 新規スキル配置時の視認性と整合性を確保するため。
     */
    findNonOverlappingPosition(startX: number, startY: number) {
      const baseX = Math.round(startX)
      const baseY = Math.round(startY)

      const occupied = new Set(this.skillTreeData.nodes.map((node) => `${Math.round(node.x)},${Math.round(node.y)}`))
      const isFree = (x: number, y: number) => !occupied.has(`${x},${y}`)

      if (isFree(baseX, baseY)) return { x: baseX, y: baseY }

      // 同一座標のみを衝突とみなし、近傍グリッドを外側へ探索する
      const step = 20
      const maxRadius = 50

      for (let radius = 1; radius <= maxRadius; radius++) {
        const offset = radius * step

        // 上辺/下辺
        for (let dx = -offset; dx <= offset; dx += step) {
          const x1 = baseX + dx
          const y1 = baseY - offset
          if (isFree(x1, y1)) return { x: x1, y: y1 }

          const x2 = baseX + dx
          const y2 = baseY + offset
          if (isFree(x2, y2)) return { x: x2, y: y2 }
        }

        // 左辺/右辺（角は上でチェック済みなので除外）
        for (let dy = -offset + step; dy <= offset - step; dy += step) {
          const x1 = baseX - offset
          const y1 = baseY + dy
          if (isFree(x1, y1)) return { x: x1, y: y1 }

          const x2 = baseX + offset
          const y2 = baseY + dy
          if (isFree(x2, y2)) return { x: x2, y: y2 }
        }
      }

      // 異常に密集している場合のフォールバック
      return { x: baseX + step, y: baseY + step }
    },
    /**
     * 処理名: スキルID生成
     *
     * 処理概要: UUIDを優先的に利用し、利用不可の場合は日時と乱数に基づくフォールバックIDを発行する。
     *
     * 実装理由: クライアント側で一意なIDを確保し、サーバーと競合しない追加操作を可能にするため。
     */
    generateSkillId() {
      const makeFallback = () => `skill-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
      }
      return makeFallback()
    },
    /**
     * 処理名: 前提スキル取得
     *
     * 処理概要: 指定スキルIDの前提スキル一覧を返却する。対象が無い場合は空配列を返す。
     *
     * 実装理由: アンロック可否判定や表示用に依存関係を即時参照するため。
     */
    getPrerequisites(skillId: string) {
      const node = this.skillTreeData.nodes.find((n) => n.id === skillId)
      if (!node) return []
      return Array.isArray(node.reqs) ? node.reqs : []
    },
    /**
     * 処理名: アンロック判定
     *
     * 処理概要: 指定IDがアンロック済みかどうかを判定する。
     *
     * 実装理由: UI表示と操作制御の基礎判定として利用するため。
     */
    isUnlocked(skillId: string) {
      return this.unlockedSkillIds.includes(skillId)
    },
    /**
     * 処理名: 依存スキル取得
     *
     * 処理概要: 指定スキルを前提とするスキルIDを、接続情報と前提定義から統合して返す。
     *
     * 実装理由: 無効化可否や整合性チェックに必要な依存先を把握するため。
     */
    getDependents(skillId: string) {
      const fromConnections = this.skillTreeData.connections
        .filter((conn) => conn.from === skillId)
        .map((conn) => conn.to)

      const fromReqs = this.skillTreeData.nodes
        .filter((node) => this.getPrerequisites(node.id).includes(skillId))
        .map((node) => node.id)

      return Array.from(new Set([...fromConnections, ...fromReqs]))
    },
    /**
     * 処理名: 無効化可否判定
     *
     * 処理概要: 編集モード・アンロック状態・依存スキルの有無を確認し、無効化が可能か返す。
     *
     * 実装理由: 誤操作で依存関係を崩さないようにガードするため。
     */
    canDisable(skillId: string) {
      if (this.editMode) return false
      if (!this.isUnlocked(skillId)) return false
      const unlockedDependents = this.getDependents(skillId).filter((id) => this.isUnlocked(id))
      if (unlockedDependents.length > 0) return false
      return true
    },
    /**
     * 処理名: アンロック可否判定
     *
     * 処理概要: 編集モード、存在確認、ポイント残量、前提スキル達成を評価しアンロック可能か返す。
     *
     * 実装理由: UI操作時に許可/不許可を即時フィードバックするため。
     */
    canUnlock(skillId: string) {
      if (this.editMode) return false
      const node = this.skillTreeData.nodes.find((n) => n.id === skillId)
      if (!node) return false
      if (this.isUnlocked(skillId)) return false
      if (node.cost > this.availablePoints) return false
      const prereqs = this.getPrerequisites(skillId)
      if (prereqs.length > 0 && prereqs.some((req) => !this.isUnlocked(req))) return false
      return true
    },
    /**
     * 処理名: スキルアンロック
     *
     * 処理概要: 可否判定を通過したスキルをアンロックし、消費ポイントを減算する。
     *
     * 実装理由: ユーザー操作によるスキル取得を状態に反映するため。
     */
    unlockSkill(skillId: string) {
      if (this.editMode) return false
      const node = this.skillTreeData.nodes.find((n) => n.id === skillId)
      if (!node) return false
      if (!this.canUnlock(skillId)) return false

      this.availablePoints -= node.cost
      this.unlockedSkillIds.push(skillId)
      return true
    },
    /**
     * 処理名: スキル無効化
     *
     * 処理概要: 依存が無いアンロック済みスキルを無効化し、消費ポイントを戻す。
     *
     * 実装理由: 取得スキルの取り消しを安全に行うため。
     */
    disableSkill(skillId: string) {
      if (this.editMode) return false
      const node = this.skillTreeData.nodes.find((n) => n.id === skillId)
      if (!node) return false
      if (!this.canDisable(skillId)) return false

      this.availablePoints += node.cost
      this.unlockedSkillIds = this.unlockedSkillIds.filter((id) => id !== skillId)
      return true
    },
    /**
     * 処理名: 接続情報再構築
     *
     * 処理概要: 現在のノード集合から接続を正規化し直し、重複や欠損を除去する。
     *
     * 実装理由: ノードの追加・削除・移動後も整合性のあるグラフ構造を維持するため。
     */
    refreshConnections() {
      this.skillTreeData.connections = normalizeConnections(
        this.skillTreeData.nodes,
        this.skillTreeData.connections,
      )
    },
    /**
     * 処理名: 選択トグル
     *
     * 処理概要: 単独/複数選択モードに応じて選択状態を更新し、アクティブスキルも同期する。
     *
     * 実装理由: 編集モードでの複数選択と単一選択の操作性を維持するため。
     */
    toggleSelection(skillId: string, multiSelect: boolean) {
      if (!this.editMode) return

      if (!multiSelect) {
        this.selectedSkillIds = [skillId]
        this.activeSkillId = skillId
        return
      }

      const alreadySelected = this.selectedSkillIds.includes(skillId)
      this.selectedSkillIds = alreadySelected
        ? this.selectedSkillIds.filter((id) => id !== skillId)
        : [...this.selectedSkillIds, skillId]

      this.activeSkillId = this.selectedSkillIds[this.selectedSkillIds.length - 1] ?? null
    },
    /**
     * 処理名: アクティブスキル設定
     *
     * 処理概要: 指定IDをアクティブに設定し、未選択の場合は選択リストにも追加する。
     *
     * 実装理由: クリック/ショートカット操作でフォーカスと選択を同期させるため。
     */
    setActiveSkill(skillId: string | null) {
      this.activeSkillId = skillId
      if (skillId && !this.selectedSkillIds.includes(skillId)) {
        this.selectedSkillIds = [skillId]
      }
    },
    /**
     * 処理名: 選択クリア
     *
     * 処理概要: 選択中およびアクティブなスキルを全て解除する。
     *
     * 実装理由: 編集完了やインポート直後に選択状態をリセットするため。
     */
    clearSelection() {
      this.selectedSkillIds = []
      this.activeSkillId = null
    },
    /**
     * 処理名: 選択からの新規スキル作成
     *
     * 処理概要: 選択中ノードの重心付近に新規スキルを配置し、依存関係を引き継ぐ。
     *
     * 実装理由: 既存スキルを起点に素早く派生スキルを追加できるようにするため。
     */
    createSkillFromSelection() {
      if (!this.editMode) {
        return { ok: false, message: '編集モードでのみ追加できます' }
      }

      const selectedNodes = this.skillTreeData.nodes.filter((node) => this.selectedSkillIds.includes(node.id))
      const x =
        selectedNodes.length > 0
          ? Math.round(selectedNodes.reduce((sum, node) => sum + node.x, 0) / selectedNodes.length)
          : 500
      const y =
        selectedNodes.length > 0
          ? Math.round(selectedNodes.reduce((sum, node) => sum + node.y, 0) / selectedNodes.length)
          : 400

      const position = this.findNonOverlappingPosition(x, y)

      const newId = this.generateSkillId()
      const result = this.addSkill({
        id: newId,
        name: '新規スキル',
        cost: 0,
        x: position.x,
        y: position.y,
        description: '',
        reqs: [...this.selectedSkillIds],
      })

      if (!result.ok) return result

      this.activeSkillId = newId
      this.selectedSkillIds = [newId]
      return { ...result, id: newId }
    },
    /**
     * 処理名: スキル追加
     *
     * 処理概要: 入力スキルを正規化し、ID重複を避けつつ新規ノードとして追加する。
     *
     * 実装理由: 編集モードでの新規登録を安全に受け付けるため。
     */
    addSkill(payload: SkillDraft) {
      if (!this.editMode) {
        return { ok: false, message: '編集モードでのみ追加できます' }
      }

      const candidateId = payload.id?.trim() || this.generateSkillId()

      const normalized = normalizeNodes([payload])
      if (normalized.length === 0) {
        return { ok: false, message: 'スキル情報が不正です' }
      }

      const normalizedSkill = normalized[0]
      if (!normalizedSkill) {
        return { ok: false, message: 'スキル情報が不正です' }
      }

      const normalizedSkillWithId: SkillNode = {
        ...normalizedSkill,
        id: candidateId,
      }

      const { x, y } = this.findNonOverlappingPosition(normalizedSkillWithId.x, normalizedSkillWithId.y)
      const normalizedSkillWithSafePosition: SkillNode = {
        ...normalizedSkillWithId,
        x,
        y,
      }

      if (this.skillTreeData.nodes.some((node) => node.id === normalizedSkillWithId.id)) {
        return { ok: false, message: '同じIDのスキルが既に存在します' }
      }

      this.skillTreeData.nodes.push(normalizedSkillWithSafePosition)
      this.refreshConnections()
      this.activeSkillId = normalizedSkillWithSafePosition.id
      this.selectedSkillIds = [normalizedSkillWithSafePosition.id]
      return { ok: true }
    },
    /**
     * 処理名: スキル更新
     *
     * 処理概要: 正規化した値で既存スキルを更新し、接続情報を再構築する。
     *
     * 実装理由: 編集パネルからの変更を状態に反映し、整合性を維持するため。
     */
    updateSkill(payload: SkillDraft) {
      if (!this.editMode) {
        return { ok: false, message: '編集モードでのみ更新できます' }
      }

      const candidateId = payload.id?.trim() || this.generateSkillId()

      const normalized = normalizeNodes([payload])
      if (normalized.length === 0) {
        return { ok: false, message: 'スキル情報が不正です' }
      }

      const normalizedSkillUpdate = normalized[0]
      if (!normalizedSkillUpdate) {
        return { ok: false, message: 'スキル情報が不正です' }
      }

      const normalizedSkillWithId: SkillNode = {
        ...normalizedSkillUpdate,
        id: candidateId,
      }

      const targetIndex = this.skillTreeData.nodes.findIndex((node) => node.id === payload.id)
      if (targetIndex === -1) {
        return { ok: false, message: '対象のスキルが見つかりません' }
      }

      this.skillTreeData.nodes[targetIndex] = {
        ...this.skillTreeData.nodes[targetIndex],
        ...normalizedSkillWithId,
      }
      this.refreshConnections()
      this.activeSkillId = payload.id
      return { ok: true }
    },
    /**
     * 処理名: スキル削除
     *
     * 処理概要: 対象スキルと関連接続・アンロック状態・選択状態を除去し、整合性を再構築する。
     *
     * 実装理由: 不要になったスキルを安全に取り除き、参照の残存を防ぐため。
     */
    removeSkill(skillId: string) {
      if (!this.editMode) {
        return { ok: false, message: '編集モードでのみ削除できます' }
      }

      const targetIndex = this.skillTreeData.nodes.findIndex((node) => node.id === skillId)
      if (targetIndex === -1) {
        return { ok: false, message: '削除対象のスキルが見つかりません' }
      }

      this.skillTreeData.nodes.splice(targetIndex, 1)
      this.skillTreeData.connections = this.skillTreeData.connections.filter(
        (connection) => connection.from !== skillId && connection.to !== skillId,
      )
      this.unlockedSkillIds = this.unlockedSkillIds.filter((id) => id !== skillId)
      this.selectedSkillIds = this.selectedSkillIds.filter((id) => id !== skillId)
      if (this.activeSkillId === skillId) {
        this.activeSkillId = this.selectedSkillIds[this.selectedSkillIds.length - 1] ?? null
      }
      this.refreshConnections()
      return { ok: true }
    },
    /**
     * 処理名: スキル移動
     *
     * 処理概要: 指定スキルの座標を丸めた上で更新し、接続を再計算する。
     *
     * 実装理由: ドラッグ操作に伴う表示位置変更と接続線更新を同期させるため。
     */
    moveSkill(skillId: string, x: number, y: number) {
      if (!this.editMode) return
      const target = this.skillTreeData.nodes.find((node) => node.id === skillId)
      if (!target) return

      target.x = Math.round(x)
      target.y = Math.round(y)
      this.refreshConnections()
    },
    /**
     * 処理名: スキルツリー読込
     *
     * 処理概要: APIからスキルツリーを取得し、正規化したうえで状態に反映する。失敗時は既定値を用いる。
     *
     * 実装理由: 初期表示やリロード時に最新データを取得しつつ、ネットワーク障害でも動作させるため。
     */
    async loadSkillTree() {
      this.loading = true
      try {
        const { data } = await api.get('/skill-tree')
        this.skillTreeData = normalizeSkillTree(data)
      } catch (error) {
        console.error('スキルツリーの取得に失敗しました', error)
        this.skillTreeData = defaultSkillTree
      } finally {
        this.loading = false
      }
    },
    /**
     * 処理名: スキルツリー保存
     *
     * 処理概要: 接続を正規化したうえでAPIに保存要求を送信する。
     *
     * 実装理由: 編集内容をサーバーへ永続化するため。
     */
    async saveSkillTree() {
      try {
        this.refreshConnections()
        await api.post('/skill-tree', this.skillTreeData)
      } catch (error) {
        console.error('スキルツリーの保存に失敗しました', error)
      }
    },
    /**
     * 処理名: スキルツリーエクスポート
     *
     * 処理概要: 接続を正規化してAPIからデータを取得し、Blob経由でクライアントにダウンロードさせる。
     *
     * 実装理由: 編集済みデータのバックアップや共有を容易にするため。
     */
    async exportSkillTree() {
      try {
        this.refreshConnections()
        const { data } = await api.get('/skill-tree/export')
        const normalized = normalizeSkillTree(data, defaultSkillTree)
        const blob = new Blob([JSON.stringify(normalized, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `${normalized.id || 'skill-tree'}.json`
        anchor.click()
        URL.revokeObjectURL(url)
      } catch (error) {
        console.error('スキルツリーのエクスポートに失敗しました', error)
      }
    },
    /**
     * 処理名: スキルツリーインポート
     *
     * 処理概要: ファイルからJSONを読み込み正規化し、APIへ送信して状態を置き換える。
     *
     * 実装理由: 外部からのツリー差し替えやテンプレート読込を可能にするため。
     */
    async importSkillTreeFromFile(file: File) {
      try {
        const content = await file.text()
        const parsed = JSON.parse(content)
        const normalized = normalizeSkillTree(parsed, defaultSkillTree)
        await api.post('/skill-tree/import', normalized)
        this.skillTreeData = normalized
        this.clearSelection()
      } catch (error) {
        console.error('スキルツリーのインポートに失敗しました', error)
        throw error
      }
    },
    /**
     * 処理名: 編集モード切替
     *
     * 処理概要: 編集モードのオンオフを切り替え、終了時に保存と選択解除を行う。
     *
     * 実装理由: 閲覧と編集のモードを明確に分け、編集内容を確実に永続化するため。
     */
    async toggleEditMode() {
      this.editMode = !this.editMode

      if (!this.editMode) {
        await this.saveSkillTree()
        this.clearSelection()
      }
    },
    /**
     * 処理名: ステータス読込
     *
     * 処理概要: APIから残ポイントとアンロックスキルIDを取得し、正規化して状態に反映する。
     *
     * 実装理由: サーバーとクライアントのステータスを同期させるため。
     */
    async loadStatus() {
      this.loading = true
      try {
        const { data } = await api.get('/status')
        if (typeof data.availablePoints === 'number') {
          this.availablePoints = data.availablePoints
        }
        if (Array.isArray(data.unlockedSkillIds)) {
          this.unlockedSkillIds = data.unlockedSkillIds.filter(
            (id: unknown): id is string => typeof id === 'string',
          )
        }
      } catch (error) {
        console.error('ステータスの取得に失敗しました', error)
      } finally {
        this.loading = false
      }
    },
    /**
     * 処理名: 進行状況保存
     *
     * 処理概要: 現在の残ポイントとアンロックスキルIDをAPIへ送信し保存する。
     *
     * 実装理由: ユーザー進行を手動保存できるようにするため。
     */
    async saveProgress() {
      try {
        await api.post('/save', {
          availablePoints: this.availablePoints,
          unlockedSkillIds: this.unlockedSkillIds,
        })
      } catch (error) {
        console.error('進行状況の保存に失敗しました', error)
      }
    },
  },
})
