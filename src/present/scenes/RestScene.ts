import { Scene } from '../Scene'
import type { TextLayer } from '../../pixel/text'
import { panel } from '../../pixel/ui'
import { PAL } from '../../pixel/palette'
import { Scenery } from '../../pixel/scenery'
import { audio } from '../../audio/audio'
import { PANEL } from '../layout'

export class RestScene extends Scene {
  readonly name = 'rest' as const
  private scenery = new Scenery('well')
  private t = 0
  private picked = false

  update(dt: number): void { this.t += dt }

  render(world: CanvasRenderingContext2D, ui: CanvasRenderingContext2D, text: TextLayer): void {
    this.scenery.drawBack(world, 0, this.t)
    this.scenery.drawFront(world, 0, this.t)
    const { x, y, w, h } = PANEL
    panel(ui, x, y, w, h, 'stone')
    text.draw('渗泉龛', x + 20, y + 16, { size: 18, bold: true, color: PAL.lamp1 })
    text.draw('青苔井栏。舀水，或在龛前把化身磨硬一点。', x + 20, y + 44, { size: 12, color: PAL.cream })
    this.app.ui.button('heal', { x: x + 20, y: y + 80, w: w - 40, h: 40 }, '舀水 · 回复血上限 30%', () => {
      this.picked = true
      audio.sfx('click')
      this.app.send({ type: 'run.restPick', choice: 'heal' })
    }, { disabled: this.picked })
    this.app.ui.button('grow', { x: x + 20, y: y + 132, w: w - 40, h: 40 }, '磨硬 · 化身基础 +2，血上限 +2', () => {
      this.picked = true
      this.app.send({ type: 'run.restPick', choice: 'grow' })
    }, { disabled: this.picked })
    this.app.ui.button('back', { x: x + w - 120, y: y + h - 40, w: 100, h: 28 }, '回地图', () => {
      this.app.send({ type: 'run.finishFlow' })
    }, { primary: true, disabled: !this.picked })
  }
}
