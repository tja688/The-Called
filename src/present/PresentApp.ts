/**
 * 像素表现层壳：事件队列（按规则结算顺序逐个 await 演出）+ 场景路由。
 * 只对 GameService 的命令 / 查询 / 事件说话。
 */
import type { GameService } from '../application/GameService'
import type { DomainEvent } from '../core/messages'
import type { RunEvent } from '../domain/run/events'
import type { RunView } from '../application/readmodels/RunView'
import type { GameCommand } from '../application/commands'
import type { GameQuery, QueryResultOf } from '../application/queries'
import { Stage, type Renderable } from '../pixel/stage'
import { Input } from '../pixel/input'
import { UiKit, bannerBg, pxRoundRect } from '../pixel/ui'
import type { TextLayer } from '../pixel/text'
import { tw, tween, wait, ease, clamp } from '../pixel/tween'
import { PAL, rgba } from '../pixel/palette'
import { flash } from '../pixel/light'
import { audio } from '../audio/audio'
import { ask, send } from './bus'
import type { Scene } from './Scene'
import { TitleScene } from './scenes/TitleScene'
import { MapScene } from './scenes/MapScene'
import { EventScene } from './scenes/EventScene'
import { RewardScene } from './scenes/RewardScene'
import { BattleScene } from './scenes/BattleScene'
import { EndingScene } from './scenes/EndingScene'
import { ShopScene } from './scenes/ShopScene'
import { RestScene } from './scenes/RestScene'
import { ForgeScene } from './scenes/ForgeScene'
import { ChestScene } from './scenes/ChestScene'

interface Toast { text: string; t: number; y: number }
interface Banner { text: string; sub?: string; t: number; hold: number; color: string }

export class PresentApp implements Renderable {
  readonly stage: Stage
  readonly input: Input
  readonly ui: UiKit
  scene: Scene | null = null
  private queue: DomainEvent[] = []
  private pumping = false
  fade = 0
  shake = 0
  flashA = 0
  time = 0
  private toasts: Toast[] = []
  private banner: Banner | null = null
  debug = new URLSearchParams(location.search).get('debug') === '1'

  constructor(public game: GameService, host: HTMLElement) {
    this.stage = new Stage(host)
    this.input = new Input(this.stage)
    this.ui = new UiKit(this.input, this.stage.text, this.stage.ui)
    this.input.onKey = (k, e) => this.onKey(k, e)
    this.input.onAnyClick = (x, y, hit) => this.scene?.onAnyClick(x, y, hit)
    game.on('*', (e) => this.enqueue(e))
    this.stage.target = this
    void this.go(new TitleScene(this), 'none')
    this.stage.start()
    if (this.debug) this.attachDebug()
  }

  ask<Q extends GameQuery>(q: Q): QueryResultOf<Q> { return ask(this.game, q) }
  view(): RunView | null { return this.ask({ type: 'run.view' }) }

  send(c: GameCommand): void {
    void send(this.game, c).catch((err) => {
      this.toast(err instanceof Error ? err.message : String(err), 48)
    })
  }

  get busy(): boolean { return this.pumping || this.queue.length > 0 }

  update(dt: number): void {
    this.time += dt
    tw.update(dt)
    this.input.locked = this.busy
    this.scene?.update(dt)
    for (const t of this.toasts) t.t += dt
    this.toasts = this.toasts.filter((t) => t.t < 2.2)
    if (this.banner) {
      this.banner.t += dt * tw.speed
      if (this.banner.t > this.banner.hold + 0.6) this.banner = null
    }
    this.shake = Math.max(0, this.shake - dt * 8)
    this.flashA = Math.max(0, this.flashA - dt * 2.5)
  }

  render(world: CanvasRenderingContext2D, ui: CanvasRenderingContext2D, text: TextLayer): void {
    this.input.begin()
    if (this.shake > 0) {
      const dx = Math.round((Math.random() - 0.5) * this.shake * 3)
      const dy = Math.round((Math.random() - 0.5) * this.shake * 3)
      world.translate(dx, dy)
      ui.translate(dx, dy)
    }
    this.scene?.render(world, ui, text)
    if (this.flashA > 0) flash(ui, this.flashA)
    this.renderBanner(ui, text)
    this.renderToasts(ui, text)
    this.renderMute(ui, text)
    if (this.fade > 0) {
      ui.setTransform(1, 0, 0, 1, 0, 0)
      ui.fillStyle = rgba('#0a0810', this.fade)
      ui.fillRect(0, 0, 640, 360)
    }
    this.input.end()
  }

  private renderBanner(g: CanvasRenderingContext2D, text: TextLayer): void {
    const b = this.banner
    if (!b) return
    const inK = clamp(b.t / 0.28, 0, 1), outK = clamp((b.t - b.hold - 0.3) / 0.3, 0, 1)
    const k = ease.outBack(inK) * (1 - ease.inQuad(outK))
    const h = b.sub ? 54 : 40
    const y = Math.round(150 - h / 2)
    text.occlude(0, y - 4, 640, h + 8)
    g.save()
    g.globalAlpha = clamp(k, 0, 1)
    g.translate(0, Math.round((1 - k) * -30))
    bannerBg(g, y, h, 0.8)
    g.fillStyle = b.color
    g.fillRect(0, y + 1, 640, 2)
    text.draw(b.text, 320, y + (b.sub ? 10 : 12), { size: 18, bold: true, color: b.color, align: 'center', stroke: PAL.ink, strokeWidth: 3, alpha: clamp(k, 0, 1) })
    if (b.sub) text.draw(b.sub, 320, y + 34, { size: 11, color: PAL.cream, align: 'center', alpha: clamp(k, 0, 1) })
    g.restore()
  }

