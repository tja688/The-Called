import { Scene } from '../Scene'
import type { TextLayer } from '../../pixel/text'
import { panel } from '../../pixel/ui'
import { PAL } from '../../pixel/palette'
import { Scenery } from '../../pixel/scenery'
import { audio } from '../../audio/audio'
import { PANEL } from '../layout'
import { fictionName } from '../fiction'

export class ForgeScene extends Scene {
  readonly name = 'forge' as const
  private scenery = new Scenery('forge')
  private t = 0
  private picked = false

  update(dt: number): void { this.t += dt }

  render(world: CanvasRenderingContext2D, ui: CanvasRenderingContext2D, text: TextLayer): void {
    this.scenery.drawBack(world, 0, this.t)
    this.scenery.drawFront(world, 0, this.t)
    const run = this.app.view()
    const { x, y, w, h } = PANEL
    panel(ui, x, y, w, h, 'stone')
    text.occlude(x, y, w, h)
    text.draw('铁砧窝', x + 20, y + 16, { size: 18, bold: true, color: PAL.lamp1 })
    text.draw('强化是砸牌面。重铸是把牌扔回炉里再夹出来。', x + 20, y + 42, { size: 12, color: PAL.cream })
    run?.boxCards.slice(0, 12).forEach((c, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const cy = y + 70 + row * 22
      const cx = x + 20 + col * 260
      this.app.ui.button(`fgb-${c.uid}`, { x: cx, y: cy, w: 168, h: 20 }, `${fictionName(c.defId)} +2`, () => {
        if (this.picked) return
        this.picked = true
        audio.sfx('click')
        this.app.send({ type: 'run.forgeBuff', uid: c.uid })
      }, { small: true })
      this.app.ui.button(`fgr-${c.uid}`, { x: cx + 172, y: cy, w: 56, h: 20 }, '重铸', () => {
        if (this.picked || c.rarity === 'basic') return
        this.picked = true
        this.app.send({ type: 'run.forgeRecast', uid: c.uid })
      }, { small: true, disabled: c.rarity === 'basic' })
    })
    this.app.ui.button('back', { x: x + w - 120, y: y + h - 40, w: 100, h: 28 }, '回地图', () => {
      this.app.send({ type: 'run.finishFlow' })
    }, { primary: true, disabled: !this.picked })
  }
}
