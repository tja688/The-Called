import { Scene } from '../Scene'
import type { TextLayer } from '../../pixel/text'
import { panel } from '../../pixel/ui'
import { PAL } from '../../pixel/palette'
import { Scenery, roomOfNode } from '../../pixel/scenery'
import { audio } from '../../audio/audio'
import { PANEL } from '../layout'
import { fictionName, fictionTxt } from '../fiction'

export class EventScene extends Scene {
  readonly name = 'event' as const
  private scenery = new Scenery('event')
  private t = 0
  private pickUid?: string
  private bound = ''

  update(dt: number): void { this.t += dt }

  render(world: CanvasRenderingContext2D, ui: CanvasRenderingContext2D, text: TextLayer): void {
    const run = this.app.view()
    const ev = run?.event
    const room = ev?.eventId === 'EV.02' ? 'well' : ev?.eventId === 'EV.06' || ev?.eventId === 'EV.15' ? 'shop' : ev?.eventId === 'EV.01' ? 'chest' : roomOfNode('event')
    if (this.bound !== room) {
      this.scenery = new Scenery(room)
      this.bound = room
    }
    this.scenery.drawBack(world, 0, this.t)
    this.scenery.drawFront(world, 0, this.t)
    const { x, y, w, h } = PANEL
    panel(ui, x, y, w, h, 'stone')
    text.occlude(x, y, w, h)
    text.draw(ev ? fictionName(ev.eventId) : '事件', x + 20, y + 16, { size: 18, bold: true, color: PAL.lamp1 })
    const sit = ev ? fictionTxt(ev.eventId) : ''
    if (sit) text.paragraph(sit, x + 20, y + 42, w - 40, { size: 12, color: PAL.cream, lineHeight: 16 })
    for (const opt of ev?.options ?? []) {
      const chosen = ev?.chosen === opt.index
      const locked = ev?.chosen !== undefined || !opt.enabled
      const label = fictionName(`${ev?.eventId}.${String.fromCharCode(65 + opt.index)}`)
      this.app.ui.button(`opt-${opt.index}`, { x: x + 20, y: y + 92 + opt.index * 40, w: w - 40, h: 34 }, label, () => {
        if (locked) return
        audio.sfx('click')
        this.app.send({ type: 'run.eventOption', index: opt.index, cardUid: this.pickUid })
      }, { primary: chosen, disabled: locked && !chosen }, { size: 12 })
    }
    if (run && ev?.options.some((o) => o.needsCard)) {
      text.draw('需要卡：', x + 20, y + 216, { size: 10, color: PAL.gray3 })
      run.boxCards.slice(0, 6).forEach((c, i) => {
        this.app.ui.button(`evc-${c.uid}`, { x: x + 20 + i * 86, y: y + 232, w: 80, h: 20 }, fictionName(c.defId), () => {
          this.pickUid = c.uid
        }, { small: true, primary: this.pickUid === c.uid })
      })
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
