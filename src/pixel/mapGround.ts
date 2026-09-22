/**
 * 锈门层俯视地面：岩壁里挖出来的房间和走廊，不是侧视的房间背景。
 * 砖、苔、锈、干血都落在主色板上。光晕和战争迷雾允许渐变。
 */
import { PAL, rgba, hexToRgb } from './palette'
import { makeCanvas } from './dsl'

export interface FloorPoint {
  id: string
  x: number
  y: number
}

export interface FloorEdge {
  a: string
  b: string
  bow: number
}

export interface Floor {
  canvas: HTMLCanvasElement
  ox: number
  oy: number
}

/** 地板画布至少盖住这块（画面坐标）。房间仍按点来挖，岩壁铺到这块边上。 */
export interface FloorCover {
  x: number
  y: number
  w: number
  h: number
}

export interface LightHole {
  x: number
  y: number
  r: number
  k: number
}

const MASK = PAL.river3
const floors = new Map<string, Floor>()
let veilCanvas: HTMLCanvasElement | null = null

function stampDisc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, hex: string): void {
  g.fillStyle = hex
  cx = Math.round(cx)
  cy = Math.round(cy)
  r = Math.round(r)
  const r2 = r * r
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(Math.max(0, r2 - y * y)))
    g.fillRect(cx - half, cy + y, half * 2 + 1, 1)
  }
}

function sampleCurve(ax: number, ay: number, bx: number, by: number, bow: number, n: number): [number, number][] {
  const dx = bx - ax, dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  const cx = (ax + bx) / 2 + (-dy / len) * bow
  const cy = (ay + by) / 2 + (dx / len) * bow
  const out: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const u = 1 - t
    out.push([
      u * u * ax + 2 * u * t * cx + t * t * bx,
      u * u * ay + 2 * u * t * cy + t * t * by,
    ])
  }
  return out
}

function hash(seed: number, n: number): number {
  let h = Math.imul(seed ^ Math.imul(n + 1, 0x9e3779b1), 0x7feb352d)
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b)
  return (h ^ (h >>> 16)) >>> 0
}

function rustGate(g: CanvasRenderingContext2D, x: number, y: number): void {
  x = Math.round(x)
  y = Math.round(y)
  g.fillStyle = PAL.copperD
  g.fillRect(x - 30, y - 10, 5, 22)
  g.fillRect(x + 24, y - 8, 5, 20)
  g.fillStyle = PAL.copper
  g.fillRect(x - 28, y - 10, 2, 22)
  g.fillRect(x + 26, y - 8, 2, 20)
  g.fillStyle = PAL.ink2
  g.fillRect(x - 12, y + 18, 8, 2)
  g.fillRect(x + 4, y + 20, 12, 2)
  g.fillStyle = PAL.stone
  g.fillRect(x - 8, y + 16, 6, 2)
}

function bones(g: CanvasRenderingContext2D, x: number, y: number): void {
  x = Math.round(x)
  y = Math.round(y)
  g.fillStyle = PAL.cream
  g.fillRect(x, y, 8, 2)
  g.fillRect(x + 3, y - 3, 2, 7)
  g.fillStyle = PAL.gray3
  g.fillRect(x + 1, y, 3, 1)
  g.fillStyle = PAL.ink2
  g.fillRect(x + 6, y + 3, 4, 2)
}

function shield(g: CanvasRenderingContext2D, x: number, y: number): void {
  x = Math.round(x)
  y = Math.round(y)
  g.fillStyle = PAL.gray1
  g.fillRect(x, y, 9, 11)
  g.fillStyle = PAL.copperD
  g.fillRect(x, y + 4, 9, 2)
  g.fillStyle = PAL.ink2
  g.fillRect(x + 3, y + 2, 3, 2)
  g.fillStyle = PAL.leaf
  g.fillRect(x + 1, y + 9, 4, 1)
}

function puddle(g: CanvasRenderingContext2D, x: number, y: number): void {
  stampDisc(g, x, y, 8, PAL.river1)
  g.fillStyle = PAL.river2
  g.fillRect(Math.round(x) - 2, Math.round(y) - 1, 4, 2)
  g.fillStyle = PAL.leaf
  g.fillRect(Math.round(x) - 7, Math.round(y) + 4, 5, 2)
}

