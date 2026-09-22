import { Scene } from '../Scene'
import type { TextLayer } from '../../pixel/text'
import { PAL } from '../../pixel/palette'
import { Scenery, GROUND_Y } from '../../pixel/scenery'
import { ASSETS } from '../../pixel/assets'
import { drawSprite } from '../../pixel/dsl'
import { audio } from '../../audio/audio'
import { fictionName, avatarSpriteId, DECK_BLURB } from '../fiction'
import type { DeckId } from '../../domain/types'

export class TitleScene extends Scene {
  readonly name = 'title' as const
  private scenery = new Scenery('gate')
  private t = 0
  private seed = 1
  private deckId: DeckId = 'DK.A'

  enter(): void {
    audio.atmosphere(null)
  }

  update(dt: number): void {
    this.t += dt
    this.scenery.update(dt)
  }

  render(world: CanvasRenderingContext2D, ui: CanvasRenderingContext2D, text: TextLayer): void {
    this.scenery.drawBack(world, 180 + Math.sin(this.t * 0.15) * 8, this.t)

    const decks: DeckId[] = ['DK.A', 'DK.B', 'DK.C']
    const avatars = ['PC.A00', 'PC.B00', 'PC.C00']
    decks.forEach((id, i) => {
      const x = 170 + i * 150
      const sprite = ASSETS.sprite(avatarSpriteId(avatars[i]))
      if (sprite) {
        drawSprite(world, sprite, x, GROUND_Y, {
          anim: 'idle',
          t: this.t + i,
          shadow: true,
          scale: this.deckId === id ? 2.4 : 2,
        })
      }
    })

    this.scenery.drawFront(world, 180, this.t)

    text.draw('锈门层', 320, 16, { size: 26, bold: true, align: 'center', color: PAL.lamp1, stroke: PAL.ink, strokeWidth: 4 })
    text.draw('灰石堡地下。选一套行囊，清掉垂死巨人。', 320, 44, { size: 12, align: 'center', color: PAL.cream })

    decks.forEach((id, i) => {
      this.app.ui.button(`dk-${id}`, { x: 118 + i * 150, y: 68, w: 120, h: 24 }, `${i + 1} ${fictionName(id)}`, () => { this.deckId = id }, { small: true, primary: this.deckId === id })
    })

    this.app.ui.button('seed-', { x: 236, y: 98, w: 28, h: 22 }, '−', () => { this.seed = Math.max(1, this.seed - 1) }, { small: true })
    text.draw(`种子 ${this.seed}`, 320, 102, { size: 13, align: 'center', color: PAL.cream, bold: true })
    this.app.ui.button('seed+', { x: 376, y: 98, w: 28, h: 22 }, '+', () => { this.seed += 1 }, { small: true })
    this.app.ui.button('start', { x: 248, y: 126, w: 144, h: 28 }, `开一趟 · ${fictionName(this.deckId)}`, () => {
      audio.sfx('click')
      this.app.send({ type: 'run.start', seed: this.seed, deckId: this.deckId })
    }, { primary: true })

    text.paragraph(DECK_BLURB[this.deckId] ?? '', 320, 164, 420, { size: 12, color: PAL.cream, lineHeight: 16, align: 'center' })

    this.app.ui.button('how', { x: 16, y: 318, w: 88, h: 24 }, '怎么玩', () => {
      audio.sfx('click')
      this.app.shell.openHelp()
    }, { small: true })
    text.draw('1 2 3 选行囊  ·  Enter 开局  ·  Esc 菜单  ·  空格快进', 320, 336, { size: 10, align: 'center', color: PAL.gray3 })
  }

  onConfirm(): void {
    audio.sfx('click')
    this.app.send({ type: 'run.start', seed: this.seed, deckId: this.deckId })
  }

  onKey(k: string): void {
    if (k === '1') this.deckId = 'DK.A'
    if (k === '2') this.deckId = 'DK.B'
    if (k === '3') this.deckId = 'DK.C'
  }
}
