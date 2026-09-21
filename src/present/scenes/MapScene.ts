import { Scene } from '../Scene'
import type { TextLayer } from '../../pixel/text'
import { PAL, rgba } from '../../pixel/palette'
import { Scenery } from '../../pixel/scenery'
import { vignette } from '../../pixel/light'
import { ASSETS } from '../../pixel/assets'
import { blit, drawSprite } from '../../pixel/dsl'
import { panel, pxRoundRect } from '../../pixel/ui'
import { audio } from '../../audio/audio'
import { drawHpBar } from '../widgets'
import { DeckEditor } from '../overlays/DeckEditor'
import { fictionName, avatarSpriteId } from '../fiction'
import { MAP } from '../layout'
import type { DomainEvent } from '../../core/messages'
import type { MapNodeView } from '../../application/readmodels/RunView'

const NODE_ICON: Record<string, string> = {
  normal: 'icon.normal',
  elite: 'icon.elite',
  boss: 'icon.boss',
  event: 'icon.event',
  shop: 'icon.shop',
  chest: 'icon.chest',
  rest: 'icon.rest',
  forge: 'icon.forge',
  nextFloor: 'icon.next',
  unknown: 'icon.unknown',
}

export class MapScene extends Scene {
  readonly name = 'map' as const
  private t = 0
  private scenery = new Scenery('corridor')
  private deck = new DeckEditor(this.app)
  private openDeck = false

  enter(): void {
    audio.atmosphere(null)
  }

  update(dt: number): void {
    this.t += dt
  }

  async handle(e: DomainEvent): Promise<void> {
    if (e.type === 'run.deckChanged') this.app.toast('牌组已改', 52)
  }

  render(world: CanvasRenderingContext2D, ui: CanvasRenderingContext2D, text: TextLayer): void {
    this.scenery.drawBack(world, 40, this.t)
    world.fillStyle = rgba(PAL.shadow, 0.28)
    world.fillRect(0, 0, 640, 360)

    const run = this.app.view()
    if (!run) return

    const pts = [{ x: 0, y: 0 }, ...run.nodes]
    const xs = pts.map((n) => n.x)
    const ys = pts.map((n) => n.y)
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const toX = (x: number) => MAP.padX + ((x - minX) / Math.max(1, maxX - minX)) * MAP.width
    const toY = (y: number) => MAP.padY + ((y - minY) / Math.max(1, maxY - minY)) * MAP.height

    const all = [{ id: 'hub', x: 0, y: 0 }, ...run.nodes]
    for (const a of all) {
      for (const b of all) {
        if (a.id >= b.id) continue
        if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) continue
        const x1 = Math.round(toX(a.x)), y1 = Math.round(toY(a.y))
        const x2 = Math.round(toX(b.x)), y2 = Math.round(toY(b.y))
        world.fillStyle = PAL.ink2
        if (a.y === b.y) {
          const x = Math.min(x1, x2), w = Math.abs(x2 - x1)
          world.fillRect(x, y1 - 4, w, 8)
          world.fillStyle = PAL.copperD
          world.fillRect(x, y1 - 2, w, 4)
          world.fillStyle = PAL.gray1
          world.fillRect(x, y1 - 1, w, 2)
        } else {
          const y = Math.min(y1, y2), h = Math.abs(y2 - y1)
          world.fillRect(x1 - 4, y, 8, h)
          world.fillStyle = PAL.copperD
          world.fillRect(x1 - 2, y, 4, h)
          world.fillStyle = PAL.gray1
          world.fillRect(x1 - 1, y, 2, h)
        }
      }
    }

    const hx = Math.round(toX(0)), hy = Math.round(toY(0))
    pxRoundRect(world, hx - 18, hy - 16, 36, 32, PAL.ink, 2)
    pxRoundRect(world, hx - 17, hy - 15, 34, 30, PAL.tile1, 1)
    blit(world, ASSETS.icon('icon.hub', 24, 24), hx - 12, hy - 14)
    text.draw('锈门内厅', hx, hy + 12, { size: 8, align: 'center', color: PAL.cream, bold: true })

    for (const n of run.nodes) {
      this.drawNode(world, ui, text, n, toX(n.x), toY(n.y))
    }

    const px = Math.round(toX(run.player.x)), py = Math.round(toY(run.player.y))
    const avatar = ASSETS.sprite(avatarSpriteId(run.avatarDefId))
    if (avatar) {
      drawSprite(world, avatar, px, py + 6, { anim: 'idle', t: this.t, shadow: true, scale: 1.2 })
    } else {
      pxRoundRect(world, px - 6, py - 6, 12, 12, PAL.lamp1, 2)
    }

    vignette(world, 0.28)

    panel(ui, 8, 6, 340, 36, 'stone')
    drawHpBar(ui, text, 16, 18, 90, run.hp, run.hpMax)
    text.draw(`${run.gold}金`, 170, 16, { size: 11, color: PAL.gold, bold: true })
    const me = ASSETS.icon(`icon.${run.floorEffect.toLowerCase().replace('.', '')}`, 16, 16)
    blit(ui, me, 220, 14)
    text.draw(fictionName(run.floorEffect), 240, 16, { size: 10, color: PAL.gray3 })

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

  private drawNode(world: CanvasRenderingContext2D, ui: CanvasRenderingContext2D, text: TextLayer, n: MapNodeView, x: number, y: number): void {
    x = Math.round(x); y = Math.round(y)
    const r = { x: x - 16, y: y - 14, w: 32, h: 28 }
    pxRoundRect(world, r.x, r.y, r.w, r.h, PAL.ink, 2)
    const fill = n.adjacent ? PAL.stone : n.completed ? PAL.ink2 : PAL.tile1
    pxRoundRect(world, r.x + 1, r.y + 1, r.w - 2, r.h - 2, fill, 1)
    if (n.lost) {
      world.fillStyle = rgba(PAL.redD, 0.45)
      world.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4)
    }
    if (n.adjacent) {
      world.fillStyle = rgba(PAL.lamp1, 0.22 + 0.14 * Math.sin(this.t * 4))
      world.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4)
    }
    const icon = ASSETS.icon(NODE_ICON[n.type] ?? 'icon.unknown', 16, 16)
    blit(world, icon, x - 8, y - 8)
    text.draw(n.label, x, r.y + 16, { size: 8, align: 'center', color: PAL.cream, bold: true })
    if (n.adjacent && !this.openDeck) {
      this.app.ui.hit(`node-${n.id}`, r, () => {
        audio.sfx('click')
        this.app.send({ type: 'run.enterNode', node: n.id })
      }, 3)
    }
    void ui
  }

  onCancel(): void {
    if (this.openDeck) this.openDeck = false
  }
}
