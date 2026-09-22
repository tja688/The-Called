import { Scene } from '../Scene'
import type { TextLayer } from '../../pixel/text'
import { panel } from '../../pixel/ui'
import { PAL } from '../../pixel/palette'
import { Scenery, roomOfNode } from '../../pixel/scenery'
import { audio } from '../../audio/audio'
import { PANEL } from '../layout'
import { fictionName, fictionTxt } from '../fiction'
import { eventCardEligible, eventDef } from '../../content/events'
import { drawTooltip } from '../widgets'
import { cardDef } from '../../content/cards'

export class EventScene extends Scene {
  readonly name = 'event' as const
  private scenery = new Scenery('event')
  private t = 0
  private pickUid?: string
  private pickUid2?: string
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
    text.draw(ev ? fictionName(ev.eventId) : '事件', x + 20, y + 12, { size: 18, bold: true, color: PAL.lamp1 })
    const sit = ev ? fictionTxt(ev.eventId) : ''
    if (sit) text.paragraph(sit, x + 20, y + 36, w - 40, { size: 12, color: PAL.cream, lineHeight: 16 })
    const needsTwo = ev?.options.some((o) => o.needsCard2)
    for (const opt of ev?.options ?? []) {
      const chosen = ev?.chosen === opt.index
      const locked = ev?.chosen !== undefined || !opt.enabled
      const name = fictionName(`${ev?.eventId}.${String.fromCharCode(65 + opt.index)}`)
      const need = opt.needsCard2 ? (!this.pickUid || !this.pickUid2) : opt.needsCard ? !this.pickUid : false
      const label = `${name}  ·  ${opt.text}`
      this.app.ui.button(`opt-${opt.index}`, { x: x + 20, y: y + 88 + opt.index * 36, w: w - 40, h: 32 }, label, () => {
        if (locked) return
        if (need) {
          this.app.toast(opt.needsCard2 ? '先点两张卡盒里的牌' : '先点一张卡盒里的牌', 52)
          return
        }
        audio.sfx('click')
        this.app.send({ type: 'run.eventOption', index: opt.index, cardUid: this.pickUid, cardUid2: this.pickUid2 })
      }, { primary: chosen, disabled: locked && !chosen }, { size: 11 })
    }
    let tipId: string | undefined
    if (run && ev?.options.some((o) => o.needsCard)) {
      text.draw(needsTwo ? '点两张卡（先左后右）' : '点一张卡：', x + 20, y + 200, { size: 10, color: PAL.gray3 })
      const def = eventDef(ev.eventId)
      const eligible = run.boxCards.filter((c) =>
        ev.options.some((o) => o.needsCard && eventCardEligible(def, o.index, c.defId)),
      )
      const shown = (eligible.length ? eligible : run.boxCards).slice(0, 8)
      shown.forEach((c, i) => {
        const on = this.pickUid === c.uid || this.pickUid2 === c.uid
        this.app.ui.button(`evc-${c.uid}`, { x: x + 20 + (i % 4) * 130, y: y + 216 + Math.floor(i / 4) * 22, w: 124, h: 20 }, fictionName(c.defId), () => {
          if (!this.pickUid || this.pickUid === c.uid) this.pickUid = this.pickUid === c.uid ? undefined : c.uid
          else if (needsTwo && (!this.pickUid2 || this.pickUid2 === c.uid)) this.pickUid2 = this.pickUid2 === c.uid ? undefined : c.uid
          else { this.pickUid2 = undefined; this.pickUid = c.uid }
        }, { small: true, primary: on })
        if (this.app.input.isHover(`evc-${c.uid}`)) tipId = c.defId
      })
    }
    this.app.ui.button('back', { x: x + w - 120, y: y + h - 40, w: 100, h: 28 }, '回地图', () => {
      audio.sfx('click')
      this.app.send({ type: 'run.finishFlow' })
    }, { primary: true, disabled: ev?.chosen === undefined })
    if (tipId) drawTooltip(ui, text, cardDef(tipId), x + 180, y + 150)
  }

  onConfirm(): void {
    const run = this.app.view()
    if (run?.event?.chosen !== undefined) this.app.send({ type: 'run.finishFlow' })
  }
}
