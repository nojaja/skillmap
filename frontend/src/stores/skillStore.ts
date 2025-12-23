import axios from 'axios'
import { defineStore } from 'pinia'

export const SKILL_POINT_SYSTEM_ENABLED = false

export interface SkillNode {
  id: string
  x: number
  y: number
  name: string
  cost: number
  req?: string | null
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

const defaultSkillTree: SkillTree = {
  id: 'destruction_magic',
  name: '破壊魔法 (Destruction Magic)',
  nodes: [
    { id: 'novice', x: 500, y: 520, name: '素人', cost: 0, req: null },
    { id: 'apprentice', x: 420, y: 420, name: '見習い', cost: 0, req: 'novice' },
    { id: 'dual_cast', x: 600, y: 450, name: '二連の唱え', cost: 0, req: 'novice' },
    { id: 'adept', x: 350, y: 340, name: '精鋭', cost: 0, req: 'apprentice' },
    { id: 'expert', x: 500, y: 300, name: '熟練者', cost: 0, req: 'adept' },
    { id: 'impact', x: 650, y: 360, name: '衝撃', cost: 0, req: 'dual_cast' },
  ],
  connections: [
    { from: 'novice', to: 'apprentice' },
    { from: 'novice', to: 'dual_cast' },
    { from: 'apprentice', to: 'adept' },
    { from: 'adept', to: 'expert' },
    { from: 'dual_cast', to: 'impact' },
    { from: 'expert', to: 'impact' },
  ],
}

export const useSkillStore = defineStore('skill', {
  state: () => ({
    availablePoints: 3,
    unlockedSkillIds: [] as string[],
    skillTreeData: defaultSkillTree,
    loading: false,
  }),
  actions: {
    isUnlocked(skillId: string) {
      return this.unlockedSkillIds.includes(skillId)
    },
    canUnlock(skillId: string) {
      const node = this.skillTreeData.nodes.find((n) => n.id === skillId)
      if (!node) return false
      if (this.isUnlocked(skillId)) return false
      if (node.cost > this.availablePoints) return false
      if (node.req && !this.isUnlocked(node.req)) return false
      return true
    },
    unlockSkill(skillId: string) {
      const node = this.skillTreeData.nodes.find((n) => n.id === skillId)
      if (!node) return false
      if (!this.canUnlock(skillId)) return false

      this.availablePoints -= node.cost
      this.unlockedSkillIds.push(skillId)
      return true
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
        console.error('Failed to load status', error)
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
        console.error('Failed to save progress', error)
      }
    },
  },
})
