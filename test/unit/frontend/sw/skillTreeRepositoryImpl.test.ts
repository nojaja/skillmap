import { jest } from '@jest/globals'
import { SkillTreeRepositoryImpl } from '../../../../frontend/src/sw/infrastructure/skillTreeRepositoryImpl.ts'

const mockGetRoot = jest.fn()
const mockEnsureDir = jest.fn()
const mockSetCache = jest.fn()
const mockListCache = jest.fn().mockReturnValue([])

const makeDir = (entriesData: Array<[string, unknown]>) => {
  async function* entries() {
    for (const item of entriesData) {
      yield item
    }
  }
  return {
    entries,
  } as unknown as FileSystemDirectoryHandle
}

const makeFileHandle = (data: unknown) => ({
  kind: 'file',
  async getFile() {
    return {
      async text() {
        return JSON.stringify(data)
      },
    } as unknown as File
  },
}) as unknown as FileSystemFileHandle

const makeDeps = () => ({
  getRoot: mockGetRoot,
  ensureDir: mockEnsureDir,
  setCache: mockSetCache,
  listCache: mockListCache,
})

beforeEach(() => {
  jest.clearAllMocks()
})

describe('SkillTreeRepositoryImpl.listTrees', () => {
  it('OPFSからJSONを列挙し、updatedAt降順で正規化して返す', async () => {
    const dir = makeDir([
      ['a.json', makeFileHandle({ id: 'a', name: 'A', nodes: [], connections: [], updatedAt: '2025-01-01T00:00:00Z', version: 1 })],
      ['bad.txt', makeFileHandle({})],
      ['b.json', makeFileHandle({ id: 'b', name: 'B', nodes: [], connections: [], updatedAt: '2024-01-01T00:00:00Z', version: 1 })],
    ])
    mockEnsureDir.mockResolvedValue(dir)
    mockGetRoot.mockResolvedValue({})

    const repo = new SkillTreeRepositoryImpl(makeDeps())
    const result = await repo.listTrees()

    expect(result.map((r) => r.id)).toEqual(['a', 'b'])
    expect(mockSetCache).toHaveBeenCalledWith(result)
  })

  it('失敗時はキャッシュを返す', async () => {
    mockEnsureDir.mockRejectedValue(new Error('fail'))
    mockListCache.mockReturnValue([{ id: 'c', name: 'C', updatedAt: '2023-01-01T00:00:00Z', nodeCount: 0 }])

    const repo = new SkillTreeRepositoryImpl(makeDeps())
    const result = await repo.listTrees()

    expect(result).toEqual([{ id: 'c', name: 'C', updatedAt: '2023-01-01T00:00:00Z', nodeCount: 0 }])
  })
})
