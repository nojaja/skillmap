import { describe, expect, it } from '@jest/globals'
import { fromUiSkillStatus, fromUiSkillTree, toUiSkillStatus, toUiSkillTree } from '../../../../service-worker/src/application/converters.ts'
import type { SkillTree, SkillStatus } from '../../../../service-worker/src/application/converters.ts'

describe('application/converters', () => {
  it('toUiSkillTree / fromUiSkillTree: round-tripで情報を保持する', () => {
    const sw = fromUiSkillTree({
      id: 't1',
      name: 'Tree',
      nodes: [
        { id: 'n1', x: 1, y: 2, name: 'N1', cost: 3, description: 'd', reqs: ['n0'], reqMode: 'or' },
      ],
      connections: [{ from: 'n0', to: 'n1' }],
      updatedAt: '2024-01-01T00:00:00Z',
      version: 2,
      sourceUrl: 'https://example.com',
      sourceEtag: 'etag',
    } as SkillTree)

    const ui = toUiSkillTree(sw)

    expect(ui.id).toBe('t1')
    expect(ui.nodes[0].reqs).toEqual(['n0'])
    expect(ui.connections[0]).toEqual({ from: 'n0', to: 'n1' })
  })

  it('toUiSkillStatus / fromUiSkillStatus: round-tripで情報を保持する', () => {
    const sw = fromUiSkillStatus({
      treeId: 't1',
      availablePoints: 5,
      unlockedSkillIds: ['a', 'b'],
      updatedAt: '2024-02-01T00:00:00Z',
    } as SkillStatus)

    const ui = toUiSkillStatus(sw)

    expect(ui.treeId).toBe('t1')
    expect(ui.availablePoints).toBe(5)
    expect(ui.unlockedSkillIds).toEqual(['a', 'b'])
  })
})
