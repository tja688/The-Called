/**
 * 锈门层室内场面：石墙、地砖、锈栅、壁灯。没有天光。
 * 角色站在 GROUND_Y。光效走渐变；砖和栅栏只 fillRect。
 */
import { PAL, rgba, mix } from './palette'
import { makeCanvas } from './dsl'
import { duskWash, nightWash, vignette } from './light'

export const GROUND_Y = 286

export type RoomKey =
  | 'gate' | 'foyer' | 'corridor' | 'side' | 'nest' | 'slime' | 'boss'
  | 'shop' | 'well' | 'forge' | 'chest' | 'event'

interface Light { x: number; y: number; r: number; hex: string }

interface BakedRoom {
  back: HTMLCanvasElement
  glow: HTMLCanvasElement
  lights: Light[]
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
type R = ReturnType<typeof rng>

function bakeGlow(w: number, h: number, lights: Light[]): HTMLCanvasElement {
  const { c, g } = makeCanvas(w, h)
  for (const l of lights) {
    const grad = g.createRadialGradient(l.x, l.y, 1, l.x, l.y, l.r)
    grad.addColorStop(0, rgba(l.hex, 0.72))
    grad.addColorStop(0.4, rgba(l.hex, 0.28))
    grad.addColorStop(1, rgba(l.hex, 0))
    g.fillStyle = grad
    g.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2)
  }
  return c
}

function brickWall(g: G, r: R, x: number, y: number, w: number, h: number, dark = false): void {
  g.fillStyle = dark ? PAL.ink2 : PAL.tile1
  g.fillRect(x, y, w, h)
  for (let row = 0, i = 0; row < h; row += 8, i++) {
    const ox = (i % 2) * 7
    for (let col = -8; col < w; col += 15) {
      const bx = x + col + ox, by = y + row
      if (bx > x + w || by > y + h) continue
      g.fillStyle = mix(dark ? PAL.ink2 : PAL.tile1, r.next() < 0.5 ? PAL.stone : PAL.slate, 0.18 + r.next() * 0.12)
      g.fillRect(bx, by, 14, 7)
      g.fillStyle = mix(PAL.tile1, PAL.cream, dark ? 0.04 : 0.08)
      g.fillRect(bx, by, 14, 1)
      if (r.next() < 0.2) {
        g.fillStyle = PAL.leaf
        g.fillRect(bx + 2 + r.int(8), by + 6, 3 + r.int(4), 1)
      }
      if (r.next() < 0.05) {
        g.fillStyle = PAL.copperD
        g.fillRect(bx + 3 + r.int(6), by + 2, 2, 1)
      }
    }
  }
}

function stoneFloor(g: G, r: R, x: number, y: number, w: number, h: number, blood = false): void {
  g.fillStyle = PAL.slate
  g.fillRect(x, y, w, h)
  const tw = 20, th = 14
  for (let row = 0, i = 0; row < h; row += th, i++) {
    const ox = (i % 2) * 10
    for (let col = -10; col < w; col += tw) {
      const bx = x + col + ox, by = y + row
      g.fillStyle = r.pick([PAL.stone, PAL.tile1, PAL.slate, mix(PAL.stone, PAL.ink2, 0.2)])
      g.fillRect(bx, by, tw - 1, th - 1)
      g.fillStyle = mix(PAL.stoneL, PAL.cream, 0.15)
      g.fillRect(bx, by, tw - 1, 1)
      g.fillStyle = PAL.leaf
      if (r.next() < 0.45) g.fillRect(bx + 1, by + th - 2, 4 + r.int(8), 1)
      if (blood && r.next() < 0.12) {
        g.fillStyle = PAL.redD
        g.fillRect(bx + 2 + r.int(10), by + 3 + r.int(6), 3, 1)
      } else if (r.next() < 0.06) {
        g.fillStyle = PAL.copperD
        g.fillRect(bx + 4 + r.int(8), by + 4, 2, 1)
      }
    }
  }
}

