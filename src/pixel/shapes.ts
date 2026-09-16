/**
 * 形状 DSL：用少量几何原语（圆 / 椭圆 / 矩形 / 线 / 多边形 / 单像素）描述一枚小图标，
 * 光栅化到像素网格后自动加 1px 轮廓（ink）与可选底部影子。
 * 用于数量最多的卡牌 / 纪念品 / 节点图标与桌面物件——同一套原语保证风格一致；
 * 角色与头像仍用 ASCII DSL（dsl.ts）。颜色写主色板键名或 #hex。
 */
import { PAL, color } from './palette'
import { makeCanvas } from './dsl'

export type Op =
  | { c: 'disc'; x: number; y: number; r: number; f: string }
  | { c: 'ell'; x: number; y: number; rx: number; ry: number; f: string }
  | { c: 'rect'; x: number; y: number; w: number; h: number; f: string }
  | { c: 'rrect'; x: number; y: number; w: number; h: number; r?: number; f: string }
  | { c: 'line'; x1: number; y1: number; x2: number; y2: number; f: string; w?: number }
  | { c: 'poly'; pts: [number, number][]; f: string }
  | { c: 'px'; pts: [number, number][]; f: string }
  | { c: 'ring'; x: number; y: number; r: number; f: string }
  | { c: 'arc'; x: number; y: number; r: number; a0: number; a1: number; f: string }
  | { c: 'hl'; x: number; y: number; w?: number; f?: string } // 高光短线（缺省 white，宽 2）
  | { c: 'clear'; x: number; y: number; w: number; h: number } // 擦透明

export interface ShapeIcon {
  id: string
  size?: [number, number]      // 缺省 24×24
  ops: Op[]
  outline?: string | false     // 缺省 ink；false 不描边
  shadow?: boolean             // 底部 1 行影子（ink2），缺省 true
  /** 轮廓只描外侧（默认）；true 时内部不同色块之间也描线（用于分块物体） */
  innerLines?: boolean
}

type Grid = (string | null)[]

function put(grid: Grid, w: number, h: number, x: number, y: number, hex: string | null): void {
  x = Math.round(x); y = Math.round(y)
  if (x < 0 || y < 0 || x >= w || y >= h) return
  grid[y * w + x] = hex
}

function fillEllipse(grid: Grid, w: number, h: number, cx: number, cy: number, rx: number, ry: number, hex: string): void {
  // 像素友好的椭圆：按行扫描，半宽 = rx * sqrt(1 - (dy/ry)^2)，向内取整
  for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) {
    const dy = (y - cy) / (ry + 0.001)
    const half = rx * Math.sqrt(Math.max(0, 1 - dy * dy)) + 0.5
    for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++) {
      if (Math.abs(x - cx) <= half) put(grid, w, h, x, y, hex)
    }
  }
}

function drawLine(grid: Grid, w: number, h: number, x1: number, y1: number, x2: number, y2: number, hex: string, thick = 1): void {
  x1 = Math.round(x1); y1 = Math.round(y1); x2 = Math.round(x2); y2 = Math.round(y2)
  const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1)
  const sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1
  let err = dx - dy
  let x = x1, y = y1
  for (let guard = 0; guard < 4096; guard++) {
    if (thick <= 1) put(grid, w, h, x, y, hex)
    else for (let ox = 0; ox < thick; ox++) for (let oy = 0; oy < thick; oy++) put(grid, w, h, x + ox - Math.floor(thick / 2), y + oy - Math.floor(thick / 2), hex)
    if (x === x2 && y === y2) break
    const e2 = err * 2
    if (e2 > -dy) { err -= dy; x += sx }
    if (e2 < dx) { err += dx; y += sy }
  }
}

function fillPoly(grid: Grid, w: number, h: number, pts: [number, number][], hex: string): void {
  const ys = pts.map((p) => p[1])
  const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(h - 1, Math.ceil(Math.max(...ys)))
  for (let y = y0; y <= y1; y++) {
    const cy = y + 0.5
    const xs: number[] = []
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]
      if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) xs.push(ax + ((cy - ay) * (bx - ax)) / (by - ay))
    }
    xs.sort((a, b) => a - b)
    for (let i = 0; i + 1 < xs.length; i += 2) {
      for (let x = Math.ceil(xs[i] - 0.5); x <= Math.floor(xs[i + 1] - 0.5); x++) put(grid, w, h, x, y, hex)
    }
  }
  // 边线保证细多边形可见
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]
    drawLine(grid, w, h, ax, ay, bx, by, hex)
  }
}

function arcPts(cx: number, cy: number, r: number, a0: number, a1: number): [number, number][] {
  const out: [number, number][] = []
  const n = Math.max(6, Math.ceil(Math.abs(a1 - a0) * r * 1.5))
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  return out
}

