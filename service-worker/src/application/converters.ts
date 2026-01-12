/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param, jsdoc/require-returns */
import type { SwSkillNode, SwSkillStatus, SwSkillTree } from '../domain/skillTypes.ts'

// Note: SkillNode and SkillTree types need to be imported from frontend/src/types/skill.ts
// For now, we define type-compatible interfaces here
export interface SkillNode {
  id: string
  x: number
  y: number
  name: string
  cost: number
  description: string
  reqs?: string[]
  reqMode?: 'and' | 'or'
}

export interface SkillTree {
  id: string
  name: string
  nodes: SkillNode[]
  connections: Array<{ from: string; to: string }>
  updatedAt: string
  version: number
  sourceUrl?: string
  sourceEtag?: string
}

export interface SkillStatus {
  treeId: string
  availablePoints: number
  unlockedSkillIds: string[]
  updatedAt: string
}

export const toUiSkillTree = (sw: SwSkillTree): SkillTree => ({
  id: sw.id,
  name: sw.name,
  nodes: sw.nodes.map<SkillNode>((n) => ({
    id: n.id,
    x: n.x,
    y: n.y,
    name: n.name,
    cost: n.cost,
    description: n.description,
    reqs: n.reqs,
    reqMode: n.reqMode,
  })),
  connections: sw.connections.map((c) => ({ from: c.from, to: c.to })),
  updatedAt: sw.updatedAt,
  version: sw.version,
  sourceUrl: sw.sourceUrl,
  sourceEtag: sw.sourceEtag,
})

export const fromUiSkillTree = (ui: SkillTree): SwSkillTree => ({
  id: ui.id,
  name: ui.name,
  nodes: ui.nodes.map<SwSkillNode>((n) => ({
    id: n.id,
    x: n.x,
    y: n.y,
    name: n.name,
    cost: n.cost,
    description: n.description,
    reqs: n.reqs ?? [],
    reqMode: n.reqMode ?? 'and',
  })),
  connections: ui.connections.map((c) => ({ from: c.from, to: c.to })),
  updatedAt: ui.updatedAt,
  version: ui.version,
  sourceUrl: ui.sourceUrl,
  sourceEtag: ui.sourceEtag,
})

export const toUiSkillStatus = (sw: SwSkillStatus): SkillStatus => ({
  treeId: sw.treeId,
  availablePoints: sw.availablePoints,
  unlockedSkillIds: sw.unlockedSkillIds,
  updatedAt: sw.updatedAt,
})

export const fromUiSkillStatus = (ui: SkillStatus): SwSkillStatus => ({
  treeId: ui.treeId,
  availablePoints: ui.availablePoints,
  unlockedSkillIds: ui.unlockedSkillIds,
  updatedAt: ui.updatedAt,
})