function rustBars(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle = PAL.copperD
  g.fillRect(x, y, w, 2)
  g.fillRect(x, y + h - 2, w, 2)
  for (let i = 0; i < w; i += 7) {
    g.fillStyle = i % 14 === 0 ? PAL.gray1 : PAL.copperD
    g.fillRect(x + i, y, 2, h)
  }
}

function wallLamp(g: G, lights: Light[], x: number, y: number, lit = true): void {
  g.fillStyle = PAL.copperD
  g.fillRect(x, y + 7, 7, 3)
  g.fillStyle = PAL.gray1
  g.fillRect(x + 1, y + 4, 5, 4)
  if (lit) {
    g.fillStyle = PAL.lamp2
    g.fillRect(x + 2, y, 3, 5)
    g.fillStyle = PAL.lamp1
    g.fillRect(x + 3, y + 1, 1, 3)
    lights.push({ x: x + 3, y: y + 2, r: 32, hex: PAL.lamp2 })
  } else {
    g.fillStyle = PAL.ink2
    g.fillRect(x + 2, y + 1, 3, 4)
  }
  g.fillStyle = PAL.ink2
  g.fillRect(x + 3, y - 5, 1, 4)
  g.fillRect(x + 2, y - 7, 1, 2)
}

function rustGate(g: G, x: number, y: number, w: number, h: number, lean = 0): void {
  for (let i = 0; i < w; i += 8) {
    const dx = Math.round((i / w) * lean)
    g.fillStyle = i % 16 === 0 ? PAL.gray1 : PAL.copperD
    g.fillRect(x + i + dx, y, 4, h)
  }
  g.fillStyle = PAL.copper
  g.fillRect(x + lean, y + 8, w, 4)
  g.fillRect(x, y + h - 16, w + lean, 4)
  g.fillStyle = PAL.ink2
  g.fillRect(x + 12, y + 20, 4, 10)
  g.fillRect(x + w - 20, y + 28, 4, 10)
}

function dragMarks(g: G, x: number, y: number, w: number): void {
  g.fillStyle = mix(PAL.ink2, PAL.copperD, 0.4)
  for (let i = 0; i < 3; i++) g.fillRect(x, y + i * 3, w - i * 10, 1)
}

function bones(g: G, x: number, y: number): void {
  g.fillStyle = PAL.cream
  g.fillRect(x, y, 8, 2)
  g.fillRect(x + 2, y - 2, 2, 2)
  g.fillStyle = PAL.stoneL
  g.fillRect(x + 10, y - 1, 5, 3)
}

function shield(g: G, x: number, y: number): void {
  g.fillStyle = PAL.gray1
  g.fillRect(x, y, 8, 10)
  g.fillStyle = PAL.copperD
  g.fillRect(x + 1, y + 1, 6, 8)
  g.fillStyle = PAL.stoneL
  g.fillRect(x + 3, y + 3, 2, 4)
}

function emptyRack(g: G, x: number, y: number): void {
  g.fillStyle = PAL.wood1
  g.fillRect(x, y, 40, 3)
  g.fillRect(x, y, 3, 18)
  g.fillRect(x + 37, y, 3, 18)
}

function mossWell(g: G, lights: Light[], x: number, y: number, gold = false): void {
  g.fillStyle = PAL.stone
  g.fillRect(x, y, 36, 14)
  g.fillStyle = PAL.leaf
  g.fillRect(x - 2, y, 40, 3)
  g.fillRect(x, y + 11, 36, 2)
  g.fillStyle = gold ? PAL.gold : PAL.river2
  g.fillRect(x + 6, y + 4, 24, 6)
  if (gold) lights.push({ x: x + 18, y: y + 6, r: 18, hex: PAL.gold })
  g.fillStyle = PAL.cream
  g.fillRect(x + 38, y - 8, 2, 10)
  g.fillStyle = PAL.lamp2
  g.fillRect(x + 37, y - 10, 4, 3)
}

