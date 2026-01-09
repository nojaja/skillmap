/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param, jsdoc/require-returns */
import type { SkillTreeRepository } from './skillTreeRepository.ts'
import type { NotificationGateway } from './eventPublisher.ts'
import type { SwSkillTree } from '../domain/skillTypes.ts'

export class SkillTreeService {
  private readonly repo: SkillTreeRepository
  private readonly events: NotificationGateway

  constructor(repo: SkillTreeRepository, events: NotificationGateway) {
    this.repo = repo
    this.events = events
  }

  async get(treeId: string, fallback?: Partial<SwSkillTree>): Promise<SwSkillTree> {
    return this.repo.getTree(treeId, fallback)
  }

  async save(treeId: string, incoming: Partial<SwSkillTree>): Promise<SwSkillTree> {
    const saved = await this.repo.saveTree(treeId, incoming)
    this.events.publish({ type: 'skill-tree-updated', treeId, updatedAt: saved.updatedAt })
    return saved
  }

  async export(treeId: string, fallback?: Partial<SwSkillTree>): Promise<SwSkillTree> {
    return this.repo.exportTree(treeId, fallback)
  }

  async import(treeId: string, tree: Partial<SwSkillTree>): Promise<SwSkillTree> {
    const result = await this.repo.importTree(treeId, tree)
    this.events.publish({ type: 'skill-tree-updated', treeId, updatedAt: result.updatedAt })
    return result
  }

  async delete(treeId: string): Promise<{ ok: boolean }> {
    const res = await this.repo.deleteTree(treeId)
    this.events.publish({ type: 'skill-tree-deleted', treeId, updatedAt: new Date().toISOString() })
    return res
  }

  async list() {
    return this.repo.listTrees()
  }
}
