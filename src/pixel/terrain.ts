/**
 * 战场地面。砖缝长苔，偶发锈斑和干血。不要木地板。
 */
import { PAL, mix, rgba } from './palette'
import { makeCanvas } from './dsl'
import type { RoomKey } from './scenery'

function rng(seed: number) {
  let s = seed >>> 0 || 1
  const next = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
  return { next, int: (n: number) => Math.floor(next() * n), pick: <T>(a: T[]) => a[Math.floor(next() * a.length)] }
}

const tableCache = new Map<string, HTMLCanvasElement>()

/** 战场地面 640×220：3×3 地砖感，按房间染色。 */
export function bakeTable(kind: RoomKey): HTMLCanvasElement {
  const hit = tableCache.get(kind)
  if (hit) return hit
  const W = 640, H = 220
  const { c, g } = makeCanvas(W, H)
  const r = rng(kind.length * 977 + 13)
  g.fillStyle = PAL.slate
  g.fillRect(0, 0, W, H)
  const tw = 22, th = 16
  for (let y = 0, row = 0; y < H; y += th, row++) {
    const ox = (row % 2) * 11
    for (let x = -11; x < W; x += tw) {
      let base: string = r.pick([PAL.stone, PAL.tile1, PAL.slate])
      if (kind === 'boss') base = mix(base, PAL.ink2, 0.2)
      if (kind === 'nest') base = mix(base, PAL.cream, 0.08)
      if (kind === 'slime') base = mix(base, PAL.teal, 0.18)
      if (kind === 'side') base = mix(base, PAL.fog, 0.06)
      g.fillStyle = base
      g.fillRect(x + ox, y, tw - 1, th - 1)
      g.fillStyle = mix(base, PAL.cream, 0.12)
      g.fillRect(x + ox, y, tw - 1, 1)
      g.fillStyle = PAL.leaf
      if (r.next() < (kind === 'well' || kind === 'nest' ? 0.7 : 0.4)) {
        g.fillRect(x + ox + 1, y + th - 2, 4 + r.int(8), 1)
      }
      if (kind === 'boss' && r.next() < 0.1) {
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
  if (kind === 'corridor') {
    g.fillStyle = mix(PAL.tile1, PAL.ink, 0.3)
    g.fillRect(0, 0, 48, H)
    g.fillRect(W - 48, 0, 48, H)
  }
  tableCache.set(kind, c)
  return c
}