function anvil(g: G, x: number, y: number): void {
  g.fillStyle = PAL.gray1
  g.fillRect(x, y, 28, 8)
  g.fillRect(x + 8, y + 8, 12, 10)
  g.fillStyle = PAL.copperD
  g.fillRect(x + 2, y + 1, 24, 2)
  g.fillStyle = PAL.copper
  g.fillRect(x + 30, y - 6, 4, 14)
  g.fillRect(x + 26, y - 8, 12, 4)
}

function rustChest(g: G, x: number, y: number, open = true): void {
  g.fillStyle = PAL.wood1
  g.fillRect(x, y + 6, 28, 14)
  g.fillStyle = PAL.copperD
  g.fillRect(x, y + 6, 28, 2)
  g.fillRect(x, y + 18, 28, 2)
  g.fillRect(x + 12, y + 10, 4, 6)
  if (open) {
    g.fillStyle = PAL.wood2
    g.fillRect(x, y, 28, 7)
    g.fillStyle = PAL.gold
    g.fillRect(x + 8, y + 10, 3, 2)
    g.fillRect(x + 14, y + 12, 2, 2)
  }
}

function chandelier(g: G, x: number, y: number): void {
  g.fillStyle = PAL.gray1
  g.fillRect(x, y, 2, 18)
  g.fillRect(x - 18, y + 18, 38, 3)
  g.fillStyle = PAL.copperD
  for (const ox of [-16, -6, 6, 16]) g.fillRect(x + ox, y + 21, 3, 5)
}

function spiderNest(g: G, x: number, y: number, h: number): void {
  g.fillStyle = PAL.cream
  for (let i = 0; i < h; i += 4) {
    g.fillRect(x + (i % 8), y + i, 10 - (i % 5), 1)
    g.fillRect(x + 2, y, 1, h)
  }
  g.fillStyle = PAL.ink
  g.fillRect(x + 3, y + h - 8, 8, 6)
}

