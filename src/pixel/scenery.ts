/**
 * 程序化横版场面：天空 → 远景剪影 → 中景建筑（吊脚楼 / 居民楼 / 会馆）→ 近景地面栏杆灯笼，
 * 外加江面碎光、雾、萤火、轻轨。每套场面按 key 用固定种子烘焙，光源列表在夜里发光。
 * 见《视觉风格指南》第七、八节与《地区与景点》「日常横版场面」。
 */
import { PAL, rgba, mix } from './palette'
import { makeCanvas } from './dsl'
import { bakeSky, drawCelestial, drawStars, type TimeOfDay } from './sky'
import { shimmer, fog, fireflies, duskWash, nightWash, vignette } from './light'

export const GROUND_Y = 286
const LAYER_W = 1280

export interface SceneSet {
  key: string
  region: 1 | 2 | 3
  time: TimeOfDay
  kind: 'street' | 'dock' | 'hotpot' | 'steps' | 'view' | 'cable' | 'top' | 'fogsteps' | 'hall' | 'title' | 'shop'
}

export const SCENE_SETS: Record<string, SceneSet> = {
  title: { key: 'title', region: 1, time: 'dusk', kind: 'title' },
  l1_street: { key: 'l1_street', region: 1, time: 'day', kind: 'street' },
  l1_shop: { key: 'l1_shop', region: 1, time: 'day', kind: 'shop' },
  l1_dock: { key: 'l1_dock', region: 1, time: 'dusk', kind: 'dock' },
  l1_hotpot: { key: 'l1_hotpot', region: 1, time: 'night', kind: 'hotpot' },
  l2_steps: { key: 'l2_steps', region: 2, time: 'dusk', kind: 'steps' },
  l2_shop: { key: 'l2_shop', region: 2, time: 'dusk', kind: 'shop' },
  l2_view: { key: 'l2_view', region: 2, time: 'dusk', kind: 'view' },
  l2_cable: { key: 'l2_cable', region: 2, time: 'night', kind: 'cable' },
  l3_top: { key: 'l3_top', region: 3, time: 'night', kind: 'top' },
  l3_shop: { key: 'l3_shop', region: 3, time: 'night', kind: 'shop' },
  l3_fog: { key: 'l3_fog', region: 3, time: 'deep', kind: 'fogsteps' },
  l3_hall: { key: 'l3_hall', region: 3, time: 'deep', kind: 'hall' },
}

interface Light { x: number; y: number; r: number; hex: string; core?: boolean; flicker?: number }

interface Layers {
  far: HTMLCanvasElement
  mid: HTMLCanvasElement
  near: HTMLCanvasElement
  midLights: Light[]
  nearLights: Light[]
  farLights: Light[]
  /** 预烘焙的光晕层（一次 screen 合成代替几十次） */
  midGlow: HTMLCanvasElement
  nearGlow: HTMLCanvasElement
  farGlow: HTMLCanvasElement
}

/** 把一组光源烘成一张透明画布（source-over 叠加），运行时整张 screen 贴上 */
function bakeGlowLayer(w: number, h: number, lights: Light[], oy = 0): HTMLCanvasElement {
  const { c, g } = makeCanvas(w, h)
  for (const l of lights) {
    const r = l.r
    const grad = g.createRadialGradient(l.x, l.y + oy, 1, l.x, l.y + oy, r)
    grad.addColorStop(0, rgba(l.hex, 0.8))
    grad.addColorStop(0.4, rgba(l.hex, 0.32))
    grad.addColorStop(1, rgba(l.hex, 0))
    g.fillStyle = grad
    g.fillRect(l.x - r, l.y + oy - r, r * 2, r * 2)
    if (l.core) { g.fillStyle = PAL.lamp1; g.fillRect(Math.round(l.x), Math.round(l.y + oy), 1, 1) }
  }
  return c
}

function rng(seed: number) {
  let s = seed >>> 0 || 1
  return {
    next: () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff },
    int: (n: number) => Math.floor(((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * n),
    pick: <T>(a: T[]) => a[Math.floor(((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * a.length)],
  }
}
const hash = (str: string) => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) } return h >>> 0 }

