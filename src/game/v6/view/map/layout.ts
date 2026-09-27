import { neighborsOf, type MapGraph, type MapNode } from '../../map'

/** 布局坐标里的一屏正方形。真正上屏时再按画面铺开，见 fitMapFrame。 */
export const MAP_SIZE = 1200
export const MAP_CENTER = 600
export const TIER_RADIUS = [0, 104, 192, 278, 360, 436, 508] as const

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

interface Draft {
  id: string
  tier: number
  angle: number
  x: number
  y: number
}

const SHOP_CENTER = Math.PI / 2
const SHOP_HALF = 0.36
const GAP = 0.2

function compareText(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function radiusOf(tier: number): number {
  const radius = TIER_RADIUS[tier]
  if (radius === undefined) throw new Error(`没有这一档的半径：${tier}`)
  return radius
}

function clampInset(size: number, leading: number, trailing: number, budget: number): [number, number] {
  const room = Math.max(0, Math.min(leading + trailing, size * budget))
  if (leading + trailing <= room || leading + trailing === 0) return [leading, trailing]
  const share = room / (leading + trailing)
  return [leading * share, trailing * share]
}

/**
 * 把同心圆布局铺进当前画面：外圈贴着四边，节点图案仍是正圆。
 * 宽屏会横向拉开，避免正方形缩在中间、两侧空一大块。
 */
export function fitMapFrame(
  viewWidth: number,
  viewHeight: number,
  inset: MapInset = MAP_SCREEN_INSET,
): MapFrame {
  const outer = TIER_RADIUS[TIER_RADIUS.length - 1] ?? 1
  const width = Math.max(viewWidth, 1)
  const height = Math.max(viewHeight, 1)
  const [left, right] = clampInset(width, inset.left, inset.right, 0.22)
  const [top, bottom] = clampInset(height, inset.top, inset.bottom, 0.34)
  const scaleX = (width - left - right) / (2 * outer)
  const scaleY = (height - top - bottom) / (2 * outer)
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
export function projectPlot(x: number, y: number, frame: MapFrame): { x: number, y: number } {
  return {
    x: frame.originX + (x - MAP_CENTER) * frame.scaleX,
    y: frame.originY + (y - MAP_CENTER) * frame.scaleY,
  }
}

/**
 * 中心在画面正中。商店沿正下方一条射线排开，战斗扇面占其余角度。
 * 钟楼取精英的平均角度，呼唤者跟在同一条射线上，避免两支线拧成一团。
 */
export function layoutMap(graph: MapGraph): MapPlot[] {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]))
  const children = new Map<string, string[]>()

  const lowerNeighbors = (node: MapNode): MapNode[] => neighborsOf(graph, node.id)
    .map((id) => byId.get(id))
    .filter((item): item is MapNode => item !== undefined && item.tier === node.tier - 1)

  for (const node of graph.nodes) {
    const lower = lowerNeighbors(node)
    if (lower.length !== 1) continue
    const parent = lower[0]
    if (!parent) continue
    const list = children.get(parent.id) ?? []
    list.push(node.id)
    children.set(parent.id, list)
  }
  for (const list of children.values()) list.sort(compareText)

  const drafts = new Map<string, Draft>()
  const put = (node: MapNode, angle: number) => {
    const radius = radiusOf(node.tier)
    drafts.set(node.id, {
      id: node.id,
      tier: node.tier,
      angle,
      x: MAP_CENTER + Math.cos(angle) * radius,
      y: MAP_CENTER + Math.sin(angle) * radius,
    })
  }

  const layoutTree = (id: string, start: number, end: number) => {
    const node = byId.get(id)
    if (!node) throw new Error(`没有节点 ${id}`)
    put(node, (start + end) / 2)
    const kids = children.get(id) ?? []
    if (kids.length === 0) return
    const slot = (end - start) / kids.length
    kids.forEach((kid, index) => {
      layoutTree(kid, start + slot * index, start + slot * (index + 1))
    })
  }

  const center = graph.nodes.find((node) => node.kind === 'center')
  const shop = graph.nodes.find((node) => node.id === 'shop:1')
  const runaway = graph.nodes.find((node) => node.monsterId === 'runaway-machine')
  const bell = graph.nodes.find((node) => node.monsterId === 'bell-warden')
  const caller = graph.nodes.find((node) => node.monsterId === 'the-caller')
  if (!center || !shop || !runaway || !bell || !caller) throw new Error('地图缺少中心、商店、失控机械、钟楼或呼唤者')

  put(center, 0)
  layoutTree(shop.id, SHOP_CENTER - SHOP_HALF, SHOP_CENTER + SHOP_HALF)
  layoutTree(runaway.id, SHOP_CENTER + SHOP_HALF + GAP, SHOP_CENTER - SHOP_HALF + Math.PI * 2 - GAP)

  const elites = lowerNeighbors(bell)
  if (elites.length < 2) throw new Error('钟楼没有连上精英')
  const mean = elites.reduce((sum, node) => {
    const draft = drafts.get(node.id)
    if (!draft) throw new Error(`精英还没有位置：${node.id}`)
    return sum + draft.angle
  }, 0) / elites.length
  put(bell, mean)
  put(caller, mean)

  return graph.nodes.map((node) => {
    const draft = drafts.get(node.id)
    if (!draft) throw new Error(`节点没有排进画面：${node.id}`)
    return { id: draft.id, x: draft.x, y: draft.y, tier: draft.tier }
  })
}
