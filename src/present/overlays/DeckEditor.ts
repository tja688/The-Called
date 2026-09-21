import type { PresentApp } from '../PresentApp'
import type { RunView } from '../../application/readmodels/RunView'
import type { TextLayer } from '../../pixel/text'
import { panel } from '../../pixel/ui'
import { PAL } from '../../pixel/palette'
import { fictionName } from '../fiction'
import { audio } from '../../audio/audio'
import { PANEL } from '../layout'

export class DeckEditor {
  constructor(private app: PresentApp) {}

  render(ui: CanvasRenderingContext2D, text: TextLayer, run: RunView, onClose: () => void): void {
    const { x, y, w, h } = PANEL
    text.occlude(x, y, w, h)
    panel(ui, x, y, w, h, 'stone')
    text.draw('卡盒 · 点一下编入 / 移出牌组', x + 16, y + 12, { size: 14, bold: true, color: PAL.lamp1 })
    text.draw(`牌组 ${run.deck.length} 张（下限 10）。负面不能拿掉。`, x + 16, y + 32, { size: 11, color: PAL.cream })

    let cx = x + 16, cy = y + 54
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
      cx += bw + 8
    })

    this.app.ui.button('n04', { x: x + 16, y: y + h - 36, w: 88, h: 24 }, `+${fictionName('PC.N04')}`, () => {
      audio.sfx('click')
      this.app.send({ type: 'run.setDeck', deck: [...run.deck, 'PC.N04'] })
    }, { small: true })

    this.app.ui.button('deck-close', { x: x + w - 88, y: y + h - 36, w: 72, h: 24 }, '关上', () => {
      audio.sfx('click')
      onClose()
    }, { primary: true, small: true })
  }
}
