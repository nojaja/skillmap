import {
  normalizeConnections,
  normalizeNodes,
  normalizeSkillTree,
  type SkillConnection,
  type SkillNode,
  type SkillTree,
} from '../../../frontend/src/stores/skillStore.ts'

describe('skillStore normalization helpers', () => {
  it('normalizeNodes: 不正データを除去し、ID重複を排除する', () => {
    const nodes = normalizeNodes([
      { id: 'a', x: 1, y: 2, name: 'A', cost: 1, description: 'ok', reqs: ['b', 'b'] },
      { id: 'a', x: 3, y: 4, name: '', cost: -1, description: 1 },
      { id: 3 },
    ] as unknown[])

    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({
      id: 'a',
      x: 1,
      y: 2,
      name: 'A',
      cost: 1,
      reqs: ['b'],
    })
  })

  it('normalizeConnections: 依存関係をマージし、自己参照や存在しないノードを除外する', () => {
    const nodes: SkillNode[] = [
      { id: 'root', name: 'root', description: '', x: 0, y: 0, cost: 0, reqs: ['leaf'] },
      { id: 'leaf', name: 'leaf', description: '', x: 10, y: 10, cost: 1, reqs: [] },
    ]

    const merged = normalizeConnections(nodes, [
      { from: 'root', to: 'leaf' },
      { from: 'leaf', to: 'missing' },
      { from: 'root', to: 'root' },
      { from: 'root', to: 'leaf' },
    ] as unknown[])

    expect(merged).toEqual<SkillConnection[]>([{ from: 'root', to: 'leaf' }, { from: 'leaf', to: 'root' }])
  })

  it('normalizeSkillTree: fallbackを用いて不足項目を補完する', () => {
    const fallback: SkillTree = {
      id: 'fallback',
      name: 'Fallback Tree',
      nodes: [
        { id: 'base', name: 'base', description: '', x: 0, y: 0, cost: 0, reqs: [] },
      ],
      connections: [],
      updatedAt: '2023-01-01T00:00:00.000Z',
    }

    const normalized = normalizeSkillTree({ name: '' }, fallback)

    expect(normalized.id).toBe('fallback')
    expect(normalized.name).toBe('Fallback Tree')
    expect(normalized.nodes).toEqual(fallback.nodes)
  })

  it('normalizeSkillTree: 正常系パスでノード・接続を正規化する', () => {
    const normalized = normalizeSkillTree({
      id: 'custom',
      name: 'Custom Tree',
      nodes: [
        { id: 'n1', x: 1, y: 2, name: 'N1', cost: 2, description: 'desc', reqs: ['n2'] },
        { id: 'n2', x: 2, y: 3, name: 'N2', cost: 1, description: 'desc2', reqs: [] },
      ],
      connections: [{ from: 'n1', to: 'n2' }],
      updatedAt: '2023-01-02T00:00:00.000Z',
    })

    expect(normalized.id).toBe('custom')
    expect(normalized.connections).toEqual<SkillConnection[]>([
      { from: 'n1', to: 'n2' },
      { from: 'n2', to: 'n1' },
    ])
  })
})
