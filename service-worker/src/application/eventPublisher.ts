/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param, jsdoc/require-returns, no-unused-vars */
export type SkillEvent =
  | { type: 'skill-tree-updated'; treeId: string; updatedAt: string }
  | { type: 'status-updated'; treeId: string; updatedAt: string }
  | { type: 'skill-tree-deleted'; treeId: string; updatedAt: string }

export interface NotificationGateway {
  publish(_event: SkillEvent): void
}