export function mapFloor(
  seed: number,
  points: FloorPoint[],
  edges: FloorEdge[],
  opt: { cover?: FloorCover; scale?: number } = {},
): Floor {
  const sc = opt.scale ?? 1
  const cover = opt.cover
  const key = `${seed}|${sc.toFixed(3)}|${cover ? `${cover.x},${cover.y},${cover.w},${cover.h}` : '-'}|${points.map((p) => `${p.id}@${Math.round(p.x)},${Math.round(p.y)}`).join(';')}`
  const hit = floors.get(key)
  if (hit) return hit

  const pad = Math.max(8, Math.round(46 * sc))
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 0; maxY = 0 }
  minX -= pad
  minY -= pad
  maxX += pad
  maxY += pad
  if (cover) {
    minX = Math.min(minX, cover.x)
    minY = Math.min(minY, cover.y)
    maxX = Math.max(maxX, cover.x + cover.w)
    maxY = Math.max(maxY, cover.y + cover.h)
  }
  const ox = minX
  const oy = minY
  const w = Math.max(8, Math.ceil(maxX - minX))
  const h = Math.max(8, Math.ceil(maxY - minY))
  const { c, g } = makeCanvas(w, h)
  g.fillStyle = PAL.shadow
  g.fillRect(0, 0, w, h)
  g.fillStyle = MASK

  const at = new Map(points.map((p) => [p.id, p]))
  for (const p of points) {
    const x = p.x - ox
    const y = p.y - oy
    const room = Math.max(8, Math.round((p.id === 'hub' ? 36 : 26) * sc))
    stampDisc(g, x, y, room, MASK)
    const jx = (hash(seed, p.x * 17 + p.y) % 17) - 8
    const jy = (hash(seed, p.y * 13 - p.x) % 15) - 7
    stampDisc(g, x + jx * sc, y + jy * sc, Math.round(room * 0.62), MASK)
    stampDisc(g, x - jy * 0.6 * sc, y + jx * 0.5 * sc, Math.round(room * 0.48), MASK)
  }
  for (const e of edges) {
    const a = at.get(e.a), b = at.get(e.b)
    if (!a || !b) continue
    const pts = sampleCurve(a.x - ox, a.y - oy, b.x - ox, b.y - oy, e.bow, 14)
    for (const [x, y] of pts) stampDisc(g, x, y, Math.max(6, Math.round(13 * sc)), MASK)
  }

  const img = g.getImageData(0, 0, w, h)
  const d = img.data
  const mask = new Uint8Array(w * h)
  const [mr, mg, mb] = hexToRgb(MASK)
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    if (d[i] === mr && d[i + 1] === mg && d[i + 2] === mb) mask[p] = 1
  }
  const set = (x: number, y: number, hex: string) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const i = (y * w + x) * 4
    const [r, gg, b] = hexToRgb(hex)
    d[i] = r
    d[i + 1] = gg
    d[i + 2] = b
    d[i + 3] = 255
  }
  const tones = [PAL.stone, PAL.slate, PAL.tile1, PAL.tile2, PAL.stone, PAL.slate]
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x
      if (!mask[p]) {
        const row = Math.floor(y / 9)
        const oxb = (row & 1) * 5
        const col = Math.floor((x + oxb) / 11)
        const crack = ((x + oxb) % 11) === 0 || (y % 9) === 0
        if (crack) {
          set(x, y, PAL.ink)
          continue
        }
        const tone = hash(seed, col * 5 + row * 13)
        const wall = [PAL.ink2, PAL.slate, PAL.tile1, PAL.ink2, PAL.tile2]
        set(x, y, wall[tone % wall.length])
        if ((tone & 47) === 5) set(x, y, PAL.copperD)
        else if ((tone & 61) === 7) set(x, y, PAL.stone)
        continue
      }
      const up = y > 0 && mask[p - w] === 1
      const dn = y + 1 < h && mask[p + w] === 1
      const lf = x > 0 && mask[p - 1] === 1
      const rt = x + 1 < w && mask[p + 1] === 1
      if (!up) { set(x, y, PAL.stoneL); continue }
      if (!dn) { set(x, y, PAL.ink); continue }
      if (!lf || !rt) { set(x, y, PAL.ink2); continue }
      const row = Math.floor(y / 8)
      const oxb = (row & 1) * 7
      const col = Math.floor((x + oxb) / 14)
      const crack = ((x + oxb) % 14) === 0 || (y % 8) === 0
      if (crack) {
        const moss = (hash(seed, col * 19 + row * 7) & 7) === 0
        set(x, y, moss ? ((hash(seed, col + row) & 1) ? PAL.leaf : PAL.grassD) : PAL.ink2)
        continue
      }
      const tone = hash(seed, col * 3 + row * 11)
      set(x, y, tones[tone % tones.length])
      if ((tone & 63) === 4) set(x, y, PAL.copperD)
      else if ((tone & 97) === 6) set(x, y, PAL.redD)
    }
  }
  g.putImageData(img, 0, 0)

  const hub = at.get('hub')
  if (hub) rustGate(g, hub.x - ox, hub.y - oy)
  points.forEach((p, i) => {
    if (p.id === 'hub') return
    const hsh = hash(seed, i + 4)
    const x = p.x - ox
    const y = p.y - oy
    if (hsh % 5 === 0) bones(g, x + 18 * sc, y + 10 * sc)
    if (hsh % 7 === 0) shield(g, x - 24 * sc, y + 8 * sc)
    if (hsh % 6 === 1) puddle(g, x + 10 * sc, y - 16 * sc)
  })

  const floor: Floor = { canvas: c, ox, oy }
  floors.set(key, floor)
  return floor
}

