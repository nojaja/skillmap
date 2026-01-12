/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param, jsdoc/require-returns, no-unused-vars */
import type { SwSkillTree, SwSkillStatus, SwSkillTreeSummary } from '../domain/skillTypes.ts'

export interface SkillTreeRepository {
  getTree(_treeId: string, _fallback?: Partial<SwSkillTree>): Promise<SwSkillTree>
  saveTree(_treeId: string, _incoming: Partial<SwSkillTree>): Promise<SwSkillTree>
  exportTree(_treeId: string, _fallback?: Partial<SwSkillTree>): Promise<SwSkillTree>
  importTree(_treeId: string, _tree: Partial<SwSkillTree>): Promise<SwSkillTree>
  deleteTree(_treeId: string): Promise<{ ok: boolean }>
  listTrees(): Promise<SwSkillTreeSummary[]>

  getStatus(_treeId: string, _fallback?: Partial<SwSkillStatus>): Promise<SwSkillStatus>
  saveStatus(_treeId: string, _incoming: Partial<SwSkillStatus>): Promise<SwSkillStatus>
}