function bakeRoom(kind: RoomKey): BakedRoom {
  const r = rng(hash(kind) ^ 0x9e3779b9)
  const W = 640, H = 360
  const { c, g } = makeCanvas(W, H)
  const lights: Light[] = []
  const wallTop = 42
  const floorY = 236

  g.fillStyle = PAL.shadow
  g.fillRect(0, 0, W, H)
  brickWall(g, r, 0, wallTop, W, floorY - wallTop, kind === 'boss' || kind === 'nest')
  g.fillStyle = PAL.ink
  g.fillRect(0, 0, W, wallTop)
  g.fillStyle = mix(PAL.ink, PAL.tile1, 0.25)
  g.fillRect(0, wallTop - 6, W, 6)

  const blood = kind === 'boss' || kind === 'side'
  stoneFloor(g, r, 0, floorY, W, H - floorY, blood)

  rustBars(g, 0, wallTop + 8, 18, floorY - wallTop - 16)
  rustBars(g, W - 18, wallTop + 8, 18, floorY - wallTop - 16)

  if (kind === 'gate' || kind === 'foyer') {
    rustGate(g, 210, 70, 220, floorY - 70, kind === 'gate' ? 18 : 0)
    if (kind === 'gate') dragMarks(g, 240, floorY + 8, 180)
    wallLamp(g, lights, 48, 120, true)
    wallLamp(g, lights, 580, 118, true)
    emptyRack(g, 40, floorY - 28)
    emptyRack(g, 540, floorY - 28)
  }

  if (kind === 'corridor') {
    brickWall(g, r, 180, wallTop, 40, floorY - wallTop, true)
    brickWall(g, r, 420, wallTop, 40, floorY - wallTop, true)
    wallLamp(g, lights, 70, 110, true)
    wallLamp(g, lights, 560, 130, false)
    for (let i = 0; i < 5; i++) {
      shield(g, 30 + i * 12, floorY - 12)
      bones(g, 520 + i * 14, floorY + 4)
    }
  }

  if (kind === 'side') {
    wallLamp(g, lights, 60, 128, false)
    g.fillStyle = PAL.fog
    g.fillRect(470, 90, 22, 50)
    g.fillStyle = PAL.gray3
    g.fillRect(472, 92, 8, 20)
    g.fillRect(482, 108, 8, 18)
    g.fillStyle = PAL.wood1
    g.fillRect(80, floorY - 22, 16, 22)
    g.fillStyle = PAL.copperD
    g.fillRect(82, floorY - 20, 12, 3)
    g.fillStyle = PAL.lamp2
    g.fillRect(87, floorY - 28, 2, 8)
    g.fillStyle = PAL.cream
    g.fillRect(400, floorY - 8, 10, 8)
    g.fillRect(430, floorY - 6, 8, 6)
  }

  if (kind === 'nest') {
    spiderNest(g, 80, wallTop + 4, floorY - wallTop - 8)
    spiderNest(g, 300, wallTop + 4, floorY - wallTop - 8)
    spiderNest(g, 520, wallTop + 4, floorY - wallTop - 8)
    g.fillStyle = PAL.cream
    for (let i = 0; i < 18; i++) g.fillRect(40 + r.int(560), floorY + 4 + r.int(40), 4 + r.int(6), 3)
    wallLamp(g, lights, 40, 140, false)
  }

  if (kind === 'slime') {
    g.fillStyle = mix(PAL.teal, PAL.leaf, 0.4)
    g.fillRect(80, floorY + 20, 480, 40)
    g.fillStyle = PAL.leaf
    g.fillRect(120, floorY + 16, 80, 8)
    g.fillRect(400, floorY + 18, 60, 6)
    g.fillStyle = PAL.stone
    g.fillRect(220, floorY + 28, 10, 8)
    g.fillStyle = PAL.fog
    g.fillRect(40, 100, 16, 40)
    wallLamp(g, lights, 560, 120, true)
  }

  if (kind === 'boss') {
    chandelier(g, 318, 8)
    rustGate(g, 80, 90, 70, 80, 0)
    rustGate(g, 490, 90, 70, 80, 0)
    g.fillStyle = mix(PAL.ene, PAL.gray1, 0.35)
    g.fillRect(250, floorY - 28, 140, 28)
    g.fillRect(270, floorY - 50, 90, 24)
    g.fillStyle = PAL.cream
    g.fillRect(300, floorY - 18, 40, 8)
    g.fillStyle = PAL.copperD
    g.fillRect(330, floorY - 44, 18, 10)
    wallLamp(g, lights, 40, 110, true)
    wallLamp(g, lights, 590, 110, true)
    bones(g, 100, floorY + 6)
    bones(g, 520, floorY + 8)
  }

  if (kind === 'shop') {
    g.fillStyle = PAL.gray1
    g.fillRect(250, floorY - 8, 140, 10)
    g.fillStyle = PAL.copperD
    g.fillRect(255, floorY - 18, 130, 12)
    g.fillStyle = PAL.pack
    g.fillRect(300, floorY - 36, 28, 20)
    g.fillStyle = PAL.cream
    g.fillRect(308, floorY - 48, 12, 12)
    g.fillStyle = PAL.gold
    g.fillRect(312, floorY - 44, 4, 2)
    g.fillStyle = PAL.copper
    g.fillRect(340, floorY - 28, 10, 8)
    g.fillStyle = PAL.wood1
    g.fillRect(400, 90, 6, 80)
    g.fillStyle = PAL.teal
    g.fillRect(408, 100, 8, 12)
    g.fillStyle = PAL.gray2
    g.fillRect(408, 120, 4, 30)
    g.fillStyle = PAL.gold
    g.fillRect(270, floorY - 6, 4, 3)
    g.fillRect(278, floorY - 5, 3, 2)
    wallLamp(g, lights, 220, 100, true)
  }

  if (kind === 'well') {
    mossWell(g, lights, 300, floorY - 6, kind === 'well')
    wallLamp(g, lights, 80, 120, false)
    g.fillStyle = PAL.cream
    g.fillRect(348, floorY - 18, 2, 12)
  }

  if (kind === 'forge') {
    anvil(g, 300, floorY - 18)
    g.fillStyle = PAL.wood1
    g.fillRect(80, 90, 4, 70)
    g.fillStyle = PAL.paperD
    g.fillRect(86, 100, 28, 22)
    g.fillStyle = PAL.ink2
    g.fillRect(90, 106, 20, 1)
    g.fillRect(90, 112, 14, 1)
    wallLamp(g, lights, 520, 110, false)
  }

  if (kind === 'chest') {
    rustChest(g, 306, floorY - 22, true)
    wallLamp(g, lights, 80, 120, true)
    bones(g, 80, floorY + 8)
  }

  if (kind === 'event') {
    wallLamp(g, lights, 300, 100, true)
    g.fillStyle = mix(PAL.ink2, PAL.brown, 0.4)
    g.fillRect(290, floorY + 10, 6, 2)
    g.fillRect(300, floorY + 12, 8, 2)
    g.fillStyle = PAL.copper
    g.fillRect(330, floorY + 8, 6, 4)
  }

  if (kind !== 'corridor') {
    g.fillStyle = PAL.leaf
    g.fillRect(8, floorY - 4, 12, 4)
    g.fillRect(620, floorY - 3, 10, 3)
  }

  return { back: c, glow: bakeGlow(W, H, lights), lights }
}

