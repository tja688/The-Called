import { Scene } from '../Scene'
import type { TextLayer } from '../../pixel/text'
import { PAL } from '../../pixel/palette'
import { Scenery, GROUND_Y } from '../../pixel/scenery'
import { ASSETS } from '../../pixel/assets'
import { drawSprite, blit } from '../../pixel/dsl'
import { audio } from '../../audio/audio'

export class TitleScene extends Scene {
  readonly name = 'title' as const
  private scenery = new Scenery('title')
  private t = 0
  private seed = 1
  private sitting = 0

  enter(): void {
    audio.atmosphere(null)
    this.sitting = 0
  }

  update(dt: number): void {
    this.t += dt
    this.scenery.update(dt)
    if (this.sitting < 1) this.sitting = Math.min(1, this.sitting + dt * 0.8)
  }

  render(world: CanvasRenderingContext2D, ui: CanvasRenderingContext2D, text: TextLayer): void {
    this.scenery.drawBack(world, 180 + Math.sin(this.t * 0.15) * 8, this.t)
    const desk = ASSETS.icon('prop.desk', 32, 20)
    blit(world, desk, 292, GROUND_Y - 18, 2)
    const avatar = ASSETS.sprite('char.avatar')
    if (avatar) {
      const x = 220 + (1 - this.sitting) * 40
      drawSprite(world, avatar, x, GROUND_Y, { anim: 'idle', t: this.t, shadow: true, scale: 2 })
    }
    this.scenery.drawFront(world, 180, this.t)

    text.draw('The Called', 320, 36, { size: 28, bold: true, align: 'center', color: PAL.lamp1, stroke: PAL.ink, strokeWidth: 4 })
    text.draw('坐下。化身先落地。领先要撑过一回合。', 320, 72, { size: 12, align: 'center', color: PAL.cream })

    this.app.ui.button('seed-', { x: 236, y: 210, w: 28, h: 24 }, '−', () => { this.seed = Math.max(1, this.seed - 1) }, { small: true })
    text.draw(`种子 ${this.seed}`, 320, 214, { size: 13, align: 'center', color: PAL.cream, bold: true })
    this.app.ui.button('seed+', { x: 376, y: 210, w: 28, h: 24 }, '+', () => { this.seed += 1 }, { small: true })
    this.app.ui.button('start', { x: 248, y: 248, w: 144, h: 32 }, '开一趟', () => {
      audio.sfx('click')
      this.app.send({ type: 'run.start', seed: this.seed })
    }, { primary: true })
    text.draw('空格快进  ·  ?present=dom 白模', 320, 336, { size: 10, align: 'center', color: PAL.gray3 })
  }

  onConfirm(): void {
    audio.sfx('click')
    this.app.send({ type: 'run.start', seed: this.seed })
  }
}
