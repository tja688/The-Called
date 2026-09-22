import { Scene } from '../Scene'
import type { TextLayer } from '../../pixel/text'
import { panel } from '../../pixel/ui'
import { PAL } from '../../pixel/palette'
import { Scenery } from '../../pixel/scenery'
import { audio } from '../../audio/audio'
import { PANEL } from '../layout'
import { fictionName, fictionText } from '../fiction'
import { drawTooltip } from '../widgets'
import { cardDef } from '../../content/cards'
import { relicDef } from '../../content/relics'

export class ShopScene extends Scene {
  readonly name = 'shop' as const
  private scenery = new Scenery('shop')
  private t = 0
  private copyUid?: string

  update(dt: number): void { this.t += dt }

  render(world: CanvasRenderingContext2D, ui: CanvasRenderingContext2D, text: TextLayer): void {
    this.scenery.drawBack(world, 0, this.t)
    this.scenery.drawFront(world, 0, this.t)
    const run = this.app.view()
    const { x, y, w, h } = PANEL
    panel(ui, x, y, w, h, 'stone')
    text.occlude(x, y, w, h)
    text.draw(`商店 · ${run?.gold ?? 0} 金`, x + 20, y + 16, { size: 18, bold: true, color: PAL.lamp1 })
    text.draw('指向货品看说明。复制要先点卡盒里的一张。', x + 20, y + 40, { size: 11, color: PAL.cream })
    let tipDef: string | undefined
    let tipX = x + 220, tipY = y + 52
    run?.shop?.offers.forEach((o, i) => {
      this.app.ui.button(`buy-${i}`, { x: x + 20, y: y + 60 + i * 28, w: w - 40, h: 24 }, `${fictionName(o.defId)} · ${o.price}金`, () => {
        audio.sfx('click')
        this.app.send({ type: 'run.shopBuyCard', index: i })
      }, { small: true })
      if (this.app.input.isHover(`buy-${i}`)) {
        tipDef = o.defId
        tipX = x + 220
        tipY = y + 52 + i * 28
      }
    })
    if (run?.shop?.relicId) {
      this.app.ui.button('buy-relic', { x: x + 20, y: y + 176, w: 240, h: 24 }, `${fictionName(run.shop.relicId)} · ${run.shop.relicPrice}金`, () => {
        this.app.send({ type: 'run.shopBuyRelic' })
      }, { small: true })
      if (this.app.input.isHover('buy-relic')) {
        const rel = relicDef(run.shop.relicId)
        text.paragraph(fictionText(rel.text), x + 270, y + 178, 250, { size: 10, color: PAL.cream, lineHeight: 13 })
      }
    }
    text.draw('复制：', x + 20, y + 208, { size: 10, color: PAL.gray3 })
    run?.boxCards.slice(0, 6).forEach((c, i) => {
      this.app.ui.button(`cp-${c.uid}`, { x: x + 54 + i * 72, y: y + 206, w: 68, h: 20 }, fictionName(c.defId), () => {
        this.copyUid = c.uid
      }, { small: true, primary: this.copyUid === c.uid })
    })
    this.app.ui.button('copy', { x: x + 20, y: y + 232, w: 200, h: 24 }, `复制所选 · ${run?.shop?.copyPrice}金`, () => {
      if (!this.copyUid) {
        this.app.toast('先点卡盒里要复制的牌', 52)
        return
      }
      this.app.send({ type: 'run.shopCopy', uid: this.copyUid })
    }, { small: true })
    this.app.ui.button('leave', { x: x + w - 120, y: y + h - 40, w: 100, h: 28 }, '离开', () => {
      audio.sfx('click')
      this.app.send({ type: 'run.finishFlow' })
    }, { primary: true })
    if (tipDef) drawTooltip(ui, text, cardDef(tipDef), tipX, tipY)
  }
}
