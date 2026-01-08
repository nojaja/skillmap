import { jest } from '@jest/globals'

import {
  isoNow,
  normalizeUpdatedAt,
  normalizeVersion,
  sanitizeTreeId,
  normalizeNodes,
  normalizeConnections,
  mergeByUpdatedAt,
} from '../../../../frontend/src/sw/domain/skillNormalizer.ts'
import { SwSkillNode } from '../../../../frontend/src/sw/domain/skillTypes.ts'

describe('domain/skillNormalizer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('normalizeUpdatedAt: 有効文字列はISOに正規化、無効はfallbackまたは現在時刻', () => {
    const iso = normalizeUpdatedAt('2020-01-01T00:00:00Z')
    expect(new Date(iso).toISOString()).toBe('2020-01-01T00:00:00.000Z')

    const fb = normalizeUpdatedAt(123, '2021-05-05T12:00:00Z')
    expect(fb).toBe('2021-05-05T12:00:00.000Z')

    const now = normalizeUpdatedAt(undefined)
    expect(new Date(now).getTime()).toBeGreaterThan(0)
  })

  it('normalizeVersion: 数値>=1のみ許容、その他はfallback→1', () => {
    expect(normalizeVersion(2, 1)).toBe(2)
    expect(normalizeVersion('10', 1)).toBe(10)
    expect(normalizeVersion(0, 3)).toBe(3)
    expect(normalizeVersion(undefined, undefined)).toBe(1)
  })

  it('sanitizeTreeId: 許可パターンのみ通し、その他はdefault', () => {
    expect(sanitizeTreeId('abc-XYZ_123')).toBe('abc-XYZ_123')
    expect(sanitizeTreeId('bad id!')).toBe('default-skill-tree')
    expect(sanitizeTreeId('')).toBe('default-skill-tree')
  })

  it('normalizeNodes: 不正/重複/未定義を除外し、数値と文字列を正規化', () => {
    const raw = [
      { id: 'a', x: '1', y: 2, name: ' A ', cost: '3', description: ' d ', reqs: ['b', ''] },
      { id: 'a', x: 1, y: 2 }, // duplicate id
      { id: 'b', x: 0, y: 0, reqs: ['a', 'a'] },
      { id: 123 },
      null,
    ]
    const nodes = normalizeNodes(raw as unknown)
    expect(nodes.map(n => n.id)).toEqual(['a', 'b'])
    expect(nodes[0].name).toBe('A')
    expect(nodes[0].cost).toBe(3)
    expect(nodes[0].description).toBe('d')
    expect(nodes[0].reqs).toEqual(['b'])
  })

  it('normalizeConnections: reqsをマージし、自己参照と未知ノードを排除、重複除去', () => {
    const nodes: SwSkillNode[] = [
      { id: 'a', x: 0, y: 0, name: 'a', cost: 0, description: '', reqs: ['b'], reqMode: 'and' },
      { id: 'b', x: 0, y: 0, name: 'b', cost: 0, description: '', reqs: [], reqMode: 'and' },
    ]
    const raw = [
      { from: 'a', to: 'b' },
      { from: 'a', to: 'a' },
      { from: 'x', to: 'a' },
      { from: 'b', to: 'a' },
      { from: 'b', to: 'a' },
    ]
    const conns = normalizeConnections(nodes, raw)
    // reqs(b->a) が追加され、a->b は重複除去される
    expect(conns).toEqual(expect.arrayContaining([
      { from: 'a', to: 'b' },
      { from: 'b', to: 'a' },
    ]))
    // 自己参照や未知ノードは含まれない
    expect(conns.find(c => c.from === 'a' && c.to === 'a')).toBeUndefined()
    expect(conns.find(c => c.from === 'x')).toBeUndefined()
  })

  it('mergeByUpdatedAt: updatedAtが新しい方を選ぶ', () => {
    const a = { updatedAt: '2020-01-01T00:00:00Z' }
    const b = { updatedAt: '2021-01-01T00:00:00Z' }
    const picked = mergeByUpdatedAt(b, a)
    expect(picked).toBe(b)
  })

  it('isoNow: ISO8601文字列を返す', () => {
    const now = isoNow()
    expect(typeof now).toBe('string')
    expect(new Date(now).getTime()).toBeGreaterThan(0)
  })
})
