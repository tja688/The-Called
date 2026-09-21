/**
 * 锈门层俯视底图与战场地砖。砖缝长苔，偶发锈斑和干血。不要木地板。
 */
import { PAL, mix, rgba } from './palette'
import { makeCanvas } from './dsl'
import type { RoomKey } from './scenery'

type G = CanvasRenderingContext2D
export const MAP_W = 640
export const MAP_H = 360

function rng(seed: number) {
  let s = seed >>> 0 || 1
  const next = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
  return { next, int: (n: number) => Math.floor(next() * n), pick: <T>(a: T[]) => a[Math.floor(next() * a.length)] }
}

const mapCache = new Map<string, HTMLCanvasElement>()

/** 走廊网底图：深石、砖缝、几盏壁灯。 */
export function bakeMapBase(_layer: number, seed: number): HTMLCanvasElement {
  const key = `dungeon:${seed}`
  const hit = mapCache.get(key)
  if (hit) return hit
  const r = rng(seed ^ 7919)
  const { c, g } = makeCanvas(MAP_W, MAP_H)
  g.fillStyle = PAL.shadow
  g.fillRect(0, 0, MAP_W, MAP_H)
  g.fillStyle = PAL.tile1
  g.fillRect(16, 16, MAP_W - 32, MAP_H - 32)
  for (let y = 16; y < MAP_H - 16; y += 10) {
    for (let x = 16 + ((y / 10) % 2) * 8; x < MAP_W - 16; x += 18) {
      g.fillStyle = r.pick([PAL.tile1, PAL.slate, PAL.stone, mix(PAL.tile1, PAL.ink, 0.2)])
      g.fillRect(x, y, 17, 9)
      if (r.next() < 0.25) {
        g.fillStyle = PAL.leaf
        g.fillRect(x + 2, y + 8, 5, 1)
      }
    }
  }
  g.fillStyle = rgba(PAL.ink, 0.45)
  g.fillRect(0, 0, MAP_W, 16)
  g.fillRect(0, MAP_H - 16, MAP_W, 16)
  g.fillRect(0, 0, 16, MAP_H)
  g.fillRect(MAP_W - 16, 0, 16, MAP_H)
  for (let i = 0; i < 8; i++) {
    g.fillStyle = PAL.lamp2
    g.fillRect(24 + r.int(MAP_W - 48), 20 + r.int(40), 2, 2)
  }
  mapCache.set(key, c)
  return c
}

export type TableKind = RoomKey | 'bamboo' | 'stone' | 'copper' | 'wood' | 'rail' | 'cable' | 'topstone' | 'hall'

const tableCache = new Map<string, HTMLCanvasElement>()

function floorKind(kind: TableKind): RoomKey {
  if (kind === 'bamboo' || kind === 'wood' || kind === 'copper') return 'corridor'
  if (kind === 'stone' || kind === 'topstone' || kind === 'rail') return 'side'
  if (kind === 'hall' || kind === 'cable') return 'boss'
  return kind
}

/** 战场地面 640×220：3×3 地砖感，按房间染色。 */
export function bakeTable(kind: TableKind): HTMLCanvasElement {
  const k = floorKind(kind)
  const hit = tableCache.get(k)
  if (hit) return hit
  const W = 640, H = 220
  const { c, g } = makeCanvas(W, H)
  const r = rng(k.length * 977 + 13)
  g.fillStyle = PAL.slate
  g.fillRect(0, 0, W, H)
  const tw = 22, th = 16
  for (let y = 0, row = 0; y < H; y += th, row++) {
    const ox = (row % 2) * 11
    for (let x = -11; x < W; x += tw) {
      let base: string = r.pick([PAL.stone, PAL.tile1, PAL.slate])
      if (k === 'boss') base = mix(base, PAL.ink2, 0.2)
      if (k === 'nest') base = mix(base, PAL.cream, 0.08)
      if (k === 'slime') base = mix(base, PAL.teal, 0.18)
      if (k === 'side') base = mix(base, PAL.fog, 0.06)
      g.fillStyle = base
      g.fillRect(x + ox, y, tw - 1, th - 1)
      g.fillStyle = mix(base, PAL.cream, 0.12)
      g.fillRect(x + ox, y, tw - 1, 1)
      g.fillStyle = PAL.leaf
      if (r.next() < (k === 'well' || k === 'nest' ? 0.7 : 0.4)) {
        g.fillRect(x + ox + 1, y + th - 2, 4 + r.int(8), 1)
      }
      if (k === 'boss' && r.next() < 0.1) {
        g.fillStyle = PAL.redD
        g.fillRect(x + ox + 2 + r.int(10), y + 4 + r.int(6), 3, 1)
      } else if (r.next() < 0.06) {
        g.fillStyle = PAL.copperD
        g.fillRect(x + ox + 3 + r.int(8), y + 3, 2, 1)
      }
    }
  }
  g.fillStyle = rgba(PAL.ink, 0.4)
  g.fillRect(0, 0, W, 4)
  g.fillRect(0, H - 4, W, 4)
  if (k === 'corridor') {
    g.fillStyle = mix(PAL.tile1, PAL.ink, 0.3)
    g.fillRect(0, 0, 48, H)
    g.fillRect(W - 48, 0, 48, H)
  }
  tableCache.set(k, c)
  return c
}
