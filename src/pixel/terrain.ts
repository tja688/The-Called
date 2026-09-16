/**
 * 俯视底图（旅游地图 800×480）与牌局桌面材质（640×220）——全部程序生成、按 seed 烘焙。
 */
import { PAL, mix, rgba } from './palette'
import { makeCanvas } from './dsl'

type G = CanvasRenderingContext2D
export const MAP_W = 800
export const MAP_H = 480

function rng(seed: number) {
  let s = seed >>> 0 || 1
  const next = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
  return { next, int: (n: number) => Math.floor(next() * n), pick: <T>(a: T[]) => a[Math.floor(next() * a.length)] }
}

/** 江畔底图的江心线（与 bakeMapBase 里画江的公式一致） */
const RIVER_Y = (x: number) => 380 - x * 0.28 + Math.sin(x / 90) * 18
const inRiver = (x: number, y: number) => Math.abs(y - RIVER_Y(x)) < 46 || (x > 536 && x < 584 && y < 200)

function roofs(g: G, r: ReturnType<typeof rng>, x0: number, y0: number, w: number, h: number, n: number, warm: boolean): void {
  for (let i = 0; i < n; i++) {
    const x = x0 + r.int(w), y = y0 + r.int(h), rw = 8 + r.int(14), rh = 6 + r.int(10)
    if (warm && inRiver(x + rw / 2, y + rh / 2)) continue
    g.fillStyle = r.pick([PAL.tile1, PAL.tile2, warm ? PAL.wood1 : PAL.gray1])
    g.fillRect(x, y, rw, rh)
    g.fillStyle = r.pick([PAL.tile2, PAL.gray2])
    g.fillRect(x + 1, y + 1, rw - 2, 1)
    if (warm && r.next() < 0.5) { g.fillStyle = PAL.lamp3; g.fillRect(x + rw - 2, y + rh - 2, 2, 2) }
  }
}
function trees(g: G, r: ReturnType<typeof rng>, x0: number, y0: number, w: number, h: number, n: number, dark = false, avoidRiver = false): void {
  for (let i = 0; i < n; i++) {
    const x = x0 + r.int(w), y = y0 + r.int(h), rr = 4 + r.int(5)
    if (avoidRiver && inRiver(x, y)) continue
    g.fillStyle = dark ? PAL.grassD : r.pick([PAL.grass, PAL.grassD, PAL.leaf])
    g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill()
    g.fillStyle = dark ? PAL.leaf : PAL.leafL
    g.fillRect(x - 1, y - rr + 1, 2, 2)
  }
}

const mapCache = new Map<string, HTMLCanvasElement>()

