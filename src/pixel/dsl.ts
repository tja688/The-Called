/**
 * 像素精灵 DSL：ASCII 行 + 私有色板 → 一次烘焙成离屏 canvas（见《像素资产DSL规范》）。
 * 本文件只做「怎么画」，不知道游戏。
 */
import { color } from './palette'

export type Rows = string[]
export type Frame = Rows | { delta: Rows }
export interface PartDef { frames: Frame[] | Record<string, Frame>; offset: [number, number] }
export interface AnimDef { fps?: number; [part: string]: number | string | (number | string)[] | undefined }
export interface SpriteDef {
  id: string
  size: [number, number]
  anchor?: [number, number]
  palette: Record<string, string>
  parts: Record<string, Rows | PartDef>
  compose?: string[]
  animations?: Record<string, AnimDef>
  mirror?: 'none' | 'flipX'
}

export interface Baked {
  def: SpriteDef
  w: number
  h: number
  anchor: [number, number]
  parts: Record<string, { frames: Record<string | number, HTMLCanvasElement>; offset: [number, number]; keys: (string | number)[] }>
  still: HTMLCanvasElement
  shadow: HTMLCanvasElement
}

export function makeCanvas(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas')
  c.width = Math.max(1, w)
  c.height = Math.max(1, h)
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  return { c, g }
}

export const isBlank = (ch: string) => ch === '.' || ch === ' ' || ch === undefined

/** 逐字 fillRect 烘焙一张 ASCII 图 */
export function bakeRows(rows: Rows, palette: Record<string, string>, w?: number, h?: number): HTMLCanvasElement {
  const H = h ?? rows.length
  const W = w ?? Math.max(1, ...rows.map((r) => r.length))
  const { c, g } = makeCanvas(W, H)
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y]
    for (let x = 0; x < row.length; x++) {
      const ch = row[x]
      if (isBlank(ch)) continue
      const hex = palette[ch]
      if (!hex) throw new Error(`unknown palette key '${ch}' at ${x},${y}`)
      g.fillStyle = color(hex)
      g.fillRect(x, y, 1, 1)
    }
  }
  return c
}

/** 补丁帧：空格 = 保留；'~' = 擦成透明；其它 = 覆盖 */
export function applyDelta(base: Rows, overlay: Rows): Rows {
  return base.map((row, y) => {
    const o = overlay[y] ?? ''
    let out = ''
    for (let x = 0; x < row.length; x++) {
      const ch = o[x] ?? ' '
      out += ch === ' ' ? row[x] : ch === '~' ? '.' : ch
    }
    return out
  })
}

/** 染色（source-in），用于影子 / 闪白 */
export function tint(src: HTMLCanvasElement, hex: string): HTMLCanvasElement {
  const { c, g } = makeCanvas(src.width, src.height)
  g.drawImage(src, 0, 0)
  g.globalCompositeOperation = 'source-in'
  g.fillStyle = color(hex)
  g.fillRect(0, 0, c.width, c.height)
  return c
}

/** 外描边：向四方各偏移 1px 的染色副本叠在下面 */
export function outline(src: HTMLCanvasElement, hex: string, thick = 1): HTMLCanvasElement {
  const t = tint(src, hex)
  const { c, g } = makeCanvas(src.width + thick * 2, src.height + thick * 2)
  for (let dx = -thick; dx <= thick; dx++) for (let dy = -thick; dy <= thick; dy++) {
    if (dx === 0 && dy === 0) continue
    if (Math.abs(dx) + Math.abs(dy) > thick) continue
    g.drawImage(t, thick + dx, thick + dy)
  }
  g.drawImage(src, thick, thick)
  return c
}

export function blur(src: HTMLCanvasElement, px: number): HTMLCanvasElement {
  const { c, g } = makeCanvas(src.width + px * 4, src.height + px * 4)
  g.filter = `blur(${px}px)`
  g.drawImage(src, px * 2, px * 2)
  g.filter = 'none'
  return c
}

const cache = new Map<string, Baked>()

function partFrames(p: Rows | PartDef): { frames: Frame[] | Record<string, Frame>; offset: [number, number] } {
  if (Array.isArray(p)) return { frames: [p], offset: [0, 0] }
  return p
}