/** 沿弯走廊铺一条沟。lit 的沟更亮，走过的带铜芯。 */
export function drawLink(
  g: CanvasRenderingContext2D,
  ax: number, ay: number, bx: number, by: number,
  bow: number,
  kind: 'dim' | 'seen' | 'walked',
): void {
  const pts = sampleCurve(ax, ay, bx, by, bow, 10)
  for (const [x, y] of pts) {
    const px = Math.round(x), py = Math.round(y)
    g.fillStyle = kind === 'dim' ? PAL.ink2 : PAL.slate
    g.fillRect(px - 2, py - 1, 5, 3)
    if (kind === 'walked') {
      g.fillStyle = PAL.copperD
      g.fillRect(px - 1, py, 2, 1)
    } else if (kind === 'seen') {
      g.fillStyle = PAL.stone
      g.fillRect(px, py, 1, 1)
    }
  }
}

/** 迷雾上再描一像素脉络，暗处也能顺着走廊看过去。 */
export function drawVein(
  g: CanvasRenderingContext2D,
  ax: number, ay: number, bx: number, by: number,
  bow: number,
): void {
  const pts = sampleCurve(ax, ay, bx, by, bow, 12)
  g.fillStyle = PAL.gray2
  for (const [x, y] of pts) g.fillRect(Math.round(x), Math.round(y), 1, 1)
}

/** 画在地板和节点之上：暗部仍能看见房间轮廓，光孔只开在已看见的节点上。 */
export function drawVeil(g: CanvasRenderingContext2D, holes: LightHole[]): void {
  if (!veilCanvas) veilCanvas = makeCanvas(640, 360).c
  const fg = veilCanvas.getContext('2d')!
  fg.setTransform(1, 0, 0, 1, 0, 0)
  fg.globalCompositeOperation = 'source-over'
  fg.clearRect(0, 0, 640, 360)
  fg.fillStyle = rgba(PAL.shadow, 0.74)
  fg.fillRect(0, 0, 640, 360)
  fg.globalCompositeOperation = 'destination-out'
  for (const h of holes) {
    const grad = fg.createRadialGradient(h.x, h.y, 2, h.x, h.y, h.r)
    grad.addColorStop(0, `rgba(0,0,0,${h.k})`)
    grad.addColorStop(0.55, `rgba(0,0,0,${(h.k * 0.5).toFixed(3)})`)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    fg.fillStyle = grad
    fg.beginPath()
    fg.arc(h.x, h.y, h.r, 0, Math.PI * 2)
    fg.fill()
  }
  fg.globalCompositeOperation = 'source-over'
  g.drawImage(veilCanvas, 0, 0)
}

let irisCanvas: HTMLCanvasElement | null = null

/**
 * 进节点：整屏压黑，只在角色身上留一个圆孔，再收到没。
 * r ≤ 1 时是全黑。
 */
export function drawIris(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  if (!irisCanvas) irisCanvas = makeCanvas(640, 360).c
  const fg = irisCanvas.getContext('2d')!
  fg.setTransform(1, 0, 0, 1, 0, 0)
  fg.globalCompositeOperation = 'source-over'
  fg.clearRect(0, 0, 640, 360)
  fg.fillStyle = PAL.shadow
  fg.fillRect(0, 0, 640, 360)
  if (r > 1) {
    fg.globalCompositeOperation = 'destination-out'
    const hole = Math.max(2, r)
    const grad = fg.createRadialGradient(cx, cy, hole * 0.55, cx, cy, hole)
    grad.addColorStop(0, 'rgba(0,0,0,1)')
    grad.addColorStop(0.78, 'rgba(0,0,0,1)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    fg.fillStyle = grad
    fg.beginPath()
    fg.arc(cx, cy, hole, 0, Math.PI * 2)
    fg.fill()
  }
  fg.globalCompositeOperation = 'source-over'
  g.drawImage(irisCanvas, 0, 0)
}