type G = CanvasRenderingContext2D
const isNight = (t: TimeOfDay) => t === 'night' || t === 'deep'

/** 一栋老街铺面 / 吊脚楼：x 左缘，baseY 底边（地面），返回宽度 */
function house(g: G, r: ReturnType<typeof rng>, x: number, baseY: number, lights: Light[], night: boolean, opts: { stilts?: boolean; big?: boolean; shop?: boolean } = {}): number {
  const w = opts.big ? 96 : 34 + r.int(30)
  const floors = opts.big ? 4 : 1 + r.int(3)
  const fh = 26
  const stilt = opts.stilts ? 18 + r.int(14) : 0
  const bodyH = floors * fh
  const top = baseY - stilt - bodyH
  const wall = r.pick([PAL.cream, PAL.wood2, PAL.paperD, PAL.tan])
  const wallD = mix(wall, PAL.ink, 0.25)
  // 吊脚
  if (stilt) {
    g.fillStyle = PAL.wood1
    for (let px = x + 4; px < x + w - 3; px += 12) g.fillRect(px, baseY - stilt, 3, stilt)
    g.fillStyle = PAL.ink2
    g.fillRect(x + 2, baseY - stilt - 1, w - 4, 2)
  }
  // 墙
  g.fillStyle = wall
  g.fillRect(x, top, w, bodyH)
  g.fillStyle = wallD
  g.fillRect(x + w - 3, top, 3, bodyH)
  // 楼层线 / 木梁
  g.fillStyle = PAL.wood1
  for (let f = 1; f < floors; f++) g.fillRect(x, top + f * fh, w, 2)
  // 门（底层）
  g.fillStyle = PAL.wood1
  g.fillRect(x + 4, baseY - stilt - 18, 10, 18)
  if (opts.shop) {
    // 招牌 + 柜台
    g.fillStyle = PAL.lamp3
    g.fillRect(x + 2, top + 4, w - 4, 8)
    g.fillStyle = PAL.lamp1
    for (let i = 0; i < 3; i++) g.fillRect(x + 6 + i * 10, top + 6, 6, 4)
    g.fillStyle = PAL.wood2
    g.fillRect(x + 16, baseY - stilt - 14, w - 20, 14)
    g.fillStyle = PAL.wood3
    g.fillRect(x + 16, baseY - stilt - 14, w - 20, 2)
    g.fillStyle = PAL.sta
    g.fillRect(x + 20, baseY - stilt - 10, 6, 4)
    g.fillStyle = PAL.fruR
    g.fillRect(x + 30, baseY - stilt - 10, 6, 4)
  }
  // 窗
  for (let f = 0; f < floors; f++) {
    const wy = top + f * fh + 7
    for (let wx = x + 18; wx < x + w - 10; wx += 14) {
      if (f === 0 && wx < x + 18 && !stilt) continue
      const lit = night ? r.next() < 0.75 : false
      g.fillStyle = lit ? PAL.lamp1 : mix(wall, PAL.ink, 0.6)
      g.fillRect(wx, wy, 7, 9)
      g.fillStyle = PAL.wood1
      g.fillRect(wx + 3, wy, 1, 9)
      g.fillRect(wx, wy + 4, 7, 1)
      if (lit) lights.push({ x: wx + 3, y: wy + 4, r: 10, hex: PAL.lamp2, core: false })
    }
    // 栏杆（阁楼）
    if (f > 0 && r.next() < 0.6) {
      g.fillStyle = PAL.wood2
      g.fillRect(x - 2, top + f * fh + fh - 6, w + 4, 2)
      for (let bx = x; bx < x + w; bx += 5) g.fillRect(bx, top + f * fh + fh - 6, 1, 6)
    }
  }
  // 屋顶：瓦 + 挑檐
  const roofH = 10
  g.fillStyle = PAL.tile1
  g.fillRect(x - 5, top - roofH, w + 10, roofH)
  g.fillStyle = PAL.tile2
  for (let rx = x - 5; rx < x + w + 5; rx += 4) g.fillRect(rx, top - roofH + 2, 2, roofH - 4)
  g.fillStyle = PAL.ink2
  g.fillRect(x - 6, top - 1, w + 12, 2)
  // 檐角上翘
  g.fillStyle = PAL.tile1
  g.fillRect(x - 7, top - roofH - 2, 3, 4)
  g.fillRect(x + w + 4, top - roofH - 2, 3, 4)
  // 灯笼一对
  if (r.next() < 0.8) {
    for (const lx of [x + 2, x + w - 6]) {
      g.fillStyle = PAL.ink2
      g.fillRect(lx + 1, top + 1, 1, 3)
      g.fillStyle = PAL.lamp3
      g.fillRect(lx, top + 4, 4, 5)
      g.fillStyle = PAL.lamp2
      g.fillRect(lx + 1, top + 5, 2, 3)
      g.fillStyle = PAL.lamp1
      g.fillRect(lx + 1, top + 9, 2, 2)
      if (night) lights.push({ x: lx + 2, y: top + 6, r: 14, hex: PAL.lamp2, core: true, flicker: 1 })
    }
  }
  return w + 4 + r.int(6)
}