export function bakeMapBase(layer: number, seed: number): HTMLCanvasElement {
  const key = `${layer}:${seed}`
  const hit = mapCache.get(key)
  if (hit) return hit
  const r = rng(seed ^ (layer * 7919))
  const { c, g } = makeCanvas(MAP_W, MAP_H)
  if (layer === 1) {
    g.fillStyle = PAL.tanL
    g.fillRect(0, 0, MAP_W, MAP_H)
    // 纸纹
    g.fillStyle = PAL.paperD
    for (let i = 0; i < 900; i++) g.fillRect(r.int(MAP_W), r.int(MAP_H), 2, 1)
    // 两江：一条从左下到右上的大江 + 一条从上方汇入
    g.fillStyle = PAL.river2
    for (let x = 0; x < MAP_W; x += 2) {
      const cy = 380 - x * 0.28 + Math.sin(x / 90) * 18
      g.fillRect(x, cy - 34, 2, 68)
    }
    g.fillStyle = PAL.river1
    for (let x = 0; x < MAP_W; x += 2) { const cy = 380 - x * 0.28 + Math.sin(x / 90) * 18; g.fillRect(x, cy + 24, 2, 10) }
    g.fillStyle = PAL.river3
    for (let i = 0; i < 160; i++) { const x = r.int(MAP_W); const cy = 380 - x * 0.28 + Math.sin(x / 90) * 18; g.fillRect(x, cy - 30 + r.int(56), 3, 1) }
    g.fillStyle = PAL.river2
    for (let y = 0; y < 200; y += 2) { const cx = 560 + Math.sin(y / 60) * 16; g.fillRect(cx - 18, y, 36, 2) }
    // 江岸沙滩
    g.fillStyle = PAL.tan
    for (let x = 0; x < MAP_W; x += 2) { const cy = 380 - x * 0.28 + Math.sin(x / 90) * 18; g.fillRect(x, cy - 38, 2, 4); g.fillRect(x, cy + 34, 2, 4) }
    // 桥
    g.fillStyle = PAL.gray3
    g.fillRect(300, 250, 8, 100)
    g.fillStyle = PAL.lamp3
    g.fillRect(300, 250, 8, 2); g.fillRect(300, 348, 8, 2)
    // 屋顶群与树
    roofs(g, r, 20, 20, 480, 260, 140, true)
    roofs(g, r, 400, 300, 380, 170, 60, true)
    roofs(g, r, 0, 300, 300, 170, 40, true)
    trees(g, r, 0, 0, MAP_W, 260, 60, false, true)
    trees(g, r, 420, 320, 360, 150, 26, false, true)
    // 石板巷
    g.fillStyle = PAL.gray2
    for (let i = 0; i < 14; i++) { const x = r.int(MAP_W), y = r.int(300), len = 40 + r.int(80); g.fillRect(x, y, len, 3) }
  } else if (layer === 2) {
    g.fillStyle = mix(PAL.stoneL, PAL.grass, 0.25)
    g.fillRect(0, 0, MAP_W, MAP_H)
    // 等高线
    for (let k = 0; k < 9; k++) {
      g.fillStyle = rgba(PAL.stone, 0.35)
      for (let x = 0; x < MAP_W; x += 2) { const y = 60 + k * 46 + Math.sin(x / 120 + k) * 14 + Math.sin(x / 41) * 5; g.fillRect(x, y, 2, 1) }
    }
    // 台阶
    g.fillStyle = PAL.gray3
    for (let i = 0; i < 26; i++) { const x = r.int(MAP_W), y = r.int(MAP_H); for (let s = 0; s < 6; s++) g.fillRect(x, y + s * 3, 10, 1) }
    // 轨道
    g.fillStyle = PAL.gray1
    for (let x = 0; x < MAP_W; x += 6) { const y = 240 + Math.sin(x / 150) * 40; g.fillRect(x, y, 4, 2) }
    // 索道线
    g.fillStyle = PAL.ink2
    for (let x = 0; x < MAP_W; x += 3) g.fillRect(x, 120 + x * 0.25, 1, 1)
    roofs(g, r, 0, 0, MAP_W, MAP_H, 220, false)
    trees(g, r, 0, 0, MAP_W, MAP_H, 90)
  } else {
    g.fillStyle = mix(PAL.night2, PAL.grassD, 0.35)
    g.fillRect(0, 0, MAP_W, MAP_H)
    // 松林
    for (let i = 0; i < 260; i++) {
      const x = r.int(MAP_W), y = r.int(MAP_H), h = 8 + r.int(10)
      g.fillStyle = r.pick([PAL.grassD, mix(PAL.grassD, PAL.night1, 0.4), PAL.leaf])
      g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + 5, y); g.lineTo(x - 5, y); g.fill()
    }
    // 石阶路
    g.fillStyle = PAL.stoneL
    for (let i = 0; i < 20; i++) { const x = r.int(MAP_W), y = r.int(MAP_H); for (let s = 0; s < 5; s++) g.fillRect(x, y + s * 3, 8, 1) }
    // 灯
    for (let i = 0; i < 80; i++) { g.fillStyle = PAL.lamp1; g.fillRect(r.int(MAP_W), r.int(MAP_H), 1, 1) }
    // 云海（底部）
    for (let i = 0; i < 40; i++) {
      const x = r.int(MAP_W), y = 360 + r.int(120), w = 60 + r.int(120), h = 14 + r.int(16)
      g.fillStyle = rgba(PAL.fog, 0.35 + r.next() * 0.3)
      g.beginPath(); g.ellipse(x, y, w / 2, h / 2, 0, 0, 7); g.fill()
    }
    for (let i = 0; i < 24; i++) {
      const x = r.int(MAP_W), y = r.int(140), w = 50 + r.int(90), h = 12 + r.int(12)
      g.fillStyle = rgba(PAL.fog, 0.25 + r.next() * 0.2)
      g.beginPath(); g.ellipse(x, y, w / 2, h / 2, 0, 0, 7); g.fill()
    }
  }
  mapCache.set(key, c)
  return c
}