  private renderToasts(g: CanvasRenderingContext2D, text: TextLayer): void {
    this.toasts.forEach((t, i) => {
      const k = clamp(t.t / 0.2, 0, 1), out = clamp((t.t - 1.7) / 0.5, 0, 1)
      const w = Math.min(600, text.measure(t.text, 11) + 30)
      const x = Math.round(320 - w / 2), y = Math.round(t.y - i * 22 - (1 - ease.outBack(k)) * 12)
      g.save()
      g.globalAlpha = k * (1 - out)
      pxRoundRect(g, x, y, w, 20, PAL.ink, 2)
      pxRoundRect(g, x + 1, y + 1, w - 2, 18, PAL.wood1, 1)
      text.draw(t.text, x + 10, y + 10, { size: 11, color: PAL.cream, baseline: 'middle', alpha: k * (1 - out) })
      g.restore()
    })
  }

  private renderMute(_g: CanvasRenderingContext2D, text: TextLayer): void {
    const label = audio.muted ? '音效关' : '音效开'
    this.ui.button('mute', { x: 576, y: 4, w: 56, h: 18 }, label, () => audio.toggle(), { small: true }, { size: 9 })
    text.draw('M', 606, 22, { size: 8, color: PAL.gray2, align: 'center' })
  }

  toast(text: string, y = 60): void {
    this.toasts.unshift({ text, t: 0, y })
    if (this.toasts.length > 4) this.toasts.length = 4
  }

  async showBanner(text: string, sub?: string, hold = 0.8, color: string = PAL.lamp1): Promise<void> {
    this.banner = { text, sub, t: 0, hold, color }
    await wait(hold + 0.45)
  }

  async go(next: Scene, transition: 'fade' | 'none' = 'fade'): Promise<void> {
    if (transition === 'fade') await tween(this, { fade: 1 }, 0.18, ease.inQuad)
    this.scene?.exit()
    this.scene = next
    next.enter()
    if (transition === 'fade') await tween(this, { fade: 0 }, 0.22, ease.outQuad)
  }

  private enqueue(e: DomainEvent): void {
    this.queue.push(e)
    this.input.locked = true
    if (!this.pumping) void this.pump()
  }

  private async pump(): Promise<void> {
    this.pumping = true
    this.input.locked = true
    while (this.queue.length) {
      const e = this.queue.shift()!
      try {
        await this.route(e)
        await this.scene?.handle(e)
      } catch (err) {
        console.error('[present] error on', e.type, err)
      }
    }
    this.pumping = false
    this.input.locked = false
  }

  private async route(e: DomainEvent): Promise<void> {
    if (e.type === 'run.hpChanged') {
      const ev = e as Extract<RunEvent, { type: 'run.hpChanged' }>
      this.toast(ev.text, 44)
      this.flashA = 0.35
      audio.sfx('hurt')
      return
    }
    if (e.type === 'run.cardBoxed') {
      this.toast((e as Extract<RunEvent, { type: 'run.cardBoxed' }>).text, 70)
      audio.sfx('reward')
      return
    }
    if (e.type === 'battle.started' || e.type === 'run.battleQueued') {
      if (this.scene?.name !== 'battle') await this.go(new BattleScene(this), 'fade')
      return
    }
    if (e.type !== 'run.screen') return
    const ev = e as Extract<RunEvent, { type: 'run.screen' }>
    if (ev.screen === 'battle') {
      if (this.scene?.name !== 'battle') await this.go(new BattleScene(this), 'fade')
      return
    }
    if (ev.screen === 'map' && this.scene?.name !== 'map') await this.go(new MapScene(this))
    else if (ev.screen === 'event' && this.scene?.name !== 'event') await this.go(new EventScene(this))
    else if (ev.screen === 'reward' && this.scene?.name !== 'reward') await this.go(new RewardScene(this))
    else if (ev.screen === 'shop' && this.scene?.name !== 'shop') await this.go(new ShopScene(this))
    else if (ev.screen === 'rest' && this.scene?.name !== 'rest') await this.go(new RestScene(this))
    else if (ev.screen === 'forge' && this.scene?.name !== 'forge') await this.go(new ForgeScene(this))
    else if (ev.screen === 'chest' && this.scene?.name !== 'chest') await this.go(new ChestScene(this))
    else if (ev.screen === 'over' && this.scene?.name !== 'ending') await this.go(new EndingScene(this))
  }

  private onKey(k: string, e: KeyboardEvent): void {
    if (k === ' ') {
      tw.speed = 4
      e.preventDefault()
      window.addEventListener('keyup', () => { tw.speed = 1 }, { once: true })
      return
    }
    if (k === 'm' || k === 'M') audio.toggle()
    if (k === 'Escape') this.scene?.onCancel()
    if (k === 'Enter') this.scene?.onConfirm()
    if (k === 'F3') {
      this.debug = !this.debug
      if (this.debug) this.attachDebug()
      else this.stage.overlay = null
    }
  }

  private attachDebug(): void {
    this.stage.overlay = () => {
      this.stage.text.draw(`${this.stage.fps} fps · ${this.scene?.name} · q ${this.queue.length}`, 4, 350, { size: 8, color: PAL.gray3 })
    }
  }
}
