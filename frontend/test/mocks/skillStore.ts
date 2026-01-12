import { defineStore } from 'pinia'
import {
  defaultSkillTree,
  normalizeConnections,
  normalizeNodes,
  normalizeSkillTree,
  normalizeStatus,
  type SkillTree,
} from '../../src/services/skillNormalizer.ts'
import { type SkillNode, type SkillConnection } from '../../src/types/skill'

export { normalizeConnections, normalizeNodes, normalizeSkillTree, normalizeStatus, defaultSkillTree }

export const useSkillStore = defineStore('skill', {
  state: () => ({
    availablePoints: defaultSkillTree.availablePoints ?? 0,
    skillTreeData: defaultSkillTree as SkillTree,
    unlockedSkillIds: [] as string[],
    editMode: false,
  }),
  actions: {
    getPrerequisites(skillId: string) {
      const node = this.skillTreeData.nodes.find((n) => n.id === skillId)
      if (!node) return []
      const reqsFromNode = Array.isArray(node.reqs) ? node.reqs : []
      const reqsFromConnections = (this.skillTreeData.connections || [])
        .filter((conn: SkillConnection) => conn.to === skillId)
        .map((conn) => conn.from)

      return Array.from(new Set([...reqsFromNode, ...reqsFromConnections]))
    },
    isUnlocked(skillId: string) {
      return this.unlockedSkillIds.includes(skillId)
    },
    canUnlock(skillId: string) {
      if (this.editMode) return false
      const node = this.skillTreeData.nodes.find((n: SkillNode) => n.id === skillId)
      if (!node) return false
      if (this.isUnlocked(skillId)) return false
      if (node.cost > this.availablePoints) return false
      const prereqs = this.getPrerequisites(skillId)
      const reqMode = node.reqMode ?? 'and'

      if (prereqs.length > 0) {
        const unlockedCount = prereqs.filter((req) => this.isUnlocked(req)).length
        if (reqMode === 'or') {
          if (unlockedCount === 0) return false
        } else {
          if (unlockedCount !== prereqs.length) return false
        }
      }
      return true
    },
  },
})
