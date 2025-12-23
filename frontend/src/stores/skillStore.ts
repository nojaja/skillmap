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
  reqs?: string[]
}

export interface SkillDraft {
  id: string
  x: number
  y: number
  name: string
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

const api = axios.create({
  baseURL: '/api',
})

const fallbackSkillTree = defaultSkillTreeJson as SkillTree

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
        reqs,
      },
    ]
  })
}

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
    activeSkill(state): SkillNode | null {
      return state.skillTreeData.nodes.find((node) => node.id === state.activeSkillId) ?? null
    },
  },
  actions: {
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
    generateSkillId() {
      const makeFallback = () => `skill-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID()
      }
      return makeFallback()
    },
    getPrerequisites(skillId: string) {
      const node = this.skillTreeData.nodes.find((n) => n.id === skillId)
      if (!node) return []
      return Array.isArray(node.reqs) ? node.reqs : []
    },
    isUnlocked(skillId: string) {
      return this.unlockedSkillIds.includes(skillId)
    },
    getDependents(skillId: string) {
      const fromConnections = this.skillTreeData.connections
        .filter((conn) => conn.from === skillId)
        .map((conn) => conn.to)

      const fromReqs = this.skillTreeData.nodes
        .filter((node) => this.getPrerequisites(node.id).includes(skillId))
        .map((node) => node.id)

      return Array.from(new Set([...fromConnections, ...fromReqs]))
    },
    canDisable(skillId: string) {
      if (this.editMode) return false
      if (!this.isUnlocked(skillId)) return false
      const unlockedDependents = this.getDependents(skillId).filter((id) => this.isUnlocked(id))
      if (unlockedDependents.length > 0) return false
      return true
    },
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
    unlockSkill(skillId: string) {
      if (this.editMode) return false
      const node = this.skillTreeData.nodes.find((n) => n.id === skillId)
      if (!node) return false
      if (!this.canUnlock(skillId)) return false

      this.availablePoints -= node.cost
      this.unlockedSkillIds.push(skillId)
      return true
    },
    disableSkill(skillId: string) {
      if (this.editMode) return false
      const node = this.skillTreeData.nodes.find((n) => n.id === skillId)
      if (!node) return false
      if (!this.canDisable(skillId)) return false

      this.availablePoints += node.cost
      this.unlockedSkillIds = this.unlockedSkillIds.filter((id) => id !== skillId)
      return true
    },
    refreshConnections() {
      this.skillTreeData.connections = normalizeConnections(
        this.skillTreeData.nodes,
        this.skillTreeData.connections,
      )
    },
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
    setActiveSkill(skillId: string | null) {
      this.activeSkillId = skillId
      if (skillId && !this.selectedSkillIds.includes(skillId)) {
        this.selectedSkillIds = [skillId]
      }
    },
    clearSelection() {
      this.selectedSkillIds = []
      this.activeSkillId = null
    },
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
        reqs: [...this.selectedSkillIds],
      })

      if (!result.ok) return result

      this.activeSkillId = newId
      this.selectedSkillIds = [newId]
      return { ...result, id: newId }
    },
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
    moveSkill(skillId: string, x: number, y: number) {
      if (!this.editMode) return
      const target = this.skillTreeData.nodes.find((node) => node.id === skillId)
      if (!target) return

      target.x = Math.round(x)
      target.y = Math.round(y)
      this.refreshConnections()
    },
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
    async saveSkillTree() {
      try {
        this.refreshConnections()
        await api.post('/skill-tree', this.skillTreeData)
      } catch (error) {
        console.error('スキルツリーの保存に失敗しました', error)
      }
    },
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
    async toggleEditMode() {
      this.editMode = !this.editMode

      if (!this.editMode) {
        await this.saveSkillTree()
        this.clearSelection()
      }
    },
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