/** 半山居民楼：高、窄、灰 */
function tower(g: G, r: ReturnType<typeof rng>, x: number, baseY: number, lights: Light[], night: boolean): number {
  const w = 30 + r.int(26)
  const h = 70 + r.int(80)
  const top = baseY - h
  const c = r.pick([PAL.gray2, PAL.gray3, PAL.stoneL, PAL.paperD])
  g.fillStyle = c
  g.fillRect(x, top, w, h)
  g.fillStyle = mix(c, PAL.ink, 0.3)
  g.fillRect(x + w - 4, top, 4, h)
  g.fillStyle = mix(c, PAL.ink, 0.5)
  g.fillRect(x, top, w, 3)
  for (let wy = top + 8; wy < baseY - 10; wy += 12) {
    for (let wx = x + 4; wx < x + w - 6; wx += 9) {
      const lit = night ? r.next() < 0.55 : r.next() < 0.1
      g.fillStyle = lit ? PAL.lamp1 : mix(c, PAL.ink, 0.65)
      g.fillRect(wx, wy, 5, 6)
      if (lit && night) lights.push({ x: wx + 2, y: wy + 3, r: 8, hex: PAL.lamp2 })
    }
  }
  // 屋顶水箱 / 天线
  g.fillStyle = PAL.gray1
  g.fillRect(x + 6, top - 6, 8, 6)
  g.fillRect(x + w - 10, top - 10, 1, 10)
  return w + 2 + r.int(8)
}

/** 会馆门楼：红柱 + 大屋顶 + 灯 */
function hall(g: G, x: number, baseY: number, lights: Light[]): void {
  const w = 200, h = 120, top = baseY - h
  g.fillStyle = PAL.wood1
  g.fillRect(x, top + 20, w, h - 20)
  g.fillStyle = PAL.wood2
  g.fillRect(x + 4, top + 24, w - 8, h - 28)
  // 红柱
  g.fillStyle = PAL.lamp3
  for (const px of [x + 12, x + 60, x + w - 72, x + w - 24]) { g.fillRect(px, top + 20, 12, h - 20); g.fillStyle = PAL.redD; g.fillRect(px + 9, top + 20, 3, h - 20); g.fillStyle = PAL.lamp3 }
  // 大门
  g.fillStyle = PAL.ink2
  g.fillRect(x + 80, baseY - 60, 40, 60)
  g.fillStyle = PAL.lamp1
  g.fillRect(x + 84, baseY - 56, 32, 4)
  // 匾
  g.fillStyle = PAL.ink
  g.fillRect(x + 70, top + 28, 60, 16)
  g.fillStyle = PAL.gold
  g.fillRect(x + 72, top + 30, 56, 12)
  // 大屋顶
  g.fillStyle = PAL.tile1
  g.fillRect(x - 20, top, w + 40, 22)
  g.fillStyle = PAL.tile2
  for (let rx = x - 20; rx < x + w + 20; rx += 5) g.fillRect(rx, top + 3, 2, 16)
  g.fillStyle = PAL.tile1
  g.fillRect(x - 28, top - 6, 10, 8)
  g.fillRect(x + w + 18, top - 6, 10, 8)
  g.fillStyle = PAL.ink2
  g.fillRect(x - 22, top + 20, w + 44, 3)
  // 灯笼一排
  for (let i = 0; i < 6; i++) {
    const lx = x + 20 + i * 32
    g.fillStyle = PAL.lamp3
    g.fillRect(lx, top + 26, 6, 8)
    g.fillStyle = PAL.lamp2
    g.fillRect(lx + 1, top + 27, 4, 5)
    lights.push({ x: lx + 3, y: top + 30, r: 18, hex: PAL.lamp2, core: true, flicker: 1 })
  }
  lights.push({ x: x + 100, y: baseY - 30, r: 40, hex: PAL.lamp1 })
}

