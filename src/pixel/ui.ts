/**
 * UI 基件：像素面板 / 键帽按钮 / 横幅底 / 卡框 / 条 / 虚线，以及带命中区的即时模式按钮。
 * 风格见《视觉风格指南》第九节：深木底 + 1px 亮边 + 2px 圆角像素；纸面板 cream；键帽顶部高光、底部 2px 暗唇。
 */
import { PAL, rgba, mix } from './palette'
import type { Input, Rect } from './input'
import type { TextLayer, TextOpt } from './text'

type G = CanvasRenderingContext2D

/** 像素圆角矩形（切角 r=2 的八边形感） */
export function pxRoundRect(g: G, x: number, y: number, w: number, h: number, fill: string, r = 2): void {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h)
  g.fillStyle = fill
  if (r <= 0) { g.fillRect(x, y, w, h); return }
  g.fillRect(x + r, y, w - r * 2, h)
  g.fillRect(x, y + r, w, h - r * 2)
  if (r >= 2) {
    g.fillRect(x + 1, y + 1, w - 2, h - 2)
  }
}

export function pxFrame(g: G, x: number, y: number, w: number, h: number, stroke: string, r = 2): void {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h)
  g.fillStyle = stroke
  g.fillRect(x + r, y, w - r * 2, 1)
  g.fillRect(x + r, y + h - 1, w - r * 2, 1)
  g.fillRect(x, y + r, 1, h - r * 2)
  g.fillRect(x + w - 1, y + r, 1, h - r * 2)
  if (r >= 2) {
    g.fillRect(x + 1, y + 1, 1, 1); g.fillRect(x + w - 2, y + 1, 1, 1)
    g.fillRect(x + 1, y + h - 2, 1, 1); g.fillRect(x + w - 2, y + h - 2, 1, 1)
  }
}

export type PanelStyle = 'wood' | 'paper' | 'dark' | 'glass' | 'cream'

/** 面板：木底 + 亮边；paper 为纸质文本区 */
export function panel(g: G, x: number, y: number, w: number, h: number, style: PanelStyle = 'wood'): void {
  if (style === 'wood') {
    pxRoundRect(g, x, y, w, h, PAL.ink, 3)
    pxRoundRect(g, x + 1, y + 1, w - 2, h - 2, PAL.wood1, 2)
    pxFrame(g, x + 1, y + 1, w - 2, h - 2, PAL.wood3, 2)
    g.fillStyle = PAL.wood2
    g.fillRect(x + 3, y + 3, w - 6, 1)
  } else if (style === 'paper') {
    pxRoundRect(g, x, y, w, h, PAL.ink2, 2)
    pxRoundRect(g, x + 1, y + 1, w - 2, h - 2, PAL.paper, 1)
    g.fillStyle = PAL.paperD
    g.fillRect(x + 1, y + h - 3, w - 2, 2)
    g.fillRect(x + w - 3, y + 1, 2, h - 2)
  } else if (style === 'cream') {
    pxRoundRect(g, x, y, w, h, PAL.ink, 2)
    pxRoundRect(g, x + 1, y + 1, w - 2, h - 2, PAL.cream, 1)
  } else if (style === 'dark') {
    pxRoundRect(g, x, y, w, h, rgba(PAL.shadow, 0.85), 3)
    pxFrame(g, x, y, w, h, rgba(PAL.wood3, 0.5), 3)
  } else {
    g.fillStyle = rgba(PAL.shadow, 0.6)
    g.fillRect(x, y, w, h)
  }
}

export interface ButtonStyle {
  primary?: boolean
  disabled?: boolean
  hover?: boolean
  pressed?: boolean
  small?: boolean
  danger?: boolean
  color?: string
}

/** 键帽按钮（只画像素部分）；返回文字应放的中心 */
export function keycap(g: G, x: number, y: number, w: number, h: number, st: ButtonStyle = {}): { cx: number; cy: number } {
  x = Math.round(x); y = Math.round(y)
  const lift = st.pressed ? 0 : st.hover && !st.disabled ? 1 : 0
  const base = st.disabled ? PAL.gray1 : st.danger ? PAL.lamp3 : st.primary ? PAL.lamp2 : st.color ?? PAL.wood2
  const top = st.disabled ? PAL.gray2 : st.danger ? '#ee6a58' : st.primary ? PAL.lamp1 : st.color ? mix(st.color, PAL.white, 0.25) : PAL.wood3
  const lip = st.disabled ? PAL.ink2 : st.danger ? PAL.redD : st.primary ? PAL.orangeD : st.color ? mix(st.color, PAL.ink, 0.45) : PAL.wood1
  const yy = y - lift
  // 外轮廓
  pxRoundRect(g, x, yy, w, h + lift, PAL.ink, 2)
  // 唇（底部 2px 暗）
  pxRoundRect(g, x + 1, yy + 1, w - 2, h - 2 + lift, lip, 1)
  // 面
  const faceH = h - 4 - (st.pressed ? 1 : 0)
  pxRoundRect(g, x + 1, yy + 1 + (st.pressed ? 1 : 0), w - 2, faceH, base, 1)
  // 顶部高光
  g.fillStyle = top
  g.fillRect(x + 2, yy + 2 + (st.pressed ? 1 : 0), w - 4, 1)
  g.fillRect(x + 2, yy + 3 + (st.pressed ? 1 : 0), 1, faceH - 3)
  return { cx: x + w / 2, cy: yy + 1 + (st.pressed ? 1 : 0) + faceH / 2 }
}

