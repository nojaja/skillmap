import { distance, nearestPoint, snapToGrid } from '../../../frontend/src/utils/grid.ts'

describe('grid utilities', () => {
  it('snapToGrid: 最寄りのグリッドへ丸める', () => {
    expect(snapToGrid(19)).toBe(20)
    expect(snapToGrid(21)).toBe(20)
    expect(snapToGrid(30)).toBe(40)
  })

  it('distance: 座標間距離を返す', () => {
    expect(distance(0, 0, 3, 4)).toBe(5)
  })

  it('nearestPoint: 最近傍のポイントを返す', () => {
    const candidates = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 5 },
    ]
    expect(nearestPoint(6, 4, candidates)).toEqual({ x: 5, y: 5 })
    expect(nearestPoint(0, 0, [])).toBeNull()
  })
})