export type TableKind = 'bamboo' | 'stone' | 'copper' | 'wood' | 'rail' | 'cable' | 'topstone' | 'hall'

const tableCache = new Map<string, HTMLCanvasElement>()

/** 桌面材质 640×220（放在 y=70..290） */
export function bakeTable(kind: TableKind): HTMLCanvasElement {
  const hit = tableCache.get(kind)
  if (hit) return hit
  const W = 640, H = 220
  const { c, g } = makeCanvas(W, H)
  const r = rng(kind.length * 977 + 13)
  if (kind === 'bamboo') {
    for (let x = 0; x < W; x += 14) {
      g.fillStyle = (x / 14) % 2 ? PAL.bamboo : mix(PAL.bamboo, PAL.bambooD, 0.35)
      g.fillRect(x, 0, 14, H)
      g.fillStyle = PAL.bambooD
      g.fillRect(x + 13, 0, 1, H)
      g.fillStyle = mix(PAL.bamboo, PAL.white, 0.25)
      g.fillRect(x + 1, 0, 1, H)
      for (let y = 20 + r.int(60); y < H; y += 70 + r.int(50)) { g.fillStyle = PAL.bambooD; g.fillRect(x, y, 14, 2) }
    }
  } else if (kind === 'stone' || kind === 'topstone' || kind === 'rail') {
    const base = kind === 'rail' ? PAL.slate : PAL.stone
    g.fillStyle = base
    g.fillRect(0, 0, W, H)
    for (let y = 0; y < H; y += 28) for (let x = ((y / 28) % 2) * 22; x < W; x += 44) {
      g.fillStyle = mix(base, r.next() < 0.5 ? PAL.white : PAL.ink, 0.06 + r.next() * 0.08)
      g.fillRect(x + 1, y + 1, 42, 26)
      g.fillStyle = mix(base, PAL.white, 0.18)
      g.fillRect(x + 1, y + 1, 42, 1)
    }
    if (kind === 'topstone') for (let i = 0; i < 120; i++) { g.fillStyle = rgba(PAL.grassD, 0.5); g.fillRect(r.int(W), r.int(H), 2 + r.int(3), 1) }
  } else if (kind === 'cable') {
    g.fillStyle = PAL.gray1
    g.fillRect(0, 0, W, H)
    g.fillStyle = PAL.gray2
    for (let y = 0; y < H; y += 10) g.fillRect(0, y, W, 4)
    g.fillStyle = PAL.gray3
    for (let x = 6; x < W; x += 24) for (let y = 5; y < H; y += 40) g.fillRect(x, y, 2, 2)
    // 车窗外江景一角（上沿）
    g.fillStyle = PAL.river1
    g.fillRect(0, 0, W, 18)
    g.fillStyle = PAL.river3
    for (let i = 0; i < 60; i++) g.fillRect(r.int(W), 2 + r.int(14), 3, 1)
  } else {
    // wood / copper / hall：木板
    const a = kind === 'hall' ? PAL.redD : kind === 'copper' ? PAL.wood1 : PAL.wood2
    const b = kind === 'hall' ? mix(PAL.redD, PAL.ink, 0.3) : kind === 'copper' ? mix(PAL.wood1, PAL.ink, 0.25) : PAL.wood3
    for (let y = 0; y < H; y += 18) {
      g.fillStyle = (y / 18) % 2 ? a : mix(a, b, 0.4)
      g.fillRect(0, y, W, 18)
      g.fillStyle = b
      g.fillRect(0, y + 17, W, 1)
      g.fillStyle = mix(a, PAL.white, 0.12)
      g.fillRect(0, y + 1, W, 1)
      for (let i = 0; i < 6; i++) { const x = r.int(W); g.fillStyle = b; g.fillRect(x, y + 4, 10 + r.int(30), 1) }
    }
  }
  // 桌边（上下沿）
  g.fillStyle = rgba(PAL.ink, 0.35)
  g.fillRect(0, 0, W, 3)
  g.fillRect(0, H - 3, W, 3)
  tableCache.set(kind, c)
  return c
}
