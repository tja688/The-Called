/**
 * Stage：两张 640×360 逻辑画布（world / ui，像素层，nearest 放大）+ 设备分辨率文字层，
 * 整数倍放大 + letterbox，rAF 主循环，dt 上限 50ms。
 * 开发参数：?scale=2 固定倍数；?raf=timeout 后台驱动；?debugText=1 画文字框。
 */
import { makeCanvas } from './dsl'
import { TextLayer } from './text'

export const W = 640
export const H = 360

export interface Renderable {
  update(dt: number): void
  render(world: CanvasRenderingContext2D, ui: CanvasRenderingContext2D, text: TextLayer): void
}

export class Stage {
  readonly world: CanvasRenderingContext2D
  readonly ui: CanvasRenderingContext2D
  readonly worldCanvas: HTMLCanvasElement
  readonly uiCanvas: HTMLCanvasElement
  readonly display: HTMLCanvasElement
  readonly g: CanvasRenderingContext2D
  readonly text = new TextLayer()
  scale = 1
  /** 显示画布在容器内的 CSS 偏移（letterbox） */
  offX = 0
  offY = 0
  cssScale = 1
  time = 0
  fps = 0
  private last = 0
  private frames = 0
  private fpsT = 0
  private fixedScale: number | null
  private useTimeout: boolean
  target: Renderable | null = null
  /** 每帧在 render 后、blit 前调用（画调试信息等） */
  overlay: ((g: CanvasRenderingContext2D) => void) | null = null

  constructor(private host: HTMLElement) {
    const w = makeCanvas(W, H), u = makeCanvas(W, H)
    this.worldCanvas = w.c; this.world = w.g
    this.uiCanvas = u.c; this.ui = u.g
    this.display = document.createElement('canvas')
    this.display.id = 'display'
    this.display.style.imageRendering = 'pixelated'
    this.g = this.display.getContext('2d')!
    host.append(this.display)
    const q = new URLSearchParams(location.search)
    this.fixedScale = q.get('scale') ? Number(q.get('scale')) : null
    this.useTimeout = q.get('raf') === 'timeout'
    this.text.debug = q.get('debugText') === '1'
    this.fit()
    new ResizeObserver(() => this.fit()).observe(host)
    window.addEventListener('resize', () => this.fit())
  }

  fit(): void {
    const dpr = window.devicePixelRatio || 1
    const cw = this.host.clientWidth || window.innerWidth
    const ch = this.host.clientHeight || window.innerHeight
    let s = this.fixedScale ?? Math.floor(Math.min((cw * dpr) / W, (ch * dpr) / H))
    s = Math.max(1, s)
    this.scale = s
    this.display.width = W * s
    this.display.height = H * s
    // CSS 尺寸 = 设备像素 / dpr，保证 1 逻辑像素 = s 设备像素
    const cssW = (W * s) / dpr, cssH = (H * s) / dpr
    this.display.style.width = `${cssW}px`
    this.display.style.height = `${cssH}px`
    this.offX = Math.floor((cw - cssW) / 2)
    this.offY = Math.floor((ch - cssH) / 2)
    this.display.style.left = `${this.offX}px`
    this.display.style.top = `${this.offY}px`
    this.cssScale = s / dpr
    this.g.imageSmoothingEnabled = false
    this.text.scale = s
  }

  /** 屏幕（client）坐标 → 逻辑坐标 */
  toLogical(cx: number, cy: number): { x: number; y: number } {
    const r = this.display.getBoundingClientRect()
    return { x: (cx - r.left) / this.cssScale, y: (cy - r.top) / this.cssScale }
  }

  start(): void {
    this.last = performance.now()
    const tick = () => {
      const now = performance.now()
      const dt = Math.min(0.05, (now - this.last) / 1000)
      this.last = now
      this.time += dt
      this.frames++
      this.fpsT += dt
      if (this.fpsT >= 0.5) { this.fps = Math.round(this.frames / this.fpsT); this.frames = 0; this.fpsT = 0 }
      try { this.frame(dt) } catch (err) { console.error('[stage] frame error', err); this.text.discard() }
      if (this.useTimeout) setTimeout(tick, 16)
      else requestAnimationFrame(tick)
    }
    tick()
    // 切回前台时若 rAF 长时间未触发，用 timeout 兜底一帧
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.last = performance.now() })
  }

  /** 手动推进 n 帧（无头验收：后台标签页的定时器会被浏览器节流） */
  step(frames = 1, dt = 1 / 60): void {
    for (let i = 0; i < frames; i++) { this.time += dt; this.frame(dt) }
    this.last = performance.now()
  }

  private frame(dt: number): void {
    const t = this.target
    this.world.setTransform(1, 0, 0, 1, 0, 0)
    this.ui.setTransform(1, 0, 0, 1, 0, 0)
    this.world.globalAlpha = 1
    this.ui.globalAlpha = 1
    this.world.globalCompositeOperation = 'source-over'
    this.ui.globalCompositeOperation = 'source-over'
    this.world.clearRect(0, 0, W, H)
    this.ui.clearRect(0, 0, W, H)
    if (t) {
      try {
        t.update(dt)
        t.render(this.world, this.ui, this.text)
      } catch (err) {
        console.error('[stage] render error', err)
        this.text.discard()
      }
    }
    this.overlay?.(this.ui)
    const g = this.g
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.imageSmoothingEnabled = false
    g.fillStyle = '#0a0810'
    g.fillRect(0, 0, this.display.width, this.display.height)
    g.drawImage(this.worldCanvas, 0, 0, this.display.width, this.display.height)
    g.drawImage(this.uiCanvas, 0, 0, this.display.width, this.display.height)
    this.text.flush(g)
  }
}
