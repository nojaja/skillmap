import { jest } from '@jest/globals'

import { SkillTreeService } from '../../../../frontend/src/sw/application/skillTreeService.ts'
import type { SkillTreeRepository } from '../../../../frontend/src/sw/application/skillTreeRepository.ts'
import type { NotificationGateway } from '../../../../frontend/src/sw/application/eventPublisher.ts'
import type { SwSkillTree } from '../../../../frontend/src/sw/domain/skillTypes.ts'

describe('application/SkillTreeService', () => {
  it('save: Repositoryでマージ保存後、Notificationが発火する', async () => {
    const repo: jest.Mocked<SkillTreeRepository> = {
      getTree: jest.fn(),
      saveTree: jest.fn(),
      exportTree: jest.fn(),
      importTree: jest.fn(),
      deleteTree: jest.fn(),
      listTrees: jest.fn(),
      getStatus: jest.fn(),
      saveStatus: jest.fn(),
    }
    const gateway: jest.Mocked<NotificationGateway> = { publish: jest.fn() }

    const updated: SwSkillTree = {
      id: 't1', name: 'T1', nodes: [], connections: [], updatedAt: '2025-01-01T00:00:00Z', version: 1,
    }
    repo.saveTree.mockResolvedValue(updated)

    const svc = new SkillTreeService(repo, gateway)
    const result = await svc.save('t1', { name: 'New' })

    expect(result.updatedAt).toBe('2025-01-01T00:00:00Z')
    expect(gateway.publish).toHaveBeenCalledWith({ type: 'skill-tree-updated', treeId: 't1', updatedAt: '2025-01-01T00:00:00Z' })
  })

  it('delete: Repository削除後、Notificationが発火する', async () => {
    const repo: jest.Mocked<SkillTreeRepository> = {
      getTree: jest.fn(),
      saveTree: jest.fn(),
      exportTree: jest.fn(),
      importTree: jest.fn(),
      deleteTree: jest.fn(),
      listTrees: jest.fn(),
      getStatus: jest.fn(),
      saveStatus: jest.fn(),
    }
    const gateway: jest.Mocked<NotificationGateway> = { publish: jest.fn() }

    repo.deleteTree.mockResolvedValue({ ok: true })

    const svc = new SkillTreeService(repo, gateway)
    const result = await svc.delete('t1')

    expect(result.ok).toBe(true)
    expect(gateway.publish).toHaveBeenCalled()
    const arg = gateway.publish.mock.calls[0][0]
    expect(arg.type).toBe('skill-tree-deleted')
    expect(arg.treeId).toBe('t1')
  })
})