/** 光栅化到网格（hex 或 null） */
export function rasterize(icon: ShapeIcon): { grid: Grid; w: number; h: number } {
  const [w, h] = icon.size ?? [24, 24]
  const grid: Grid = new Array(w * h).fill(null)
  for (const op of icon.ops) {
    switch (op.c) {
      case 'disc': fillEllipse(grid, w, h, op.x, op.y, op.r, op.r, color(op.f)); break
      case 'ell': fillEllipse(grid, w, h, op.x, op.y, op.rx, op.ry, color(op.f)); break
      case 'rect': for (let y = 0; y < op.h; y++) for (let x = 0; x < op.w; x++) put(grid, w, h, op.x + x, op.y + y, color(op.f)); break
      case 'rrect': {
        const r = op.r ?? 1
        for (let y = 0; y < op.h; y++) for (let x = 0; x < op.w; x++) {
          const cx = x < r ? r - 1 - x : x >= op.w - r ? x - (op.w - r) : -1
          const cy = y < r ? r - 1 - y : y >= op.h - r ? y - (op.h - r) : -1
          if (cx >= 0 && cy >= 0 && cx + cy >= r) continue
          put(grid, w, h, op.x + x, op.y + y, color(op.f))
        }
        break
      }
      case 'line': drawLine(grid, w, h, op.x1, op.y1, op.x2, op.y2, color(op.f), op.w ?? 1); break
      case 'poly': fillPoly(grid, w, h, op.pts, color(op.f)); break
      case 'px': for (const [x, y] of op.pts) put(grid, w, h, x, y, color(op.f)); break
      case 'ring': {
        const pts = arcPts(op.x, op.y, op.r, 0, Math.PI * 2)
        for (let i = 0; i + 1 < pts.length; i++) drawLine(grid, w, h, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], color(op.f))
        break
      }
      case 'arc': {
        const pts = arcPts(op.x, op.y, op.r, op.a0, op.a1)
        for (let i = 0; i + 1 < pts.length; i++) drawLine(grid, w, h, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], color(op.f))
        break
      }
      case 'hl': for (let i = 0; i < (op.w ?? 2); i++) put(grid, w, h, op.x + i, op.y, color(op.f ?? 'white')); break
      case 'clear': for (let y = 0; y < op.h; y++) for (let x = 0; x < op.w; x++) put(grid, w, h, op.x + x, op.y + y, null); break
    }
  }
  return { grid, w, h }
}

/** 轮廓 + 影子后处理 */
function finish(icon: ShapeIcon, grid: Grid, w: number, h: number): Grid {
  const out = grid.slice()
  const ink = icon.outline === false ? null : color(icon.outline ?? PAL.ink)
  if (ink) {
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? null : grid[y * w + x])
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const me = at(x, y)
      if (me !== null) {
        if (icon.innerLines) {
          // 与右 / 下不同色的边界描内线（细）
          const r = at(x + 1, y), d = at(x, y + 1)
          if ((r !== null && r !== me) || (d !== null && d !== me)) out[y * w + x] = ink
        }
        continue
      }
      if (at(x - 1, y) !== null || at(x + 1, y) !== null || at(x, y - 1) !== null || at(x, y + 1) !== null) out[y * w + x] = ink
    }
  }
  if (icon.shadow !== false) {
    // 底部影子：找到最底一行有像素的 y，其下一行画 ink2 阴影段（若有空间）
    let bottom = -1
    for (let y = h - 1; y >= 0 && bottom < 0; y--) for (let x = 0; x < w; x++) if (out[y * w + x] !== null) { bottom = y; break }
    if (bottom >= 0 && bottom + 1 < h) {
      let x0 = w, x1 = -1
      for (let x = 0; x < w; x++) if (out[bottom * w + x] !== null) { x0 = Math.min(x0, x); x1 = Math.max(x1, x) }
      for (let x = x0 + 1; x <= x1 + 1 && x < w; x++) if (out[(bottom + 1) * w + x] === null) out[(bottom + 1) * w + x] = color(PAL.ink2)
    }
  }
  return out
}

const cache = new Map<string, HTMLCanvasElement>()

export function bakeShape(icon: ShapeIcon): HTMLCanvasElement {
  const hit = cache.get(icon.id)
  if (hit) return hit
  const { grid, w, h } = rasterize(icon)
  const g2 = finish(icon, grid, w, h)
  const { c, g } = makeCanvas(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const hex = g2[y * w + x]
    if (!hex) continue
    g.fillStyle = hex
    g.fillRect(x, y, 1, 1)
  }
  cache.set(icon.id, c)
  return c
}

/** 统计一枚形状图标用了多少种颜色（lint 用） */
export function shapeColors(icon: ShapeIcon): Set<string> {
  const { grid, w, h } = rasterize(icon)
  const g2 = finish(icon, grid, w, h)
  return new Set(g2.filter((x): x is string => !!x).map((x) => x.toLowerCase()))
}
