/**
 * 补间薄封装：只对普通对象属性做 tween，不碰 DOM。
 * 自带缓动与时间线，支持全局快进（speed）。所有演出都通过这里，Space 快进才能统一生效。
 */
export type Ease = (t: number) => number

export const ease = {
  linear: (t: number) => t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inQuad: (t: number) => t * t,
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2) },
  outBackSoft: (t: number) => { const c1 = 0.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2) },
  outElastic: (t: number) => { const c4 = (2 * Math.PI) / 3; return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1 },
  outBounce: (t: number) => { const n1 = 7.5625, d1 = 2.75; if (t < 1 / d1) return n1 * t * t; if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75; if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375; return n1 * (t -= 2.625 / d1) * t + 0.984375 },
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
} satisfies Record<string, Ease>

interface Job {
  obj: Record<string, number>
  from: Record<string, number>
  to: Record<string, number>
  dur: number
  t: number
  ease: Ease
  resolve: () => void
  onUpdate?: (k: number) => void
  done: boolean
}

class Tweener {
  private jobs: Job[] = []
  private waits: { t: number; resolve: () => void }[] = []
  /** 全局速度：1 正常；4 快进 */
  speed = 1

  update(dt: number): void {
    const d = dt * this.speed
    for (const j of this.jobs) {
      j.t += d
      const k = j.dur <= 0 ? 1 : Math.min(1, j.t / j.dur)
      const e = j.ease(k)
      for (const key of Object.keys(j.to)) j.obj[key] = j.from[key] + (j.to[key] - j.from[key]) * e
      j.onUpdate?.(k)
      if (k >= 1) { j.done = true }
    }
    const finished = this.jobs.filter((j) => j.done)
    this.jobs = this.jobs.filter((j) => !j.done)
    for (const j of finished) j.resolve()
    for (const w of this.waits) w.t -= d
    const dw = this.waits.filter((w) => w.t <= 0)
    this.waits = this.waits.filter((w) => w.t > 0)
    for (const w of dw) w.resolve()
  }

  to(obj: object, to: Record<string, number>, dur: number, e: Ease = ease.outQuad, onUpdate?: (k: number) => void): Promise<void> {
    return new Promise((resolve) => {
      const from: Record<string, number> = {}
      const target: Record<string, number> = {}
      for (const [k, v] of Object.entries(to)) {
        if (typeof v !== 'number') continue
        from[k] = (obj as Record<string, number>)[k] ?? 0
        target[k] = v
      }
      // 同对象同属性的旧任务立即结束（不回调 resolve 两次的风险：旧 promise 仍会在下一帧 resolve）
      for (const j of this.jobs) if (j.obj === obj) for (const k of Object.keys(target)) if (k in j.to) { delete j.to[k] }
      this.jobs.push({ obj: obj as Record<string, number>, from, to: target, dur, t: 0, ease: e, resolve, onUpdate, done: false })
    })
  }

  wait(sec: number): Promise<void> {
    return new Promise((resolve) => this.waits.push({ t: sec, resolve }))
  }

  /** 取消某对象上的全部补间（不 resolve 也不再改值——由调用方接管） */
  kill(obj: object): void {
    for (const j of this.jobs) if (j.obj === obj) { j.to = {}; j.done = true }
  }

  /** 跳过所有进行中的补间与等待（快进到底） */
  skipAll(): void {
    for (const j of this.jobs) { for (const k of Object.keys(j.to)) j.obj[k] = j.to[k]; j.done = true }
    for (const w of this.waits) w.t = 0
  }
}

export const tw = new Tweener()
export const tween = tw.to.bind(tw)
export const wait = tw.wait.bind(tw)

/** 简单的时间驱动值：用于闪烁 / 浮动 */
export const osc = (t: number, period: number, lo = 0, hi = 1) => lo + (hi - lo) * (0.5 + 0.5 * Math.sin((t / period) * Math.PI * 2))
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
