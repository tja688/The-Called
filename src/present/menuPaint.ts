/**
 * 主菜单 / 选行囊的像素件：蜡封印、门缝光、键帽横幅。
 * 光效可以渐变；按钮和印章只 fillRect。
 */
import { PAL, rgba } from '../pixel/palette'
import { glow, steam } from '../pixel/light'
import { pxFrame, pxRoundRect } from '../pixel/ui'

type G = CanvasRenderingContext2D

export type MenuIcon = 'start' | 'settings' | 'help' | 'quit'

function fillDisc(g: G, cx: number, cy: number, r: number, color: string): void {
  g.fillStyle = color
  const R = Math.round(r)
  const x0 = Math.round(cx)
  const y0 = Math.round(cy)
  for (let dy = -R; dy <= R; dy++) {
    const span = Math.round(Math.sqrt(Math.max(0, R * R - dy * dy)))
    if (span <= 0) continue
    g.fillRect(x0 - span, y0 + dy, span * 2, 1)
  }
}

/** 锈门门缝里漏下来的暖光。画在 world 上，暗角之前。 */
export function paintGateShaft(g: G, t: number): void {
  g.save()
  g.globalCompositeOperation = 'screen'
  const flick = 0.2 + 0.06 * Math.sin(t * 1.5)
  g.beginPath()
  g.moveTo(292, 62)
  g.lineTo(360, 66)
  g.lineTo(424, 270)
  g.lineTo(208, 270)
  g.closePath()
  const grad = g.createLinearGradient(320, 50, 320, 280)
  grad.addColorStop(0, rgba(PAL.lamp1, flick))
  grad.addColorStop(0.4, rgba(PAL.lamp2, flick * 0.4))
  grad.addColorStop(1, rgba(PAL.lamp2, 0))
  g.fillStyle = grad
  g.fill()
  g.restore()
}

/** 壁灯、标题暖晕、光柱里的尘。画在暗角之后，让灯还看得见。 */
export function paintMenuLights(g: G, t: number, glowAt?: { x: number; y: number }): void {
  const flick = 0.62 + 0.22 * Math.sin(t * 5)
  glow(g, 51, 124, 36, PAL.lamp2, flick * 0.55, false)
  glow(g, 583, 122, 32, PAL.lamp2, (0.5 + 0.18 * Math.sin(t * 4.2 + 1)) * 0.5, false)
  glow(g, 132, 52, 72, PAL.lamp1, 0.22 + 0.05 * Math.sin(t * 1.7), false)
  glow(g, 318, 150, 40, PAL.lamp1, 0.12 + 0.04 * Math.sin(t * 2.1), false)
  if (glowAt) glow(g, glowAt.x, glowAt.y, 28, PAL.lamp1, 0.45 + 0.15 * Math.sin(t * 3.4), false)
  steam(g, t, 230, 250, 170, 150, 12, PAL.lamp1, 4)
  steam(g, t * 0.8, 40, 150, 24, 80, 4, PAL.fog, 9)
}

/** 火漆印，压在标题旁边。 */
export function paintWaxSeal(g: G, cx: number, cy: number, t: number): void {
  const y = cy + Math.round(Math.sin(t * 1.6) * 1)
  fillDisc(g, cx + 1, y + 2, 23, rgba(PAL.ink, 0.55))
  fillDisc(g, cx, y, 22, PAL.redD)
  fillDisc(g, cx, y - 1, 16, PAL.lamp3)
  g.fillStyle = PAL.redD
  g.fillRect(cx - 4, y + 16, 8, 5)
  g.fillRect(cx - 2, y + 20, 5, 4)
  g.fillStyle = rgba(PAL.goldL, 0.85)
  g.fillRect(cx - 10, y - 8, 4, 1)
  g.fillRect(cx + 6, y + 5, 5, 1)
  g.fillRect(cx - 2, y - 12, 3, 1)
}

/** 当前项左侧的指示箭头，左右轻晃。 */
export function paintMenuCursor(g: G, x: number, y: number, t: number): void {
  const bob = Math.round(Math.sin(t * 6) * 3)
  const px = Math.round(x + Math.sin(t * 6) * 2)
  const cy = Math.round(y) + bob
  g.fillStyle = PAL.ink
  g.fillRect(px - 1, cy - 6, 4, 12)
  g.fillRect(px + 2, cy - 5, 3, 10)
  g.fillRect(px + 4, cy - 4, 3, 8)
  g.fillRect(px + 6, cy - 2, 3, 4)
  g.fillStyle = PAL.lamp1
  g.fillRect(px, cy - 5, 2, 10)
  g.fillRect(px + 2, cy - 4, 2, 8)
  g.fillRect(px + 4, cy - 3, 2, 6)
  g.fillRect(px + 6, cy - 1, 2, 2)
  g.fillStyle = PAL.goldL
  g.fillRect(px, cy - 5, 2, 1)
}

