import { Scene } from '../Scene'
import type { TextLayer } from '../../pixel/text'
import { panel } from '../../pixel/ui'
import { PAL } from '../../pixel/palette'
import { Scenery } from '../../pixel/scenery'
import { audio } from '../../audio/audio'
import { PANEL } from '../layout'
import { fictionName } from '../fiction'

export class ShopScene extends Scene {
  readonly name = 'shop' as const
  private scenery = new Scenery('shop')
  private t = 0

  update(dt: number): void { this.t += dt }

  render(world: CanvasRenderingContext2D, ui: CanvasRenderingContext2D, text: TextLayer): void {
    this.scenery.drawBack(world, 0, this.t)
    this.scenery.drawFront(world, 0, this.t)
    const run = this.app.view()
    const { x, y, w, h } = PANEL
    panel(ui, x, y, w, h, 'stone')
    text.occlude(x, y, w, h)
    text.draw(`锈牙当铺 · ${run?.gold ?? 0} 金`, x + 20, y + 16, { size: 18, bold: true, color: PAL.lamp1 })
    run?.shop?.offers.forEach((o, i) => {
      this.app.ui.button(`buy-${i}`, { x: x + 20, y: y + 56 + i * 28, w: w - 40, h: 24 }, `${fictionName(o.defId)} · ${o.price}金`, () => {
        audio.sfx('click')
        this.app.send({ type: 'run.shopBuyCard', index: i })
      }, { small: true })
    })
    if (run?.shop?.relicId) {
      this.app.ui.button('buy-relic', { x: x + 20, y: y + 210, w: 200, h: 24 }, `${fictionName(run.shop.relicId)} · ${run.shop.relicPrice}金`, () => {
        this.app.send({ type: 'run.shopBuyRelic' })
      }, { small: true })
    }
    const copyUid = run?.boxCards[0]?.uid
    this.app.ui.button('copy', { x: x + 240, y: y + 210, w: 160, h: 24 }, `复制首张 · ${run?.shop?.copyPrice}金`, () => {
      if (copyUid) this.app.send({ type: 'run.shopCopy', uid: copyUid })
    }, { small: true })
    this.app.ui.button('leave', { x: x + w - 120, y: y + h - 40, w: 100, h: 28 }, '离开', () => {
      audio.sfx('click')
      this.app.send({ type: 'run.finishFlow' })
    }, { primary: true })
  }
}
