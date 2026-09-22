/**
 * 文字层：正常字体（矢量、抗锯齿）按设备分辨率画在显示画布上，不受像素网格约束。
 * API 只接收逻辑坐标 / 逻辑字号，内部乘 scale；场景在 render 里调用时命令被缓存，
 * 在像素层 blit 之后统一执行，保证文字永远在最上面。
 */
export interface TextOpt {
  size?: number             // 逻辑字号，缺省 12
  color?: string
  align?: CanvasTextAlign   // 缺省 left
  baseline?: CanvasTextBaseline // 缺省 top
  stroke?: string | false   // 描边色，缺省不描
  strokeWidth?: number      // 逻辑宽，缺省 2
  bold?: boolean
  alpha?: number
  maxWidth?: number         // 逻辑宽，超出则缩字
  font?: string
  shadow?: boolean          // 1px 下方阴影
}

export const FONT_STACK = '"Noto Sans SC", "Source Han Sans SC", "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", system-ui, sans-serif'
export const FONT_ROUND = '"Noto Sans SC", "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", system-ui, sans-serif'

export interface TextBox { x: number; y: number; w: number; h: number }

/** 按 align / baseline 把锚点换成左上角包围盒。 */
export function textBox(
  x: number,
  y: number,
  w: number,
  h: number,
  align: CanvasTextAlign = 'left',
  baseline: CanvasTextBaseline = 'top',
): TextBox {
  let bx = x
  if (align === 'center') bx = x - w / 2
  else if (align === 'right') bx = x - w
  let by = y
  if (baseline === 'middle') by = y - h / 2
  else if (baseline === 'bottom' || baseline === 'alphabetic') by = y - h
  return { x: bx, y: by, w, h }
}

export function rectsOverlap(a: TextBox, b: TextBox): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

interface Cmd extends TextBox { fn: (g: CanvasRenderingContext2D) => void }

export class TextLayer {
  private cmds: Cmd[] = []
  private measurer: CanvasRenderingContext2D
  scale = 1
  debug = false

  constructor() {
    const c = document.createElement('canvas')
    this.measurer = c.getContext('2d')!
  }

  private font(size: number, bold?: boolean, family?: string): string {
    return `${bold ? '700' : '500'} ${Math.max(1, Math.round(size * this.scale))}px ${family ?? FONT_STACK}`
  }

  private measureCache = new Map<string, number>()
  /** 逻辑宽度（带缓存） */
  measure(str: string, size = 12, bold = false): number {
    const key = `${this.scale}|${size}|${bold}|${str}`
    const hit = this.measureCache.get(key)
    if (hit !== undefined) return hit
    this.measurer.font = this.font(size, bold)
    const w = this.measurer.measureText(str).width / this.scale
    if (this.measureCache.size > 4000) this.measureCache.clear()
    this.measureCache.set(key, w)
    return w
  }

  private wrapCache = new Map<string, string[]>()
  private memo(key: string, f: () => string[]): string[] {
    const hit = this.wrapCache.get(key)
    if (hit) return hit
    const v = f()
    if (this.wrapCache.size > 600) this.wrapCache.clear()
    this.wrapCache.set(key, v)
    return v
  }

  /** 中文逐字换行；英文单词尽量不拆 */
  wrap(str: string, width: number, size = 12, bold = false): string[] {
    return this.memo(`w|${this.scale}|${width}|${size}|${bold}|${str}`, () => this.wrapRaw(str, width, size, bold))
  }
  private wrapRaw(str: string, width: number, size: number, bold: boolean): string[] {
    const lines: string[] = []
    for (const para of str.split('\n')) {
      let line = ''
      for (const ch of para) {
        const test = line + ch
        if (line && this.measure(test.replace(/\*\*/g, ''), size, bold) > width) {
          lines.push(line)
          line = ch
        } else line = test
      }
      lines.push(line)
    }
    return lines
  }

