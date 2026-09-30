import { FORK_MONSTERS, type MapGraph } from '../../map'

/** 布局坐标里的一屏正方形。真正上屏时再按画面铺开，见 fitMapFrame。 */
export const MAP_SIZE = 1200
export const MAP_CENTER = 600

/** 分叉图案离画面中心的最远距离。fitMapFrame 用它贴边。 */
export const FORK_REACH = 280

/** 外圈图案离画面边缘的空隙。上方多留一截，给地点名。 */
export const MAP_SCREEN_INSET = { top: 84, right: 52, bottom: 56, left: 52 } as const

export interface MapInset {
  top: number
  right: number
  bottom: number
  left: number
}

export interface MapFrame {
  width: number
  height: number
  originX: number
  originY: number
  scaleX: number
  scaleY: number
}

export interface MapPlot {
  id: string
  x: number
  y: number
  tier: number
}

const SPOTS: Record<string, { x: number; y: number; tier: number }> = {
  start: { x: MAP_CENTER, y: MAP_CENTER + 200, tier: 0 },
  [FORK_MONSTERS[0].nodeId]: { x: MAP_CENTER - 240, y: MAP_CENTER - 40, tier: 1 },
  [FORK_MONSTERS[1].nodeId]: { x: MAP_CENTER, y: MAP_CENTER - 180, tier: 1 },
  [FORK_MONSTERS[2].nodeId]: { x: MAP_CENTER + 240, y: MAP_CENTER - 40, tier: 1 },
}

function clampInset(size: number, leading: number, trailing: number, budget: number): [number, number] {
  const room = Math.max(0, Math.min(leading + trailing, size * budget))
  if (leading + trailing <= room || leading + trailing === 0) return [leading, trailing]
  const share = room / (leading + trailing)
  return [leading * share, trailing * share]
}

/**
 * 把分叉铺进当前画面：图案范围贴着四边，节点图案仍是正圆。
 * 宽屏会横向拉开，避免正方形缩在中间、两侧空一大块。
 */
export function fitMapFrame(
  viewWidth: number,
  viewHeight: number,
  inset: MapInset = MAP_SCREEN_INSET,
): MapFrame {
  const width = Math.max(viewWidth, 1)
  const height = Math.max(viewHeight, 1)
  const [left, right] = clampInset(width, inset.left, inset.right, 0.22)
  const [top, bottom] = clampInset(height, inset.top, inset.bottom, 0.34)
  const scaleX = (width - left - right) / (2 * FORK_REACH)
  const scaleY = (height - top - bottom) / (2 * FORK_REACH)
  return {
    width,
    height,
    originX: left + (width - left - right) / 2,
    originY: top + (height - top - bottom) / 2,
    scaleX,
    scaleY,
  }
}

/** 布局坐标 → 画面坐标。只平移缩放位置，不拉伸图案本身。 */
export function projectPlot(x: number, y: number, frame: MapFrame): { x: number; y: number } {
  return {
    x: frame.originX + (x - MAP_CENTER) * frame.scaleX,
    y: frame.originY + (y - MAP_CENTER) * frame.scaleY,
  }
}

/** 起点在下，三场战斗在上，左右对称。 */
export function layoutMap(graph: MapGraph): MapPlot[] {
  return graph.nodes.map((node) => {
    const spot = SPOTS[node.id]
    if (!spot) throw new Error(`节点没有固定位置：${node.id}`)
    return { id: node.id, x: spot.x, y: spot.y, tier: spot.tier }
  })
}
