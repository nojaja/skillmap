import axios from 'axios'
import { defineStore } from 'pinia'

export const SKILL_POINT_SYSTEM_ENABLED = false

export interface SkillNode {
  id: string
  x: number
  y: number
  name: string
  cost: number
  reqs?: string[]
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
    { id: 'novice', x: 500, y: 520, name: '素人', cost: 0, reqs: [] },
    { id: 'apprentice', x: 420, y: 420, name: '見習い', cost: 0, reqs: ['novice'] },
    { id: 'dual_cast', x: 600, y: 450, name: '二連の唱え', cost: 0, reqs: ['novice'] },
    { id: 'adept', x: 350, y: 340, name: '精鋭', cost: 0, reqs: ['apprentice'] },
    { id: 'impact', x: 650, y: 360, name: '衝撃', cost: 0, reqs: ['dual_cast'] },
    { id: 'expert', x: 500, y: 300, name: '熟練者', cost: 0, reqs: ['adept', 'impact'] },
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

export const useSkillStore = defineStore('skill', {
  state: () => ({
    availablePoints: 3,
    unlockedSkillIds: [] as string[],
    skillTreeData: defaultSkillTree,
    loading: false,
  }),
  actions: {
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
      if (!this.isUnlocked(skillId)) return false
      const unlockedDependents = this.getDependents(skillId).filter((id) =>
        this.isUnlocked(id),
      )
      if (unlockedDependents.length > 0) return false
      return true
    },
    canUnlock(skillId: string) {
      const node = this.skillTreeData.nodes.find((n) => n.id === skillId)
      if (!node) return false
      if (this.isUnlocked(skillId)) return false
      if (node.cost > this.availablePoints) return false
      const prereqs = this.getPrerequisites(skillId)
      if (prereqs.length > 0 && prereqs.some((req) => !this.isUnlocked(req))) return false
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
    disableSkill(skillId: string) {
      const node = this.skillTreeData.nodes.find((n) => n.id === skillId)
      if (!node) return false
      if (!this.canDisable(skillId)) return false

      this.availablePoints += node.cost
      this.unlockedSkillIds = this.unlockedSkillIds.filter((id) => id !== skillId)
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
