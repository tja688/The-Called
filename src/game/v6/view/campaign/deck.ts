import { editDeck } from '../../meta'
import type { CampaignState, RuleResult } from '../../meta'
import { cardLine, type CardLine } from './cards'

export const SCIENCE_DECK_NOTICE = '目前只能从科学牌组出发。'

export interface DeckEditorView {
  gold: number
  box: CardLine[]
  deck: CardLine[]
  editable: boolean
  battleLock: string | null
  scienceNotice: typeof SCIENCE_DECK_NOTICE
}

/** 卡盒、当前牌组和金币。战斗中走 editDeck 的拒绝文案，不展示负荷。 */
export function viewDeckEditor(state: CampaignState): DeckEditorView {
  const locked = state.inBattle ? editDeck(state, state.deck) : null
  return {
    gold: state.gold,
    box: state.box.map((name, index) => cardLine(name, index)),
    deck: state.deck.map((name, index) => cardLine(name, index)),
    editable: !state.inBattle,
    battleLock: locked && !locked.ok ? locked.message : null,
    scienceNotice: SCIENCE_DECK_NOTICE,
  }
}

/** 用卡盒中的一张替换牌组里的一个位置。只改草稿，张数不变，不保存。 */
export function replaceInDeck(
  deck: readonly string[],
  deckIndex: number,
  cardName: string,
): string[] {
  if (!Number.isInteger(deckIndex) || deckIndex < 0 || deckIndex >= deck.length) {
    return [...deck]
  }
  const next = [...deck]
  next[deckIndex] = cardName
  return next
}

/** 保存必须仍是 15 张，并且每一张都能由卡盒支付。 */
export function commitDeckEdit(state: CampaignState, deck: readonly string[]): RuleResult {
  return editDeck(state, deck)
}