  draw(str: string, x: number, y: number, opt: TextOpt = {}): void {
    if (!str) return
    const s = this.scale
    let size = opt.size ?? 12
    let width = this.measure(str, size, opt.bold)
    if (opt.maxWidth && width > opt.maxWidth) {
      size = Math.max(7, size * (opt.maxWidth / width))
      width = this.measure(str, size, opt.bold)
    }
    const pad = opt.stroke ? (opt.strokeWidth ?? 2) : 0
    const box = textBox(x, y, width, size * 1.2, opt.align, opt.baseline)
    box.x -= pad
    box.y -= pad * 0.5
    box.w += pad * 2
    box.h += pad
    this.cmds.push({ ...box, fn: (g) => {
      g.save()
      g.font = this.font(size, opt.bold, opt.font)
      g.textAlign = opt.align ?? 'left'
      g.textBaseline = opt.baseline ?? 'top'
      if (opt.alpha !== undefined) g.globalAlpha = opt.alpha
      const px = Math.round(x * s), py = Math.round(y * s)
      if (opt.shadow) {
        g.fillStyle = 'rgba(20,16,32,0.55)'
        g.fillText(str, px, py + Math.max(1, Math.round(s * 0.7)))
      }
      if (opt.stroke) {
        g.lineJoin = 'round'
        g.lineWidth = (opt.strokeWidth ?? 2) * s
        g.strokeStyle = opt.stroke
        g.strokeText(str, px, py)
      }
      g.fillStyle = opt.color ?? '#f5e6c8'
      g.fillText(str, px, py)
      if (this.debug) {
        g.strokeStyle = 'rgba(255,0,255,0.6)'
        g.lineWidth = 1
        g.strokeRect(Math.round(box.x * s), Math.round(box.y * s), Math.round(box.w * s), Math.round(box.h * s))
      }
      g.restore()
    } })
  }

  /**
   * 遮挡：丢掉包围盒与矩形相交的已排队文字。像素层的面板 / 检视 / 对话框盖住下面元素时调用，
   * 否则下层文字会透过面板显示（文字层永远在最上）。按字形盒而不是锚点判断，避免居中文字漏网。
   */
  occlude(x: number, y: number, w: number, h: number): void {
    const cover = { x, y, w, h }
    this.cmds = this.cmds.filter((c) => !rectsOverlap(c, cover))
  }
  occludeAll(): void { this.cmds.length = 0 }

  /** 带 **高亮** 的富文本：一行内按段落切换颜色 */
  rich(str: string, x: number, y: number, opt: TextOpt & { hl?: string } = {}): number {
    const size = opt.size ?? 12
    const segs = str.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
    let cx = x
    // 居中时先算总宽
    if (opt.align === 'center') {
      const total = segs.reduce((a, seg) => a + this.measure(seg.replace(/\*\*/g, ''), size, opt.bold), 0)
      cx = x - total / 2
    }
    for (const seg of segs) {
      const hl = seg.startsWith('**')
      const t = seg.replace(/\*\*/g, '')
      this.draw(t, cx, y, { ...opt, align: 'left', color: hl ? (opt.hl ?? '#ffd27a') : opt.color, bold: hl || opt.bold })
      cx += this.measure(t, size, hl || opt.bold)
    }
    return cx - x
  }

  /** 多行富文本，返回行数 */
  paragraph(str: string, x: number, y: number, width: number, opt: TextOpt & { hl?: string; lineHeight?: number } = {}): number {
    const size = opt.size ?? 12
    const lh = opt.lineHeight ?? Math.round(size * 1.45)
    const lines = this.wrapRich(str, width, size, opt.bold)
    lines.forEach((ln, i) => this.rich(ln, x, y + i * lh, opt))
    return lines.length
  }

  /** 富文本换行：保证 ** 成对不被拆散（把高亮段视为整体） */
  wrapRich(str: string, width: number, size = 12, bold = false): string[] {
    return this.memo(`r|${this.scale}|${width}|${size}|${bold}|${str}`, () => this.wrapRichRaw(str, width, size, bold))
  }
  private wrapRichRaw(str: string, width: number, size: number, bold: boolean): string[] {
    const tokens: string[] = []
    for (const para of str.split('\n')) {
      const segs = para.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
      for (const seg of segs) {
        if (seg.startsWith('**')) tokens.push(seg)
        else for (const ch of seg) tokens.push(ch)
      }
      tokens.push('\n')
    }
    tokens.pop()
    const lines: string[] = []
    let line = ''
    for (const tk of tokens) {
      if (tk === '\n') { lines.push(line); line = ''; continue }
      const test = line + tk
      if (line && this.measure(test.replace(/\*\*/g, ''), size, bold) > width) {
        lines.push(line)
        line = tk
      } else line = test
    }
    lines.push(line)
    return lines
  }

  /** 由 Stage 在 blit 之后调用 */
  flush(g: CanvasRenderingContext2D): void {
    for (const c of this.cmds) c.fn(g)
    this.cmds.length = 0
  }
  discard(): void { this.cmds.length = 0 }
}