function bakeLayers(set: SceneSet): Layers {
  const r = rng(hash(set.key))
  const night = isNight(set.time)
  const far = makeCanvas(LAYER_W, 140)
  const mid = makeCanvas(LAYER_W, 200)
  const near = makeCanvas(LAYER_W, 80)
  const midLights: Light[] = [], nearLights: Light[] = [], farLights: Light[] = []
  const fg = far.g, mg = mid.g, ng = near.g
  const MID_BASE = 200 // mid 画布底边 = 地面

  // ---- 远景 ----
  if (set.region === 1 || set.kind === 'title') {
    // 对岸楼群剪影 + 山
    const tint = night ? PAL.night2 : set.time === 'dusk' ? mix(PAL.sky2, PAL.sky3, 0.4) : mix('#6fb7e8', PAL.gray3, 0.5)
    fg.fillStyle = mix(tint, PAL.ink, 0.15)
    for (let x = 0; x < LAYER_W; x += 6) {
      const h = 30 + Math.sin(x / 90) * 14 + Math.sin(x / 37) * 8
      fg.fillRect(x, 140 - h, 6, h)
    }
    fg.fillStyle = tint
    let x = 0
    while (x < LAYER_W) {
      const w = 10 + r.int(24), h = 30 + r.int(70)
      fg.fillRect(x, 140 - h, w, h)
      if (night) for (let k = 0; k < 6; k++) { const wx = x + 2 + r.int(Math.max(1, w - 3)), wy = 140 - h + 4 + r.int(Math.max(1, h - 8)); fg.fillStyle = PAL.lamp1; fg.fillRect(wx, wy, 1, 1); fg.fillStyle = tint }
      x += w + 2 + r.int(6)
    }
    // 索道线
    fg.fillStyle = rgba(PAL.ink2, 0.6)
    for (let i = 0; i < LAYER_W; i += 2) fg.fillRect(i, 40 + Math.round(Math.sin(i / 400) * 10), 1, 1)
  } else if (set.region === 2) {
    const tint = night ? PAL.night2 : mix(PAL.sky2, PAL.gray2, 0.4)
    fg.fillStyle = mix(tint, PAL.ink, 0.1)
    for (let x = 0; x < LAYER_W; x += 4) {
      const h = 50 + Math.sin(x / 140) * 30 + Math.sin(x / 53) * 12
      fg.fillRect(x, 140 - h, 4, h)
    }
    fg.fillStyle = tint
    for (let i = 0; i < 90; i++) {
      const x = r.int(LAYER_W), w = 6 + r.int(12), base = 140 - (50 + Math.sin(x / 140) * 30 + Math.sin(x / 53) * 12), h = 10 + r.int(30)
      fg.fillRect(x, base - h + 4, w, h)
    }
  } else {
    // 山顶：脚下灯海
    fg.fillStyle = rgba(PAL.night1, 0.9)
    fg.fillRect(0, 60, LAYER_W, 80)
    for (let i = 0; i < 700; i++) {
      const x = r.int(LAYER_W), y = 70 + Math.floor(Math.pow(r.next(), 0.6) * 70)
      fg.fillStyle = r.next() < 0.7 ? PAL.lamp1 : r.next() < 0.5 ? PAL.lamp2 : PAL.river3
      fg.fillRect(x, y, 1, 1)
    }
    for (let i = 0; i < 40; i++) farLights.push({ x: r.int(LAYER_W), y: 80 + r.int(50), r: 6, hex: PAL.lamp2 })
  }

  // ---- 中景 ----
  if (set.kind === 'street' || set.kind === 'title' || set.kind === 'shop' || set.kind === 'dock') {
    let x = -10
    let shopPlaced = false
    while (x < LAYER_W) {
      const isShop = set.kind === 'shop' && !shopPlaced && x > 560 && x < 700
      if (isShop) shopPlaced = true
      x += house(mg, r, x, MID_BASE, midLights, night, { stilts: set.kind === 'dock' || set.kind === 'title' || r.next() < 0.3, shop: isShop })
    }
    if (set.kind === 'dock' || set.kind === 'title') {
      // 江堤：石阶
      mg.fillStyle = PAL.gray1
      mg.fillRect(0, MID_BASE - 6, LAYER_W, 6)
      mg.fillStyle = PAL.gray2
      for (let sx = 0; sx < LAYER_W; sx += 8) mg.fillRect(sx, MID_BASE - 6, 4, 1)
    }
  } else if (set.kind === 'hotpot') {
    let x = -10
    while (x < LAYER_W) {
      if (x > 560 && x < 700) { x += house(mg, r, x, MID_BASE, midLights, true, { big: true }); continue }
      x += house(mg, r, x, MID_BASE, midLights, true, { stilts: true })
    }
  } else if (set.kind === 'steps' || set.kind === 'view' || set.kind === 'cable') {
    let x = -10
    while (x < LAYER_W) x += tower(mg, r, x, MID_BASE - (set.kind === 'steps' ? 10 : 0), midLights, night)
    if (set.kind === 'view') {
      // 高架轨道
      mg.fillStyle = PAL.gray1
      mg.fillRect(0, MID_BASE - 118, LAYER_W, 8)
      mg.fillStyle = PAL.gray2
      mg.fillRect(0, MID_BASE - 118, LAYER_W, 2)
      for (let px = 20; px < LAYER_W; px += 90) { mg.fillStyle = PAL.gray1; mg.fillRect(px, MID_BASE - 110, 10, 110) }
    }
    if (set.kind === 'cable') {
      mg.fillStyle = PAL.gray1
      mg.fillRect(600, MID_BASE - 140, 80, 140)
      mg.fillStyle = PAL.gray2
      mg.fillRect(604, MID_BASE - 136, 72, 30)
      mg.fillStyle = rgba(PAL.gray3, 0.9)
      for (let i = 0; i < LAYER_W; i += 2) mg.fillRect(i, MID_BASE - 150 + Math.round(Math.sin(i / 300) * 12), 1, 1)
      midLights.push({ x: 640, y: MID_BASE - 120, r: 30, hex: PAL.lamp1 })
    }
  } else if (set.kind === 'hall') {
    // 树影 + 会馆
    for (let i = 0; i < 30; i++) { const x = r.int(LAYER_W), rr = 14 + r.int(16); mg.fillStyle = mix(PAL.grassD, PAL.night1, 0.5); mg.beginPath(); mg.arc(x, MID_BASE - 30 - r.int(30), rr, 0, 7); mg.fill() }
    hall(mg, 540, MID_BASE, midLights)
  } else {
    // 山顶观景台 / 雾中石阶：树、栏杆、石阶
    for (let i = 0; i < 36; i++) { const x = r.int(LAYER_W), rr = 12 + r.int(18); mg.fillStyle = mix(PAL.grassD, PAL.night1, 0.45 + r.next() * 0.2); mg.beginPath(); mg.arc(x, MID_BASE - 24 - r.int(40), rr, 0, 7); mg.fill() }
    mg.fillStyle = PAL.stone
    mg.fillRect(0, MID_BASE - 14, LAYER_W, 14)
    mg.fillStyle = PAL.stoneL
    for (let sx = 0; sx < LAYER_W; sx += 10) mg.fillRect(sx, MID_BASE - 14, 6, 1)
    if (set.kind === 'top') {
      // 观景台栏杆
      mg.fillStyle = PAL.gray3
      mg.fillRect(0, MID_BASE - 40, LAYER_W, 3)
      for (let px = 0; px < LAYER_W; px += 12) mg.fillRect(px, MID_BASE - 40, 2, 26)
      for (let px = 60; px < LAYER_W; px += 180) { mg.fillStyle = PAL.gray1; mg.fillRect(px, MID_BASE - 60, 4, 46); mg.fillStyle = PAL.lamp1; mg.fillRect(px - 2, MID_BASE - 66, 8, 6); midLights.push({ x: px + 2, y: MID_BASE - 63, r: 22, hex: PAL.lamp1, core: true }) }
    }
  }

  // ---- 近景：地面 + 栏杆 / 灯笼杆 ----
  const groundC = set.region === 1 ? (set.kind === 'dock' || set.kind === 'title' ? PAL.gray1 : PAL.gray2) : set.region === 2 ? PAL.stone : PAL.slate
  ng.fillStyle = groundC
  ng.fillRect(0, 0, LAYER_W, 80)
  ng.fillStyle = mix(groundC, PAL.white, 0.15)
  for (let sx = 0; sx < LAYER_W; sx += 16) { ng.fillRect(sx, 0, 8, 1); ng.fillRect(sx + 8, 6, 8, 1); ng.fillRect(sx, 14, 6, 1) }
  ng.fillStyle = mix(groundC, PAL.ink, 0.3)
  for (let sx = 4; sx < LAYER_W; sx += 16) { ng.fillRect(sx, 3, 1, 1); ng.fillRect(sx + 9, 10, 1, 1) }
  ng.fillStyle = rgba(PAL.ink, 0.5)
  ng.fillRect(0, 0, LAYER_W, 1)
  if (set.kind === 'dock' || set.kind === 'title') {
    // 江水在近景下缘
    ng.fillStyle = PAL.river1
    ng.fillRect(0, 26, LAYER_W, 54)
    ng.fillStyle = PAL.river2
    for (let sx = 0; sx < LAYER_W; sx += 14) ng.fillRect(sx + (Math.floor(sx / 14) % 2) * 5, 30 + (Math.floor(sx / 14) % 3) * 9, 8, 1)
    ng.fillStyle = PAL.gray1
    ng.fillRect(0, 22, LAYER_W, 4)
    // 系船桩
    for (let px = 40; px < LAYER_W; px += 220) { ng.fillStyle = PAL.wood1; ng.fillRect(px, 14, 6, 10) }
  }
  // 灯笼杆（近景，夜里发光）
  for (let px = 80; px < LAYER_W; px += 240) {
    ng.fillStyle = PAL.wood1
    ng.fillRect(px, -40, 3, 44)
    if (night || set.time === 'dusk') nearLights.push({ x: px + 1, y: -30, r: 22, hex: PAL.lamp2, core: true, flicker: 1 })
  }

  return {
    far: far.c, mid: mid.c, near: near.c, midLights, nearLights, farLights,
    midGlow: bakeGlowLayer(LAYER_W, 200, midLights),
    nearGlow: bakeGlowLayer(LAYER_W, 80, nearLights, 60),
    farGlow: bakeGlowLayer(LAYER_W, 140, farLights),
  }
}

