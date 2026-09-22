/**
 * 输入：指针事件 → 逻辑坐标；命中区每帧由场景重新注册（即时模式 UI）。
 * 点击 = 在同一个 id 上按下并抬起。最小命中 24×24 由调用方保证。
 */
import type { Stage } from './stage'

export interface Rect { x: number; y: number; w: number; h: number }
export interface HitRegion {
  id: string
  rect: Rect
  onClick?: (x: number, y: number) => void
  onDown?: (x: number, y: number) => void
  onHover?: () => void
  cursor?: 'pointer' | 'grab' | 'default'
  /** 层级：大的优先命中（面板 > 场景） */
  z?: number
  /** 右键 / 长按等扩展：暂不用 */
}

export const inRect = (r: Rect, x: number, y: number) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h

export class Input {
  x = -1
  y = -1
  down = false
  hover: string | null = null
  private regions: HitRegion[] = []
  private downId: string | null = null
  private downPos = { x: 0, y: 0 }
  /** 键盘：按下瞬间回调 */
  onKey: ((key: string, e: KeyboardEvent) => void) | null = null
  keys = new Set<string>()
  /** 任意点击（用于对话推进等全局监听），在区域回调之后触发 */
  onAnyClick: ((x: number, y: number, hit: string | null) => void) | null = null
  /** 屏蔽全部输入（演出中） */
  locked = false
  private lastCursor = ''

  constructor(private stage: Stage) {
    const el = stage.display
    el.style.touchAction = 'none'
    el.addEventListener('pointermove', (e) => { const p = stage.toLogical(e.clientX, e.clientY); this.x = p.x; this.y = p.y })
    el.addEventListener('contextmenu', (e) => e.preventDefault())
    el.addEventListener('pointerdown', (e) => {
      const p = stage.toLogical(e.clientX, e.clientY); this.x = p.x; this.y = p.y
      if (e.button === 2) {
        e.preventDefault()
        this.onKey?.('Escape', e as unknown as KeyboardEvent)
        return
      }
      this.down = true
      if (this.locked) return
      const r = this.pick(p.x, p.y)
      this.downId = r?.id ?? null
      this.downPos = { x: p.x, y: p.y }
      r?.onDown?.(p.x, p.y)
      try { el.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    })
    el.addEventListener('pointerup', (e) => {
      const p = stage.toLogical(e.clientX, e.clientY); this.x = p.x; this.y = p.y
      this.down = false
      const wasDown = this.downId
      this.downId = null
      if (this.locked) { this.onAnyClick?.(p.x, p.y, null); return }
      const r = this.pick(p.x, p.y)
      if (r && r.id === wasDown && r.onClick) r.onClick(p.x, p.y)
      this.onAnyClick?.(p.x, p.y, r?.id ?? null)
    })
    el.addEventListener('pointerleave', () => { this.x = -1; this.y = -1 })
    window.addEventListener('keydown', (e) => {
      this.keys.add(e.key)
      if (e.key === ' ' && e.target === document.body) e.preventDefault()
      this.onKey?.(e.key, e)
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.key))
    window.addEventListener('blur', () => this.keys.clear())
  }

  /** 场景每帧开头调用 */
  begin(): void { this.regions.length = 0 }

  region(r: HitRegion): void { this.regions.push(r) }

  /** 场景每帧结尾调用：更新 hover 与光标 */
  end(): void {
    const r = this.locked ? null : this.pick(this.x, this.y)
    this.hover = r?.id ?? null
    r?.onHover?.()
    const cur = r ? (r.cursor ?? 'pointer') : 'default'
    if (cur !== this.lastCursor) { this.stage.display.style.cursor = cur; this.lastCursor = cur }
  }

  private pick(x: number, y: number): HitRegion | null {
    let best: HitRegion | null = null
    for (const r of this.regions) {
      if (!inRect(r.rect, x, y)) continue
      if (!best || (r.z ?? 0) >= (best.z ?? 0)) best = r
    }
    return best
  }

  isHover(id: string): boolean { return this.hover === id }
  isPressed(id: string): boolean { return this.down && this.downId === id && this.hover === id }
}
