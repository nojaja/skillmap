import { describe, expect, it, jest } from '@jest/globals'
import {
  DEFAULT_POINTS,
  DEFAULT_TREE_ID,
  mergeByUpdatedAt,
  normalizeConnections,
  normalizeNodes,
  normalizeSkillTreePayload,
  normalizeStatusPayload,
  sanitizeTreeId,
} from '../../../frontend/src/service-worker/sw.ts'

describe('service worker helpers', () => {
  beforeAll(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2024-01-02T03:04:05Z'))
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  it('sanitizeTreeId: 無効値はデフォルトにフォールバックする', () => {
    expect(sanitizeTreeId('valid-id_01')).toBe('valid-id_01')
    expect(sanitizeTreeId('../escape')).toBe(DEFAULT_TREE_ID)
    expect(sanitizeTreeId('')).toBe(DEFAULT_TREE_ID)
    expect(sanitizeTreeId(123)).toBe(DEFAULT_TREE_ID)
  })

  it('normalizeNodes/normalizeConnections: ノードと接続を正規化する', () => {
    const nodes = normalizeNodes([
      { id: 'n1', x: '10', y: 5, name: ' Node 1 ', cost: 2, reqs: ['n0', ''], reqMode: 'or' },
      { id: 'n1', x: 30, y: 40, cost: -1, reqs: ['n2'] },
      { id: 'n2', x: '8', y: '9', cost: 5, description: '  desc  ' },
    ])

    expect(nodes).toEqual([
      {
        id: 'n1',
        x: 10,
        y: 5,
        name: 'Node 1',
        cost: 2,
        description: '',
        reqs: ['n0'],
        reqMode: 'or',
      },
      {
        id: 'n2',
        x: 8,
        y: 9,
        name: 'n2',
        cost: 5,
        description: 'desc',
        reqs: [],
        reqMode: 'and',
      },
    ])

    expect(
      normalizeConnections(nodes, [
        { from: 'n2', to: 'n1' },
        { from: 'n1', to: 'n1' },
        { from: 'ghost', to: 'n2' },
      ]),
    ).toEqual([
      { from: 'n2', to: 'n1' },
    ])
  })

  it('normalizeSkillTreePayload: フィールドを安全な値に整形する', () => {
    const payload = {
      id: ' tree-1 ',
      name: '',
      nodes: [
        { id: 'n1', x: '10', y: 5, name: ' Node 1 ', cost: 2, reqs: ['n0'], reqMode: 'or' },
        { id: 'n2', x: '8', y: '9', cost: 5 },
      ],
      connections: [
        { from: 'n2', to: 'n1' },
        { from: 'n2', to: 'n1' },
      ],
      version: '3',
      updatedAt: '2023-01-01T00:00:00Z',
      sourceUrl: ' https://example.com ',
      sourceEtag: '  etag-value ',
    }

    const fallback = {
      id: 'fallback',
      name: 'Fallback',
      nodes: [],
      connections: [],
      updatedAt: '2022-01-01T00:00:00Z',
      version: 2,
      sourceUrl: undefined,
      sourceEtag: undefined,
    }

    const normalized = normalizeSkillTreePayload(payload, fallback)

    expect(normalized).toEqual({
      id: 'tree-1',
      name: 'Fallback',
      nodes: [
        {
          id: 'n1',
          x: 10,
          y: 5,
          name: 'Node 1',
          cost: 2,
          description: '',
          reqs: ['n0'],
          reqMode: 'or',
        },
        {
          id: 'n2',
          x: 8,
          y: 9,
          name: 'n2',
          cost: 5,
          description: '',
          reqs: [],
          reqMode: 'and',
        },
      ],
      connections: [{ from: 'n2', to: 'n1' }],
      updatedAt: '2023-01-01T00:00:00.000Z',
      version: 3,
      sourceUrl: 'https://example.com',
      sourceEtag: 'etag-value',
    })
  })

  it('normalizeStatusPayload: ステータスを安全な形に整形する', () => {
    const payload = {
      availablePoints: undefined,
      unlockedSkillIds: [' a ', '', 'b'],
      updatedAt: undefined,
    }

    const normalized = normalizeStatusPayload(' ..bad.. ', payload)

    expect(normalized).toEqual({
      treeId: DEFAULT_TREE_ID,
      availablePoints: DEFAULT_POINTS,
      unlockedSkillIds: [' a ', 'b'],
      updatedAt: '2024-01-02T03:04:05.000Z',
    })
  })

  it('mergeByUpdatedAt: 新しい更新日時を優先する', () => {
    const older = { updatedAt: '2023-01-01T00:00:00Z', value: 1 }
    const newer = { updatedAt: '2024-01-01T00:00:00Z', value: 2 }

    expect(mergeByUpdatedAt(newer, older)).toEqual(newer)
    expect(mergeByUpdatedAt(older, newer)).toEqual(newer)
  })
})