const layerCache = new Map<string, Layers>()

export class Scenery {
  readonly set: SceneSet
  private L: Layers
  private sky: HTMLCanvasElement
  private trainX = -200
  private trainT = 0

  constructor(setKey: string) {
    this.set = SCENE_SETS[setKey] ?? SCENE_SETS.l1_street
    let L = layerCache.get(this.set.key)
    if (!L) { L = bakeLayers(this.set); layerCache.set(this.set.key, L) }
    this.L = L
    this.sky = bakeSky(this.set.time, 640, 240)
  }

  get night(): boolean { return isNight(this.set.time) }

  update(dt: number): void {
    if (this.set.kind === 'view') {
      this.trainT += dt
      if (this.trainT > 18) { this.trainT = 0; this.trainX = -160 }
      if (this.trainX < 900) this.trainX += dt * 140
    }
  }

  /** 背景（角色之前） */
  drawBack(g: G, camX: number, t: number): void {
    g.drawImage(this.sky, 0, 0)
    if (this.night) drawStars(g, hash(this.set.key), t)
    drawCelestial(g, this.set.time, this.set.time === 'day' ? 520 : 480, this.set.time === 'day' ? 50 : 70)
    const farX = -Math.round(camX * 0.15) % LAYER_W
    const midX = -Math.round(camX * 0.45) % LAYER_W
    const nearX = -Math.round(camX) % LAYER_W
    this.tile(g, this.L.far, farX, GROUND_Y - 140 - 30)
    if (this.set.kind === 'view') this.drawTrain(g, midX)
    this.tile(g, this.L.mid, midX, GROUND_Y - 200)
    this.tile(g, this.L.near, nearX, GROUND_Y)
    // 远景灯（山顶灯海）：整层 screen 一次
    if (this.L.farLights.length) {
      g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.45 + 0.15 * Math.sin(t * 2)
      this.tile(g, this.L.farGlow, farX, GROUND_Y - 170)
      g.restore()
    }
  }

