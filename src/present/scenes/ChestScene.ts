import { Scene } from '../Scene'
import type { TextLayer } from '../../pixel/text'
import { panel } from '../../pixel/ui'
import { PAL } from '../../pixel/palette'
import { Scenery } from '../../pixel/scenery'
import { PANEL } from '../layout'
import { fictionName } from '../fiction'

export class ChestScene extends Scene {
  readonly name = 'chest' as const
  private scenery = new Scenery('chest')
  private t = 0

  update(dt: number): void { this.t += dt }

  render(world: CanvasRenderingContext2D, ui: CanvasRenderingContext2D, text: TextLayer): void {
    this.scenery.drawBack(world, 0, this.t)
    this.scenery.drawFront(world, 0, this.t)
    const run = this.app.view()
    const { x, y, w, h } = PANEL
    panel(ui, x, y, w, h, 'stone')
    text.occlude(x, y, w, h)
    text.draw('宝箱', x + 20, y + 16, { size: 18, bold: true, color: PAL.lamp1 })
    const relics = run?.relics.map(fictionName).join('、')
    text.draw(relics ? `箱子里是：${relics}` : '箱子里是 15 金币。', x + 20, y + 80, { size: 14, color: PAL.cream })
    this.app.ui.button('back', { x: x + w - 120, y: y + h - 40, w: 100, h: 28 }, '回地图', () => {
      this.app.send({ type: 'run.finishFlow' })
    }, { primary: true })
  }
}
