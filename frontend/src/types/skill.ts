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
  updatedAt: string
  sourceUrl?: string
}

export interface SkillTreeSummary {
  id: string
  name: string
  updatedAt: string
  nodeCount: number
  sourceUrl?: string
}

export interface SkillStatus {
  treeId: string
  availablePoints: number
  unlockedSkillIds: string[]
  updatedAt: string
}

export const DEFAULT_AVAILABLE_POINTS = 3