/** 懒烘焙：同 id 只烘一次 */
export function bake(def: SpriteDef): Baked {
  const hit = cache.get(def.id)
  if (hit) return hit
  const [w, h] = def.size
  const parts: Baked['parts'] = {}
  for (const [name, p] of Object.entries(def.parts)) {
    const { frames, offset } = partFrames(p)
    const out: Record<string | number, HTMLCanvasElement> = {}
    const keys: (string | number)[] = []
    if (Array.isArray(frames)) {
      const base = frames[0] as Rows
      frames.forEach((f, i) => {
        const rows = Array.isArray(f) ? f : applyDelta(base, f.delta)
        out[i] = bakeRows(rows, def.palette)
        keys.push(i)
      })
    } else {
      const entries = Object.entries(frames)
      const baseEntry = entries.find(([, f]) => Array.isArray(f)) ?? entries[0]
      const base = baseEntry[1] as Rows
      for (const [k, f] of entries) {
        const rows = Array.isArray(f) ? f : applyDelta(base, f.delta)
        out[k] = bakeRows(rows, def.palette)
        keys.push(k)
      }
    }
    parts[name] = { frames: out, offset, keys }
  }
  const anchor: [number, number] = def.anchor ?? [Math.floor(w / 2), h]
  const baked: Baked = { def, w, h, anchor, parts, still: null!, shadow: null! }
  baked.still = compose(baked, def.animations?.idle ?? {}, 0)
  baked.shadow = tint(baked.still, '#141020')
  cache.set(def.id, baked)
  return baked
}

function frameKeyFor(b: Baked, part: string, anim: AnimDef | undefined, t: number, face?: string | number): string | number {
  const p = b.parts[part]
  if (face !== undefined && part === 'face') return face
  const v = anim?.[part]
  if (v === undefined) return p.keys[0]
  if (Array.isArray(v)) {
    const fps = anim?.fps ?? 8
    return v[Math.floor(t * fps) % v.length]
  }
  return v
}

/** 合成整张（按 compose 顺序）到一张新 canvas */
export function compose(b: Baked, anim: AnimDef, t: number, face?: string | number): HTMLCanvasElement {
  const { c, g } = makeCanvas(b.w, b.h)
  const order = b.def.compose ?? Object.keys(b.def.parts)
  for (const part of order) {
    const p = b.parts[part]
    if (!p) continue
    const key = frameKeyFor(b, part, anim, t, face)
    const img = p.frames[key] ?? p.frames[p.keys[0]]
    g.drawImage(img, p.offset[0], p.offset[1])
  }
  return c
}

export interface DrawOpt {
  anim?: string
  t?: number
  face?: string | number
  flip?: boolean
  squash?: [number, number]
  alpha?: number
  scale?: number
  shadow?: boolean
  tintHex?: string
}

/** 把精灵画到 g；(x, y) 是锚点（缺省脚底中心）的逻辑坐标 */
export function drawSprite(g: CanvasRenderingContext2D, b: Baked, x: number, y: number, opt: DrawOpt = {}): void {
  const anim = b.def.animations?.[opt.anim ?? 'idle'] ?? {}
  const t = opt.t ?? 0
  const sx = (opt.squash?.[0] ?? 1) * (opt.scale ?? 1) * (opt.flip ? -1 : 1)
  const sy = (opt.squash?.[1] ?? 1) * (opt.scale ?? 1)
  g.save()
  g.translate(Math.round(x), Math.round(y))
  if (opt.alpha !== undefined) g.globalAlpha *= opt.alpha
  if (opt.shadow) {
    g.save()
    g.globalAlpha *= 0.35
    g.scale(1, 0.3)
    g.drawImage(b.shadow, -b.anchor[0] + (b.w - b.shadow.width) / 2, -b.anchor[1] + b.h - b.shadow.height / 2)
    g.restore()
  }
  g.scale(sx, sy)
  const order = b.def.compose ?? Object.keys(b.def.parts)
  for (const part of order) {
    const p = b.parts[part]
    if (!p) continue
    const key = frameKeyFor(b, part, anim, t, opt.face)
    let img = p.frames[key] ?? p.frames[p.keys[0]]
    if (opt.tintHex) img = tint(img, opt.tintHex)
    g.drawImage(img, p.offset[0] - b.anchor[0], p.offset[1] - b.anchor[1])
  }
  g.restore()
}

/** 画一张已烘好的 canvas，左上角对齐，整数坐标 */
export function blit(g: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, scale = 1, alpha = 1): void {
  if (alpha !== 1) { g.save(); g.globalAlpha *= alpha }
  if (scale === 1) g.drawImage(img, Math.round(x), Math.round(y))
  else g.drawImage(img, Math.round(x), Math.round(y), Math.round(img.width * scale), Math.round(img.height * scale))
  if (alpha !== 1) g.restore()
}

export function clearBakeCache(): void { cache.clear() }
