import { Scene } from '../Scene'
import type { TextLayer } from '../../pixel/text'
import { panel } from '../../pixel/ui'
import { PAL } from '../../pixel/palette'
import { bakeSky } from '../../pixel/sky'
import { duskWash } from '../../pixel/light'
import { audio } from '../../audio/audio'
import { PANEL } from '../layout'

export class EventScene extends Scene {
  readonly name = 'event' as const
  private sky = bakeSky('dusk', 640, 240)

  render(world: CanvasRenderingContext2D, ui: CanvasRenderingContext2D, text: TextLayer): void {
    world.drawImage(this.sky, 0, 0)
    duskWash(world, 0.16)
    const run = this.app.view()
    const ev = run?.event
    const { x, y, w, h } = PANEL
    panel(ui, x, y, w, h, 'wood')
    text.occlude(x, y, w, h)
    text.draw(ev?.name ?? '事件', x + 20, y + 16, { size: 18, bold: true, color: PAL.lamp1 })
    text.draw('裂开的抽屉。三选一。', x + 20, y + 42, { size: 12, color: PAL.cream })
    for (const opt of ev?.options ?? []) {
      const chosen = ev?.chosen === opt.index
      const locked = ev?.chosen !== undefined
      this.app.ui.button(`opt-${opt.index}`, { x: x + 20, y: y + 72 + opt.index * 52, w: w - 40, h: 44 }, `${opt.label} — ${opt.text}`, () => {
        if (locked) return
        audio.sfx('click')
        this.app.send({ type: 'run.eventOption', index: opt.index })
      }, { primary: chosen, disabled: locked && !chosen }, { size: 12 })
    }
    this.app.ui.button('back', { x: x + w - 120, y: y + h - 40, w: 100, h: 28 }, '回地图', () => {
      audio.sfx('click')
      this.app.send({ type: 'run.finishFlow' })
    }, { primary: true, disabled: ev?.chosen === undefined })
  }

  onConfirm(): void {
    const run = this.app.view()
    if (run?.event?.chosen !== undefined) this.app.send({ type: 'run.finishFlow' })
  }
}
