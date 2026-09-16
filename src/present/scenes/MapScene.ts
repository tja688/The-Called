import { Scene } from '../Scene'
import type { TextLayer } from '../../pixel/text'
import { PAL, rgba } from '../../pixel/palette'
import { bakeSky } from '../../pixel/sky'
import { duskWash, vignette, glow } from '../../pixel/light'
import { panel, pxRoundRect } from '../../pixel/ui'
import { ASSETS } from '../../pixel/assets'
import { blit } from '../../pixel/dsl'
import { NODE_LABEL, type NodeId } from '../../domain/types'
import { audio } from '../../audio/audio'
import { MAP } from '../layout'
import { drawHpBar } from '../widgets'
import { DeckEditor } from '../overlays/DeckEditor'
import type { DomainEvent } from '../../core/messages'

const ORDER: NodeId[] = ['yuZhuang', 'drawer', 'boShou', 'shouMen']

export class MapScene extends Scene {
  readonly name = 'map' as const
  private t = 0
  private sky = bakeSky('dusk', 640, 220)
  private deck = new DeckEditor(this.app)
  private openDeck = false
  private bob = new Map<string, number>()

  enter(): void {
    audio.atmosphere(null)
    for (const id of ORDER) this.bob.set(id, Math.random() * 6)
  }

  update(dt: number): void {
    this.t += dt
  }

  async handle(e: DomainEvent): Promise<void> {
    if (e.type === 'run.deckChanged') this.app.toast('牌组已改', 52)
  }

  render(world: CanvasRenderingContext2D, ui: CanvasRenderingContext2D, text: TextLayer): void {
    world.drawImage(this.sky, 0, 0)
    duskWash(world, 0.1)
    // 桌面路径
    world.fillStyle = PAL.wood1
    world.fillRect(0, 210, 640, 150)
    world.fillStyle = PAL.wood2
    world.fillRect(0, 210, 640, 4)
    // 阴影地：四角一圈暗
    for (const [x, y] of [[24, 230], [592, 230], [24, 330], [592, 330]] as const) {
      world.fillStyle = rgba(PAL.night1, 0.45)
      world.beginPath()
      world.ellipse(x, y, 28, 16, 0, 0, 7)
      world.fill()
    }
    glow(world, 40, 236, 18, PAL.purpleD, 0.35, false)
    glow(world, 600, 236, 18, PAL.purpleD, 0.35, false)

    const run = this.app.view()
    if (!run) return

    for (let i = 0; i < ORDER.length - 1; i++) {
      const a = MAP.nodes[ORDER[i]], b = MAP.nodes[ORDER[i + 1]]
      world.strokeStyle = rgba(PAL.lamp1, 0.45)
      world.lineWidth = 2
      world.beginPath()
      world.moveTo(a.x, a.y)
      world.lineTo(b.x, b.y)
      world.stroke()
    }

    for (const id of ORDER) {
      const p = MAP.nodes[id]
      const node = run.nodes.find((n) => n.id === id)
      const can = run.availableNodes.includes(id)
      const done = !!node?.done
      const sway = Math.sin(this.t * 2.2 + (this.bob.get(id) ?? 0)) * 2
      const r = { x: p.x - 36, y: p.y - 28 + sway, w: 72, h: 52 }
      pxRoundRect(world, r.x, r.y, r.w, r.h, PAL.ink, 3)
      pxRoundRect(world, r.x + 1, r.y + 1, r.w - 2, r.h - 2, can ? PAL.wood2 : done ? PAL.ink2 : PAL.wood1, 2)
      if (can) {
        world.fillStyle = rgba(PAL.lamp1, 0.25 + 0.15 * Math.sin(this.t * 4))
        world.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4)
      }
      const icon = id === 'drawer' ? ASSETS.icon('prop.desk', 32, 20) : ASSETS.icon('icon.lead', 16, 16)
      blit(world, icon, r.x + r.w / 2 - icon.width / 2, r.y + 6)
      text.draw(NODE_LABEL[id], p.x, r.y + 34, { size: 11, align: 'center', color: PAL.cream, bold: true })
      if (can && !this.openDeck) {
        this.app.ui.hit(`node-${id}`, r, () => {
          audio.sfx('click')
          this.app.send({ type: 'run.enterNode', node: id })
        }, 4)
      }
    }

    vignette(world, 0.25)
    panel(ui, 8, 6, 280, 36, 'dark')
    drawHpBar(ui, text, 16, 18, 120, run.hp, run.hpMax)
    text.draw(`种子 ${run.seed}`, 200, 16, { size: 10, color: PAL.gray3 })
    text.draw('常驻：阴影地（四角 +1）', 16, 44, { size: 10, color: PAL.gray3 })

    this.app.ui.button('open-deck', { x: 520, y: 318, w: 104, h: 26 }, '打开卡盒', () => {
      audio.sfx('click')
      this.openDeck = true
    }, { primary: true, small: true })
    this.app.ui.button('abandon', { x: 16, y: 318, w: 72, h: 26 }, '放弃', () => {
      audio.sfx('click')
      this.app.send({ type: 'run.abandon' })
    }, { danger: true, small: true })

    if (this.openDeck) this.deck.render(ui, text, run, () => { this.openDeck = false })
  }

  onCancel(): void {
    if (this.openDeck) this.openDeck = false
  }
}
