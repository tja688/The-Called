import type { PresentApp } from '../PresentApp'
import type { RunView } from '../../application/readmodels/RunView'
import type { TextLayer } from '../../pixel/text'
import { panel } from '../../pixel/ui'
import { PAL } from '../../pixel/palette'
import { audio } from '../../audio/audio'
import { PANEL } from '../layout'
import { drawFaceCard, drawTooltip } from '../widgets'
import { cardDef } from '../../content/cards'

const COLS = 5
const PAGE = 10
const CARD_W = 100
const CARD_H = 86

export class DeckEditor {
  private page = 0

  constructor(private app: PresentApp) {}

  render(ui: CanvasRenderingContext2D, text: TextLayer, run: RunView, onClose: () => void): void {
    const { x, y, w, h } = PANEL
    text.occlude(x, y, w, h)
    panel(ui, x, y, w, h, 'stone')
    text.draw('卡盒', x + 16, y + 10, { size: 14, bold: true, color: PAL.lamp1 })
    text.draw('点一张放进牌组，再点一次拿出来。金边表示已经在牌组里。', x + 58, y + 12, { size: 11, color: PAL.cream })
    text.draw(`牌组 ${run.deck.length} 张，至少 10 张。负面卡拿不掉。`, x + 16, y + 30, { size: 11, color: PAL.cream })

    const pages = Math.max(1, Math.ceil(run.boxCards.length / PAGE))
    if (this.page > pages - 1) this.page = pages - 1
    if (this.page < 0) this.page = 0
    const slice = run.boxCards.slice(this.page * PAGE, this.page * PAGE + PAGE)

    let hoverUid: string | undefined
    slice.forEach((card, i) => {
      const col = i % COLS
      const row = Math.floor(i / COLS)
      const cx = x + 16 + col * (CARD_W + 8)
      const cy = y + 48 + row * (CARD_H + 6)
      const inDeck = run.deck.includes(card.uid)
      drawFaceCard(ui, text, cardDef(card.defId), cx, cy, CARD_W, CARD_H, {
        inDeck,
        negative: card.negative,
        bonus: card.baseBonus,
      })
      this.app.ui.hit(`box-${card.uid}`, { x: cx, y: cy, w: CARD_W, h: CARD_H }, () => {
        const next = [...run.deck]
        if (inDeck) {
          if (card.negative) {
            this.app.toast('负面卡不能从牌组拿掉', 332)
            return
          }
          const at = next.indexOf(card.uid)
          if (at >= 0) next.splice(at, 1)
          if (next.length < 10) {
            this.app.toast('牌组至少留 10 张。不够就加碎砖补上。', 332)
            return
          }
        } else next.push(card.uid)
        audio.sfx('click')
        this.app.send({ type: 'run.setDeck', deck: next })
      }, 12)
      if (this.app.input.isHover(`box-${card.uid}`)) hoverUid = card.uid
    })

    if (pages > 1) {
      this.app.ui.button('deck-prev', { x: x + w - 168, y: y + 26, w: 52, h: 20 }, '上页', () => {
        this.page = Math.max(0, this.page - 1)
      }, { small: true, disabled: this.page <= 0 }, { size: 10 })
      this.app.ui.button('deck-next', { x: x + w - 110, y: y + 26, w: 52, h: 20 }, '下页', () => {
        this.page = Math.min(pages - 1, this.page + 1)
      }, { small: true, disabled: this.page >= pages - 1 }, { size: 10 })
      text.draw(`${this.page + 1}/${pages}`, x + w - 56, y + 30, { size: 10, color: PAL.gray3 })
    }

    const n04Count = run.deck.filter((id) => id === 'PC.N04' || id.startsWith('N04')).length
    const n04At = [...run.deck].map((id, i) => ({ id, i })).reverse().find((e) => e.id === 'PC.N04' || e.id.startsWith('N04'))?.i
    text.draw('牌组不满 10 张时，用碎砖补满下限。', x + 16, y + h - 50, { size: 11, color: PAL.lamp1 })
    text.draw(`现在 ${n04Count} 张`, x + 248, y + h - 50, { size: 11, color: PAL.cream })
    this.app.ui.button('n04', { x: x + 16, y: y + h - 30, w: 108, h: 22 }, '加一张碎砖', () => {
      audio.sfx('click')
      this.app.send({ type: 'run.setDeck', deck: [...run.deck, 'PC.N04'] })
    }, { small: true }, { size: 10 })
    this.app.ui.button('n04-minus', { x: x + 132, y: y + h - 30, w: 96, h: 22 }, '拿掉碎砖', () => {
      if (n04At === undefined || run.deck.length <= 10) return
      const next = [...run.deck]
      next.splice(n04At, 1)
      audio.sfx('click')
      this.app.send({ type: 'run.setDeck', deck: next })
    }, { small: true, disabled: n04At === undefined || run.deck.length <= 10 }, { size: 10 })

    this.app.ui.button('deck-close', { x: x + w - 88, y: y + h - 30, w: 72, h: 22 }, '关上', () => {
      audio.sfx('click')
      onClose()
    }, { primary: true, small: true })

    const hoverBrick = this.app.input.isHover('n04') || this.app.input.isHover('n04-minus')
    if (hoverUid) {
      const card = run.boxCards.find((c) => c.uid === hoverUid)
      if (card) {
        const idx = slice.findIndex((c) => c.uid === hoverUid)
        const col = idx % COLS
        const row = Math.floor(idx / COLS)
        const cx = x + 16 + col * (CARD_W + 8)
        const cy = y + 48 + row * (CARD_H + 6)
        const tipX = col >= 3 ? cx - 216 : cx + CARD_W + 8
        drawTooltip(ui, text, cardDef(card.defId), tipX, cy, { currentPoints: cardDef(card.defId).basePoints + card.baseBonus })
      }
    } else if (hoverBrick) {
      drawTooltip(ui, text, cardDef('PC.N04'), x + 16, y + h - 150)
    }
  }
}
