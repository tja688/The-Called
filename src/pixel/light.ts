/**
 * 光效层：灯笼 glow、暮色洗、暗角、热气、闪白。
 * 光效可以用渐变与半透明。角色层不可以。函数直接画到给定 ctx。
 */
import { PAL, rgba } from './palette'
import { makeCanvas } from './dsl'

type G = CanvasRenderingContext2D

const glowCache = new Map<string, HTMLCanvasElement>()
function glowSprite(r: number, hex: string): HTMLCanvasElement {
  const key = `${r}:${hex}`
  let c = glowCache.get(key)
  if (c) return c
  const m = makeCanvas(r * 2, r * 2)
  const grad = m.g.createRadialGradient(r, r, 1, r, r, r)
  grad.addColorStop(0, rgba(hex, 0.85))
  grad.addColorStop(0.4, rgba(hex, 0.35))
  grad.addColorStop(1, rgba(hex, 0))
  m.g.fillStyle = grad
  m.g.fillRect(0, 0, r * 2, r * 2)
  c = m.c
  glowCache.set(key, c)
  return c
}

/** 灯笼 / 窗心：screen 叠加径向光 + 1×1 亮芯 */
export function glow(g: G, x: number, y: number, r: number, hex: string = PAL.lamp2, alpha = 1, core = true): void {
  g.save()
  g.globalCompositeOperation = 'screen'
  g.globalAlpha *= alpha
  g.drawImage(glowSprite(r, hex), Math.round(x - r), Math.round(y - r))
  g.restore()
  if (core) { g.fillStyle = PAL.lamp1; g.fillRect(Math.round(x), Math.round(y), 1, 1) }
}

/** 全屏暮色洗 */
export function duskWash(g: G, alpha = 0.12, hex = '#ffb06e', w = 640, h = 360): void {
  g.save()
  g.globalCompositeOperation = 'screen'
  const grad = g.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, rgba(hex, 0))
  grad.addColorStop(1, rgba(hex, alpha))
  g.fillStyle = grad
  g.fillRect(0, 0, w, h)
  g.restore()
}

/** 夜色洗：整体压暗偏蓝 */
export function nightWash(g: G, alpha = 0.25, w = 640, h = 360): void {
  g.save()
  g.globalCompositeOperation = 'multiply'
  g.fillStyle = rgba('#6a70c0', alpha)
  g.fillRect(0, 0, w, h)
  g.restore()
}

let vignetteCache: HTMLCanvasElement | null = null
/** 暗角（很轻） */
export function vignette(g: G, alpha = 0.35, w = 640, h = 360): void {
  if (!vignetteCache) {
    const m = makeCanvas(w, h)
    const grad = m.g.createRadialGradient(w / 2, h / 2, h * 0.45, w / 2, h / 2, h * 0.95)
    grad.addColorStop(0, 'rgba(20,16,32,0)')
    grad.addColorStop(1, 'rgba(20,16,32,1)')
    m.g.fillStyle = grad
    m.g.fillRect(0, 0, w, h)
    vignetteCache = m.c
  }
  g.save()
  g.globalAlpha = alpha
  g.drawImage(vignetteCache, 0, 0)
  g.restore()
}

/** 上升的热气 / 火星：1×1 点 */
export function steam(g: G, t: number, x: number, y: number, w: number, h: number, n = 10, hex: string = PAL.fog, seed = 5): void {
  let s = seed
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
  g.save()
  for (let i = 0; i < n; i++) {
    const bx = rnd() * w, ph = rnd() * 6.28, sp = 8 + rnd() * 10
    const k = ((t * sp + ph * 10) % h) / h
    const px = x + bx + Math.sin(t * 2 + ph) * 3
    const py = y - k * h
    g.globalAlpha = (1 - k) * 0.7
    g.fillStyle = hex
    g.fillRect(Math.round(px), Math.round(py), 1, 1)
  }
  g.restore()
}

/** 屏幕闪白（凑齐 / 馆主进场） */
export function flash(g: G, alpha: number, hex: string = PAL.lamp1, w = 640, h = 360): void {
  if (alpha <= 0) return
  g.save()
  g.globalCompositeOperation = 'screen'
  g.globalAlpha = alpha
  g.fillStyle = hex
  g.fillRect(0, 0, w, h)
  g.restore()
}
