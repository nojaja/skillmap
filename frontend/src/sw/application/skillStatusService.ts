/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param, jsdoc/require-returns */
import type { SkillTreeRepository } from './skillTreeRepository.ts'
import type { NotificationGateway } from './eventPublisher.ts'
import type { SwSkillStatus } from '../domain/skillTypes.ts'

export class SkillStatusService {
  private readonly repo: SkillTreeRepository
  private readonly events: NotificationGateway

  constructor(repo: SkillTreeRepository, events: NotificationGateway) {
    this.repo = repo
    this.events = events
  }

  async get(treeId: string, fallback?: Partial<SwSkillStatus>): Promise<SwSkillStatus> {
    return this.repo.getStatus(treeId, fallback)
  }

  async save(treeId: string, incoming: Partial<SwSkillStatus>): Promise<SwSkillStatus> {
    const saved = await this.repo.saveStatus(treeId, incoming)
    this.events.publish({ type: 'status-updated', treeId, updatedAt: saved.updatedAt })
    return saved
  }
}