/** 横幅底：深色半透明带 + 上下 1px 暖线 */
export function bannerBg(g: G, y: number, h: number, alpha = 0.78, x = 0, w = 640): void {
  g.fillStyle = rgba(PAL.shadow, alpha)
  g.fillRect(x, y, w, h)
  g.fillStyle = rgba(PAL.lamp1, 0.7)
  g.fillRect(x, y, w, 1)
  g.fillRect(x, y + h - 1, w, 1)
}

/** 数值条 */
export function bar(g: G, x: number, y: number, w: number, h: number, ratio: number, fill: string, bg = PAL.ink2): void {
  pxRoundRect(g, x, y, w, h, PAL.ink, 1)
  g.fillStyle = bg
  g.fillRect(x + 1, y + 1, w - 2, h - 2)
  const fw = Math.round((w - 2) * Math.max(0, Math.min(1, ratio)))
  if (fw > 0) {
    g.fillStyle = fill
    g.fillRect(x + 1, y + 1, fw, h - 2)
    g.fillStyle = rgba(PAL.white, 0.35)
    g.fillRect(x + 1, y + 1, fw, 1)
  }
}

export function dashedLine(g: G, x1: number, y1: number, x2: number, y2: number, color: string, dash = 3, gap = 3): void {
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.hypot(dx, dy)
  if (len < 1) return
  const ux = dx / len, uy = dy / len
  g.fillStyle = color
  for (let d = 0; d < len; d += dash + gap) {
    const e = Math.min(len, d + dash)
    for (let k = d; k < e; k += 1) g.fillRect(Math.round(x1 + ux * k), Math.round(y1 + uy * k), 1, 1)
  }
}

/** 找不到资产时的占位块 */
export function placeholder(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle = PAL.gray1
  g.fillRect(x, y, w, h)
  g.fillStyle = PAL.gray3
  g.fillRect(x + 1, y + 1, w - 2, 1)
  g.fillRect(x + 1, y + 1, 1, h - 2)
  g.fillStyle = PAL.cream
  const cx = x + Math.floor(w / 2), cy = y + Math.floor(h / 2)
  g.fillRect(cx - 2, cy - 5, 4, 1); g.fillRect(cx + 1, cy - 4, 1, 2); g.fillRect(cx, cy - 2, 1, 1); g.fillRect(cx - 1, cy - 1, 1, 2); g.fillRect(cx - 1, cy + 2, 1, 1)
}

/** 卡框：外 ink，内体系色边，底 cream / paper */
export function cardFrame(g: G, x: number, y: number, w: number, h: number, edge: string, face: string = PAL.paper, opt: { selected?: boolean; dim?: boolean; back?: boolean } = {}): void {
  x = Math.round(x); y = Math.round(y)
  pxRoundRect(g, x, y, w, h, opt.selected ? PAL.lamp1 : PAL.ink, 2)
  pxRoundRect(g, x + 1, y + 1, w - 2, h - 2, edge, 2)
  pxRoundRect(g, x + 3, y + 3, w - 6, h - 6, face, 1)
  if (opt.dim) { g.fillStyle = rgba(PAL.shadow, 0.45); g.fillRect(x + 1, y + 1, w - 2, h - 2) }
}

/** 即时模式 UI 套件：按钮 = 像素键帽 + 文字 + 命中区 */
export class UiKit {
  constructor(public input: Input, public text: TextLayer, public g: G) {}

  button(id: string, r: Rect, label: string, onClick: () => void, st: ButtonStyle = {}, textOpt: TextOpt = {}): void {
    const hover = this.input.isHover(id)
    const pressed = this.input.isPressed(id)
    const { cx, cy } = keycap(this.g, r.x, r.y, r.w, r.h, { ...st, hover, pressed })
    const size = textOpt.size ?? (st.small ? 11 : 13)
    this.text.draw(label, cx, cy, { size, align: 'center', baseline: 'middle', color: st.disabled ? PAL.gray3 : st.primary ? PAL.ink : PAL.paper, bold: true, maxWidth: r.w - 8, ...textOpt })
    if (!st.disabled) this.input.region({ id, rect: r, onClick, z: 10 })
  }

  /** 只注册命中区（自绘的可点元素） */
  hit(id: string, r: Rect, onClick: (x: number, y: number) => void, z = 5, cursor: 'pointer' | 'grab' | 'default' = 'pointer'): void {
    this.input.region({ id, rect: r, onClick, z, cursor })
  }
}
