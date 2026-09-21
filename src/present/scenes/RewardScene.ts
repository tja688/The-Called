import { Scene } from '../Scene'
import type { TextLayer } from '../../pixel/text'
import { panel } from '../../pixel/ui'
import { PAL } from '../../pixel/palette'
import { Scenery } from '../../pixel/scenery'
import { drawHandCard } from '../widgets'
import { audio } from '../../audio/audio'
import { PANEL } from '../layout'

export class RewardScene extends Scene {
  readonly name = 'reward' as const
  private scenery = new Scenery('chest')
  private t = 0

  update(dt: number): void { this.t += dt }

  render(world: CanvasRenderingContext2D, ui: CanvasRenderingContext2D, text: TextLayer): void {
    this.scenery.drawBack(world, 0, this.t)
    this.scenery.drawFront(world, 0, this.t)
    const run = this.app.view()
    const pool = run?.reward?.pool ?? []
    const picked = run?.reward?.picked
    const { x, y, w, h } = PANEL
    panel(ui, x, y, w, h, 'stone')
    text.occlude(x, y, w, h)
    text.draw('选一张进卡盒', x + 20, y + 16, { size: 18, bold: true, color: PAL.lamp1 })
    text.draw('不自动进牌组。回地图后再编。', x + 20, y + 42, { size: 12, color: PAL.cream })
    pool.forEach((id, i) => {
      const def = this.app.ask({ type: 'content.card', defId: id })
      const cx = x + 36 + i * 170
      const cy = y + 78
      drawHandCard(ui, text, def, cx, cy, 72, 108, { selected: picked === id, dim: !!picked && picked !== id })
      if (!picked) {
        this.app.ui.hit(`rew-${id}`, { x: cx, y: cy, w: 72, h: 108 }, () => {
          audio.sfx('reward')
          this.app.send({ type: 'run.rewardPick', cardId: id })
        }, 8)
      }
      text.paragraph(def.text, cx, cy + 114, 150, { size: 10, color: PAL.cream, lineHeight: 13 })
    })
    this.app.ui.button('back', { x: x + w - 120, y: y + h - 40, w: 100, h: 28 }, '回地图', () => {
      audio.sfx('click')
      this.app.send({ type: 'run.finishFlow' })
    }, { primary: true, disabled: !picked })
  }

  onConfirm(): void {
    if (this.app.view()?.reward?.picked) this.app.send({ type: 'run.finishFlow' })
  }
}
