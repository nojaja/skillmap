/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param, jsdoc/require-returns */
import type { SwSkillTreeSummary } from '../../domain/skillTypes.ts'

let cached: SwSkillTreeSummary[] = []

export const setCache = (items: SwSkillTreeSummary[]) => {
  cached = items
}

export const listCache = (): SwSkillTreeSummary[] => cached

export const upsertCache = (item: SwSkillTreeSummary) => {
  cached = [
    ...cached.filter(i => i.id !== item.id),
    item,
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export const evictCache = (treeId: string) => {
  cached = cached.filter(i => i.id !== treeId)
}
