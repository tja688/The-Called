/**
 * 程序天空：垂直渐变 + 4×4 Bayer 抖动，按时段取色常量；太阳 / 月亮是径向光斑。烘焙一次。
 */
import { PAL, hexToRgb } from './palette'
import { makeCanvas } from './dsl'

export type TimeOfDay = 'day' | 'dusk' | 'night' | 'deep'

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

const STOPS: Record<TimeOfDay, string[]> = {
  day: ['#6fb7e8', '#9fd0f0', '#cfe6f2', '#f5e6c8'],
  dusk: [PAL.sky1, PAL.sky2, PAL.sky3, PAL.sky4],
  night: [PAL.night1, PAL.night2, '#4a3a6a', '#7a4a5a'],
  deep: ['#080a20', PAL.night1, PAL.night2, '#3a2a4a'],
}

const cache = new Map<string, HTMLCanvasElement>()

/** 天空长条 w×h（一般 640×220），带抖动的分段渐变 */
export function bakeSky(time: TimeOfDay, w = 640, h = 240): HTMLCanvasElement {
  const key = `${time}:${w}x${h}`
  const hit = cache.get(key)
  if (hit) return hit
  const stops = STOPS[time].map(hexToRgb)
  const { c, g } = makeCanvas(w, h)
  const img = g.createImageData(w, h)
  const d = img.data
  for (let y = 0; y < h; y++) {
    const t = y / (h - 1)
    const seg = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)))
    const lt = t * (stops.length - 1) - seg
    const a = stops[seg], b = stops[seg + 1]
    for (let x = 0; x < w; x++) {
      const th = (BAYER[y & 3][x & 3] + 0.5) / 16
      // 抖动：按阈值在两个相邻色之间二选一，再做轻微混合避免生硬
      const pickB = lt > th
      const k = pickB ? Math.min(1, lt + 0.15) : Math.max(0, lt - 0.15)
      const i = (y * w + x) * 4
      d[i] = a[0] + (b[0] - a[0]) * k
      d[i + 1] = a[1] + (b[1] - a[1]) * k
      d[i + 2] = a[2] + (b[2] - a[2]) * k
      d[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  cache.set(key, c)
  return c
}

/** 画太阳 / 月亮：软光斑 + 硬芯 */
export function drawCelestial(g: CanvasRenderingContext2D, time: TimeOfDay, x: number, y: number): void {
  if (time === 'day') {
    const grad = g.createRadialGradient(x, y, 4, x, y, 40)
    grad.addColorStop(0, 'rgba(255,240,200,0.9)')
    grad.addColorStop(1, 'rgba(255,240,200,0)')
    g.fillStyle = grad
    g.fillRect(x - 40, y - 40, 80, 80)
    g.fillStyle = PAL.white
    g.fillRect(x - 5, y - 5, 10, 10)
    g.fillRect(x - 6, y - 4, 12, 8)
  } else if (time === 'dusk') {
    const grad = g.createRadialGradient(x, y, 6, x, y, 70)
    grad.addColorStop(0, 'rgba(255,200,120,0.75)')
    grad.addColorStop(1, 'rgba(255,160,90,0)')
    g.fillStyle = grad
    g.fillRect(x - 70, y - 70, 140, 140)
    g.fillStyle = PAL.lamp1
    g.fillRect(x - 7, y - 7, 14, 14)
    g.fillRect(x - 9, y - 5, 18, 10)
    g.fillRect(x - 5, y - 9, 10, 18)
  } else {
    const grad = g.createRadialGradient(x, y, 6, x, y, 50)
    grad.addColorStop(0, 'rgba(248,240,208,0.45)')
    grad.addColorStop(1, 'rgba(248,240,208,0)')
    g.fillStyle = grad
    g.fillRect(x - 50, y - 50, 100, 100)
    g.fillStyle = PAL.moon
    g.fillRect(x - 5, y - 5, 10, 10)
    g.fillRect(x - 7, y - 3, 14, 6)
    g.fillRect(x - 3, y - 7, 6, 14)
    g.fillStyle = PAL.gray3
    g.fillRect(x - 2, y - 1, 2, 2)
    g.fillRect(x + 2, y + 2, 1, 1)
  }
}

/** 星星（夜） */
export function drawStars(g: CanvasRenderingContext2D, seed: number, t: number, w = 640, h = 160): void {
  let s = seed
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
  g.fillStyle = PAL.white
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(rnd() * w), y = Math.floor(rnd() * h)
    const ph = rnd() * 6.28
    const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.5 + ph))
    g.globalAlpha = a * (rnd() < 0.2 ? 1 : 0.6)
    g.fillRect(x, y, 1, 1)
  }
  g.globalAlpha = 1
}
