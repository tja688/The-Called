import type { PresentApp } from '../PresentApp'
import type { RunView } from '../../application/readmodels/RunView'
import type { TextLayer } from '../../pixel/text'
import { panel } from '../../pixel/ui'
import { PAL } from '../../pixel/palette'
import { fictionName } from '../fiction'
import { audio } from '../../audio/audio'
import { PANEL } from '../layout'
import { drawTooltip } from '../widgets'
import { cardDef } from '../../content/cards'

export class DeckEditor {
  constructor(private app: PresentApp) {}

  render(ui: CanvasRenderingContext2D, text: TextLayer, run: RunView, onClose: () => void): void {
    const { x, y, w, h } = PANEL
    text.occlude(x, y, w, h)
    panel(ui, x, y, w, h, 'stone')
    text.draw('卡盒 · 点一下编入 / 移出牌组', x + 16, y + 12, { size: 14, bold: true, color: PAL.lamp1 })
    text.draw(`牌组 ${run.deck.length} 张（下限 10）。负面不能拿掉。`, x + 16, y + 32, { size: 11, color: PAL.cream })

    let cx = x + 16, cy = y + 54
    let hoverUid: string | undefined
    run.boxCards.forEach((card, i) => {
      const inDeck = run.deck.includes(card.uid)
      const bw = 124, bh = 28
      if (cx + bw > x + w - 16) { cx = x + 16; cy += 34 }
      const label = `${fictionName(card.defId)}${card.baseBonus ? `+${card.baseBonus}` : ''}${inDeck ? ' · 组' : ''}`
      this.app.ui.button(`box-${i}`, { x: cx, y: cy, w: bw, h: bh }, label, () => {
        const next = [...run.deck]
        if (inDeck) {
          if (card.negative) return
          const at = next.indexOf(card.uid)
          if (at >= 0) next.splice(at, 1)
        } else next.push(card.uid)
        audio.sfx('click')
        this.app.send({ type: 'run.setDeck', deck: next })
      }, { small: true, primary: inDeck }, { size: 10 })
      if (this.app.input.isHover(`box-${i}`)) hoverUid = card.uid
      cx += bw + 8
    })

    this.app.ui.button('n04', { x: x + 16, y: y + h - 36, w: 88, h: 24 }, `+${fictionName('PC.N04')}`, () => {
      audio.sfx('click')
      this.app.send({ type: 'run.setDeck', deck: [...run.deck, 'PC.N04'] })
    }, { small: true })
    const n04At = [...run.deck].map((id, i) => ({ id, i })).reverse().find((x) => x.id === 'PC.N04' || x.id.startsWith('N04'))?.i
    this.app.ui.button('n04-minus', { x: x + 108, y: y + h - 36, w: 72, h: 24 }, `-${fictionName('PC.N04')}`, () => {
      if (n04At === undefined || run.deck.length <= 10) return
      const next = [...run.deck]
      next.splice(n04At, 1)
      audio.sfx('click')
      this.app.send({ type: 'run.setDeck', deck: next })
    }, { small: true, disabled: n04At === undefined || run.deck.length <= 10 })

    this.app.ui.button('deck-close', { x: x + w - 88, y: y + h - 36, w: 72, h: 24 }, '关上', () => {
      audio.sfx('click')
      onClose()
    }, { primary: true, small: true })

    if (hoverUid) {
      const card = run.boxCards.find((c) => c.uid === hoverUid)
      if (card) drawTooltip(ui, text, cardDef(card.defId), 220, 80)
    }
  }
}
