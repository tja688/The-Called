/**
 * 资产查表：按 id 取已烘焙的 canvas。找不到时返回带「?」的占位块并 console.warn 一次，绝不抛错。
 */
import { bake, compose, type Baked, type SpriteDef, makeCanvas } from './dsl'
import { bakeShape, type ShapeIcon } from './shapes'
import { placeholder } from './ui'
import { ASCII_SPRITES, SHAPE_ICONS, defToAssetId } from './catalog'

const ASCII: Record<string, SpriteDef> = {}
for (const d of ASCII_SPRITES) ASCII[d.id] = d

const SHAPES: Record<string, ShapeIcon> = {}
for (const s of SHAPE_ICONS) SHAPES[s.id] = s

const warned = new Set<string>()
const missing = new Map<string, HTMLCanvasElement>()
function missingCanvas(id: string, w: number, h: number): HTMLCanvasElement {
  if (!warned.has(id)) {
    warned.add(id)
    console.warn(`[assets] missing sprite "${id}"`)
  }
  const key = `${w}x${h}`
  let c = missing.get(key)
  if (!c) {
    const m = makeCanvas(w, h)
    placeholder(m.g, 0, 0, w, h)
    c = m.c
    missing.set(key, c)
  }
  return c
}

const composeCache = new Map<string, HTMLCanvasElement>()
function composeAnim(b: Baked, anim: string): HTMLCanvasElement {
  const key = `${b.def.id}:${anim}`
  let c = composeCache.get(key)
  if (!c) {
    c = compose(b, b.def.animations?.[anim] ?? {}, 0)
    composeCache.set(key, c)
  }
  return c
}

export const ASSETS = {
  sprite(id: string): Baked | null {
    const d = ASCII[id]
    if (!d) {
      if (!warned.has(id)) {
        warned.add(id)
        console.warn(`[assets] missing sprite "${id}"`)
      }
      return null
    }
    return bake(d)
  },
  icon(id: string, w = 16, h = w): HTMLCanvasElement {
    const s = SHAPES[id]
    return s ? bakeShape(s) : missingCanvas(id, w, h)
  },
  card(defId: string): HTMLCanvasElement {
    const id = defToAssetId(defId)
    const s = SHAPES[id]
    if (s) return bakeShape(s)
    const d = ASCII[id]
    if (d) return bake(d).still
    return missingCanvas(id, 24, 24)
  },
  npc(defId: string): HTMLCanvasElement {
    return this.icon(defToAssetId(defId), 24, 24)
  },
  still(id: string): HTMLCanvasElement | null {
    const d = ASCII[id]
    return d ? bake(d).still : null
  },
  anim(id: string, name = 'idle'): HTMLCanvasElement | null {
    const b = this.sprite(id)
    return b ? composeAnim(b, name) : null
  },
  all: { ascii: ASCII, shapes: SHAPES },
}

export { defToAssetId }