function paintIcon(g: G, icon: MenuIcon, x: number, y: number): void {
  if (icon === 'start') {
    g.fillStyle = PAL.lamp1
    g.fillRect(x + 2, y + 1, 3, 3)
    g.fillRect(x + 5, y + 4, 3, 4)
    g.fillRect(x + 8, y + 6, 2, 2)
    g.fillRect(x + 2, y + 8, 3, 3)
    g.fillStyle = PAL.goldL
    g.fillRect(x + 2, y + 1, 3, 1)
    return
  }
  if (icon === 'settings') {
    g.fillStyle = PAL.copperL
    g.fillRect(x + 1, y + 2, 10, 2)
    g.fillRect(x + 1, y + 8, 10, 2)
    g.fillStyle = PAL.lamp1
    g.fillRect(x + 7, y + 1, 3, 4)
    g.fillRect(x + 2, y + 7, 3, 4)
    return
  }
  if (icon === 'help') {
    g.fillStyle = PAL.paper
    g.fillRect(x + 1, y + 1, 5, 10)
    g.fillRect(x + 7, y + 1, 5, 10)
    g.fillStyle = PAL.wood1
    g.fillRect(x + 6, y + 1, 1, 10)
    g.fillStyle = PAL.ink2
    g.fillRect(x + 2, y + 3, 3, 1)
    g.fillRect(x + 2, y + 6, 3, 1)
    g.fillRect(x + 8, y + 3, 3, 1)
    g.fillRect(x + 8, y + 6, 3, 1)
    return
  }
  g.fillStyle = PAL.cream
  g.fillRect(x + 1, y + 2, 6, 8)
  g.fillStyle = PAL.ink
  g.fillRect(x + 3, y + 4, 2, 4)
  g.fillStyle = PAL.lamp2
  g.fillRect(x + 7, y + 5, 4, 2)
  g.fillRect(x + 9, y + 4, 2, 1)
  g.fillRect(x + 9, y + 7, 2, 1)
}

/** 横幅按钮。文字由调用方画在返回的锚点上，左对齐、垂直居中。 */
export function paintMenuButton(
  g: G,
  x: number,
  y: number,
  w: number,
  h: number,
  opt: { icon: MenuIcon; primary?: boolean; hot?: boolean; pressed?: boolean },
): { x: number; y: number } {
  const lift = opt.pressed ? 0 : opt.hot ? 2 : 0
  const yy = Math.round(y - lift)
  const face = opt.primary ? PAL.lamp1 : PAL.paper
  const lip = opt.primary ? PAL.orangeD : PAL.wood1
  const edge = opt.hot || opt.primary ? PAL.gold : PAL.copperD
  g.fillStyle = rgba(PAL.ink, 0.5)
  g.fillRect(x + 2, yy + h - 1, w, 3)
  pxRoundRect(g, x, yy, w, h, PAL.ink, 3)
  pxRoundRect(g, x + 1, yy + 1, w - 2, h - 2, lip, 2)
  const sink = opt.pressed ? 1 : 0
  pxRoundRect(g, x + 2, yy + 2 + sink, w - 4, h - 6, face, 2)
  g.fillStyle = opt.primary ? PAL.goldL : PAL.white
  g.globalAlpha = opt.primary ? 0.9 : 0.45
  g.fillRect(x + 4, yy + 3 + sink, w - 8, 1)
  g.globalAlpha = 1
  pxFrame(g, x + 1, yy + 1, w - 2, h - 2, edge, 2)
  const iy = yy + Math.round((h - 18) / 2) + sink
  pxRoundRect(g, x + 7, iy, 18, 18, PAL.ink, 2)
  paintIcon(g, opt.icon, x + 10, iy + 3)
  return { x: x + 32, y: yy + h / 2 + sink }
}

export interface DeckCardPaint {
  x: number
  y: number
  hot: boolean
  color: string
}

/** 行囊卡。返回抬起后的顶边，立绘和字都跟着它走。 */
export function paintDeckCard(g: G, card: DeckCardPaint, w: number, h: number): number {
  const lift = card.hot ? 8 : 0
  const x = card.x
  const y = card.y - lift
  if (card.hot) {
    g.fillStyle = rgba(card.color, 0.45)
    g.fillRect(x - 2, y - 2, w + 4, 3)
  }
  pxRoundRect(g, x + 2, y + 3, w, h, rgba(PAL.ink, 0.55), 3)
  pxRoundRect(g, x, y, w, h, card.hot ? PAL.lamp1 : PAL.ink, 3)
  pxRoundRect(g, x + 2, y + 2, w - 4, h - 4, PAL.tile1, 2)
  g.fillStyle = card.color
  g.fillRect(x + 8, y + 8, w - 16, 3)
  g.fillStyle = card.hot ? PAL.stoneL : PAL.slate
  g.fillRect(x + 16, y + h - 76, w - 32, 2)
  g.fillStyle = PAL.ink2
  g.fillRect(x + 10, y + h - 44, w - 20, 32)
  return y
}