  /** 前景光效（角色之后） */
  drawFront(g: G, camX: number, t: number): void {
    const midX = -Math.round(camX * 0.45) % LAYER_W
    const nearX = -Math.round(camX) % LAYER_W
    if (this.night || this.set.time === 'dusk') {
      g.save()
      g.globalCompositeOperation = 'screen'
      g.globalAlpha = (this.night ? 0.85 : 0.35) * (0.9 + 0.1 * Math.sin(t * 5))
      this.tile(g, this.L.midGlow, midX, GROUND_Y - 200)
      g.globalAlpha = this.night ? 0.9 : 0.45
      this.tile(g, this.L.nearGlow, nearX, GROUND_Y - 60)
      g.restore()
    }
    if (this.set.kind === 'dock' || this.set.kind === 'title') shimmer(g, t, 0, GROUND_Y + 28, 640, 30, 30, hash(this.set.key), this.night ? PAL.lamp1 : PAL.river3)
    if (this.set.region === 2 && this.set.kind !== 'cable' && this.night) fireflies(g, t, 40, 200, 560, 80, 8)
    if (this.set.time === 'dusk') duskWash(g, 0.12)
    if (this.night) nightWash(g, this.set.time === 'deep' ? 0.32 : 0.22)
    if (this.set.region === 3) fog(g, t, this.set.kind === 'fogsteps' ? 240 : 290, this.set.kind === 'fogsteps' ? 0.5 : 0.3, this.set.kind === 'fogsteps' ? 9 : 5, hash(this.set.key))
    vignette(g, 0.3)
  }

  private tile(g: G, img: HTMLCanvasElement, x: number, y: number): void {
    let px = x
    if (px > 0) px -= LAYER_W
    for (; px < 640; px += LAYER_W) g.drawImage(img, px, y)
  }

  private drawTrain(g: G, midX: number): void {
    const y = GROUND_Y - 200 + 200 - 118 - 22
    const x = this.trainX
    for (let i = 0; i < 2; i++) {
      const cx = Math.round(x - i * 70)
      g.fillStyle = PAL.gray3
      g.fillRect(cx, y, 64, 20)
      g.fillStyle = PAL.fruG
      g.fillRect(cx, y + 14, 64, 4)
      g.fillStyle = PAL.lamp1
      for (let wx = cx + 4; wx < cx + 60; wx += 10) g.fillRect(wx, y + 4, 6, 7)
      g.fillStyle = PAL.ink2
      g.fillRect(cx, y + 19, 64, 2)
    }
    void midX
  }
}

