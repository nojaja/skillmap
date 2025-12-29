export const GRID_STEP = 20

/**
 * 処理名: グリッドスナップ
 *
 * 処理概要: 指定値をグリッド幅に基づいて最も近い整数倍へ丸める。
 *
 * 実装理由: 座標を一貫したステップに揃え、重なり判定を容易にするため。
 * @param value スナップ対象の値
 * @returns 丸め後の値
 */
export const snapToGrid = (value: number): number => {
  return Math.round(value / GRID_STEP) * GRID_STEP
}

/**
 * 処理名: 距離算出
 *
 * 処理概要: 2点間のユークリッド距離を計算する。
 *
 * 実装理由: 近傍探索や配置計算の基礎メトリクスとして利用するため。
 * @param x1 点1のX座標
 * @param y1 点1のY座標
 * @param x2 点2のX座標
 * @param y2 点2のY座標
 * @returns 2点間距離
 */
export const distance = (x1: number, y1: number, x2: number, y2: number): number => {
  const dx = x2 - x1
  const dy = y2 - y1
  return Math.hypot(dx, dy)
}

/**
 * 処理名: 最近傍点検索
 *
 * 処理概要: 候補座標群から最も近い点を選択し、存在しない場合はnullを返す。
 *
 * 実装理由: 描画要素のスナップや移動候補選択に再利用するため。
 * @param x 基準点X座標
 * @param y 基準点Y座標
 * @param candidates 候補座標リスト
 * @returns 最寄りの座標、存在しない場合はnull
 */
export const nearestPoint = (x: number, y: number, candidates: Array<{ x: number; y: number }>): { x: number; y: number } | null => {
  if (candidates.length === 0) return null

  const closest = candidates.reduce<{ x: number; y: number; d: number } | null>((current, point) => {
    const d = distance(x, y, point.x, point.y)
    if (!current || d < current.d) {
      return { ...point, d }
    }
    return current
  }, null as { x: number; y: number; d: number } | null)

  if (!closest) return null
  return { x: closest.x, y: closest.y }
}
