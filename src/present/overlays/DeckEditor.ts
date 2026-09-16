import type { PresentApp } from '../PresentApp'
import type { RunView } from '../../application/readmodels/RunView'
import type { TextLayer } from '../../pixel/text'
import { panel } from '../../pixel/ui'
import { PAL } from '../../pixel/palette'
import { cardName } from '../../content/cards'
import { audio } from '../../audio/audio'
import { PANEL } from '../layout'

export class DeckEditor {
  constructor(private app: PresentApp) {}

  render(ui: CanvasRenderingContext2D, text: TextLayer, run: RunView, onClose: () => void): void {
    const { x, y, w, h } = PANEL
    text.occlude(x, y, w, h)
    panel(ui, x, y, w, h, 'wood')
    text.draw('卡盒 · 点一下编入 / 移出牌组', x + 16, y + 12, { size: 14, bold: true, color: PAL.lamp1 })
    text.draw(`牌组 ${run.deck.length} 张（至少 1）`, x + 16, y + 32, { size: 11, color: PAL.cream })

    const deckCount = new Map<string, number>()
    for (const id of run.deck) deckCount.set(id, (deckCount.get(id) ?? 0) + 1)
    const used = new Map<string, number>()
    let cx = x + 16, cy = y + 54
    run.box.forEach((id, i) => {
      const u = used.get(id) ?? 0
      used.set(id, u + 1)
      const inDeck = (deckCount.get(id) ?? 0) > u
      const bw = 124, bh = 28
      if (cx + bw > x + w - 16) { cx = x + 16; cy += 34 }
      this.app.ui.button(`box-${i}`, { x: cx, y: cy, w: bw, h: bh }, `${cardName(id)}${inDeck ? ' · 组' : ''}`, () => {
        const next = [...run.deck]
        if (inDeck) {
          const at = next.lastIndexOf(id)
          if (at >= 0 && next.length > 1) next.splice(at, 1)
        } else next.push(id)
        audio.sfx('click')
        this.app.send({ type: 'run.setDeck', deck: next })
      }, { small: true, primary: inDeck }, { size: 11 })
      cx += bw + 8
    })

    this.app.ui.button('deck-close', { x: x + w - 88, y: y + h - 36, w: 72, h: 24 }, '关上', () => {
      audio.sfx('click')
      onClose()
    }, { primary: true, small: true })
  }
}