const roomCache = new Map<string, BakedRoom>()

export function roomOfEncounter(id: string): RoomKey {
  if (id === 'MON.N01') return 'foyer'
  if (id === 'MON.N02') return 'corridor'
  if (id === 'MON.E01') return 'nest'
  if (id.includes('B')) return 'boss'
  if (id.includes('E')) return 'side'
  return 'corridor'
}

export function roomOfNode(type: string): RoomKey {
  if (type === 'shop') return 'shop'
  if (type === 'rest') return 'well'
  if (type === 'forge') return 'forge'
  if (type === 'chest') return 'chest'
  if (type === 'event') return 'event'
  if (type === 'boss') return 'boss'
  if (type === 'elite') return 'nest'
  if (type === 'normal') return 'corridor'
  return 'gate'
}

const ROOM_KEYS = new Set<string>([
  'gate', 'foyer', 'corridor', 'side', 'nest', 'slime', 'boss', 'shop', 'well', 'forge', 'chest', 'event',
])

function resolveRoom(setKey: string): RoomKey {
  if (ROOM_KEYS.has(setKey)) return setKey as RoomKey
  return 'corridor'
}

export class Scenery {
  readonly key: RoomKey
  private baked: BakedRoom

  constructor(setKey: string) {
    this.key = resolveRoom(setKey)
    let baked = roomCache.get(this.key)
    if (!baked) { baked = bakeRoom(this.key); roomCache.set(this.key, baked) }
    this.baked = baked
  }

  drawBack(g: G, camX: number, _t: number): void {
    const ox = Math.round(Math.sin(camX * 0.01) * 2)
    g.drawImage(this.baked.back, ox, 0)
  }

  drawFront(g: G, _camX: number, t: number): void {
    g.save()
    g.globalCompositeOperation = 'screen'
    g.globalAlpha = 0.72 + 0.12 * Math.sin(t * 5)
    g.drawImage(this.baked.glow, 0, 0)
    g.restore()
    for (let i = 0; i < 6; i++) {
      const x = 40 + i * 100
      const y = 50 + ((t * 18 + i * 40) % 180)
      g.fillStyle = rgba(PAL.river2, 0.25)
      g.fillRect(x, Math.round(y), 1, 3)
    }
    duskWash(g, 0.06)
    nightWash(g, this.key === 'boss' || this.key === 'nest' ? 0.28 : 0.18)
    vignette(g, 0.34)
  }
}
