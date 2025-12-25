import path from 'path'
import {
  builtinDefaultSkillTree,
  loadDefaultSkillTree,
  normalizeSkillTreePayload,
  parseJsonArray,
  parseUnlocked,
  sanitizeConnections,
  sanitizeNodes,
  type SkillConnection,
  type SkillNode,
} from '../../../server/src/skillTreeService.ts'

describe('skillTreeService utilities', () => {
  it('parseJsonArray: 文字列JSONを配列に変換し、不正時はフォールバックする', () => {
    const fallback = [{ id: 'x' }]
    expect(parseJsonArray('[{"id":"ok"}]', fallback)).toEqual([{ id: 'ok' }])

    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect(parseJsonArray('not-json', fallback)).toEqual(fallback)
    spy.mockRestore()
  })

  it('parseUnlocked: 不正値は空配列で返す', () => {
    expect(parseUnlocked('["a","b"]')).toEqual(['a', 'b'])
    expect(parseUnlocked(123)).toEqual([])
  })

  it('sanitizeNodes: 重複と不正値を除去し、reqsをユニーク化する', () => {
    const nodes = sanitizeNodes([
      { id: 'a', name: '', description: ' desc ', x: '1', y: 2, cost: -5, reqs: ['x', 'x'] },
      { id: 'a' },
      { id: 'b', name: 'B', description: 'B', x: 0, y: 0, cost: 1, reqs: ['a'] },
    ])

    expect(nodes).toHaveLength(2)
    expect(nodes[0]).toMatchObject({ id: 'a', name: 'a', cost: 0, reqs: ['x'] })
    expect(nodes[1]).toMatchObject({ id: 'b', reqs: ['a'] })
  })

  it('sanitizeConnections: 依存を接続に統合し、無効な接続を落とす', () => {
    const nodes: SkillNode[] = [
      { id: 'a', name: 'a', description: '', x: 0, y: 0, cost: 0, reqs: ['b'] },
      { id: 'b', name: 'b', description: '', x: 1, y: 1, cost: 0, reqs: [] },
    ]

    const connections = sanitizeConnections(
      [
        { from: 'a', to: 'b' },
        { from: 'missing', to: 'a' },
        { from: 'a', to: 'a' },
      ],
      nodes,
    )

    expect(connections).toEqual<SkillConnection[]>([{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }])
  })

  it('normalizeSkillTreePayload: fallbackを用いて不足を補完する', () => {
    const normalized = normalizeSkillTreePayload({ nodes: [] })
    expect(normalized.id).toBe(builtinDefaultSkillTree.id)
    expect(normalized.nodes).toEqual([])
    expect(normalized.connections).toEqual([])
  })

  it('loadDefaultSkillTree: JSONファイルから正規化して読み込む', async () => {
    const loaded = await loadDefaultSkillTree(path.resolve(process.cwd(), 'data/default-skill-tree.json'))
    expect(loaded.nodes.length).toBeGreaterThan(0)
    expect(loaded.connections.length).toBeGreaterThan(0)
  })
})
