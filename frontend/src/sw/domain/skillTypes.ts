/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param, jsdoc/require-returns */
export type ReqMode = 'and' | 'or'

export type SwSkillNode = {
  id: string
  x: number
  y: number
  name: string
  cost: number
  description: string
  reqs: string[]
  reqMode: ReqMode
}

export type SwSkillTreeConnection = {
  from: string
  to: string
}

export type SwSkillTree = {
  id: string
  name: string
  nodes: SwSkillNode[]
  connections: SwSkillTreeConnection[]
  updatedAt: string
  version: number
  sourceUrl?: string
  sourceEtag?: string
}

export type SwSkillStatus = {
  treeId: string
  availablePoints: number
  unlockedSkillIds: string[]
  updatedAt: string
}

export type SwSkillTreeSummary = {
  id: string
  name: string
  updatedAt: string
  nodeCount: number
  sourceUrl?: string
}

export const DEFAULT_POINTS = 3
export const DEFAULT_TREE_ID = 'default-skill-tree'
