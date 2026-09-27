import { getCardByName, getMonster, scienceStarter } from '../content'

/** 第 7.1 节：同名白 3、蓝 2、金 1。 */
const OWNERSHIP_CAP = {
  white: 3,
  blue: 2,
  gold: 1,
}

const DECK_SIZE = 15

/** 第 9 节：超限不分解成金币。 */
export const COPY_LIMIT_MESSAGE = '已有足够的复制，这张没有收入卡盒'

/** 第 9 节：卡背只记账，不改点数或金币。 */
export const HUGE_CARD_BACK_NOTICE = '获得巨大卡背。装配尚未开放'

export interface CampaignState {
  gold: number
  box: string[]
  deck: string[]
  inBattle: boolean
  deckSnapshot: string[] | null
  /** 刚入盒、还没决定是否编进牌组的奖励。 */
  pendingRewardNames: string[]
  notices: string[]
}

export type RuleResult =
  | { ok: true; state: CampaignState }
  | { ok: false; state: CampaignState; message: string }

export interface FinishBattleResult {
  state: CampaignState
  addedCardNames: string[]
  messages: string[]
}

function refuse(state: CampaignState, message: string): RuleResult {
  return { ok: false, state, message }
}

function countCopies(cards: readonly string[], name: string): number {
  let count = 0
  for (const card of cards) {
    if (card === name) count += 1
  }
  return count
}

function isSage(name: string): boolean {
  const card = getCardByName(name)
  return card?.name === '智者' || card?.pool === 'excluded'
}

function withoutOne(names: readonly string[], name: string): string[] | null {
  const index = names.indexOf(name)
  if (index < 0) return null
  return [...names.slice(0, index), ...names.slice(index + 1)]
}

/**
 * 开局金币 0。卡盒放入科学起始牌组的全部副本，出战牌组等于这 15 张。
 * 第 3.1 节与第 7.4 节。
 */
export function createCampaign(): CampaignState {
  let state: CampaignState = {
    gold: 0,
    box: [],
    deck: [],
    inBattle: false,
    deckSnapshot: null,
    pendingRewardNames: [],
    notices: [],
  }
  for (const name of scienceStarter) {
    const added = addCardToBox(state, name)
    if (!added.ok) throw new Error(added.message)
    state = added.state
  }
  return { ...state, deck: [...state.box] }
}

/** 尝试把一张玩家卡收入卡盒。超过持有上限不进盒，也不换成金币。 */
export function addCardToBox(state: CampaignState, cardName: string): RuleResult {
  if (state.inBattle) return refuse(state, '战斗中不能编辑牌组')
  const card = getCardByName(cardName)
  if (!card) return refuse(state, '找不到这张牌')
  if (isSage(card.name)) return refuse(state, '智者不能进入卡盒')
  if (card.rarity === null) return refuse(state, '这张牌不能收入卡盒')
  // TODO(第7.3节建议默认，第9节延后)：超限白/蓝/金分解为 15/30/60 金币。当前不换金币。
  if (countCopies(state.box, card.name) >= OWNERSHIP_CAP[card.rarity]) {
    return refuse(state, COPY_LIMIT_MESSAGE)
  }
  return { ok: true, state: { ...state, box: [...state.box, card.name] } }
}

function commitDeck(state: CampaignState, deck: readonly string[]): RuleResult {
  if (state.inBattle) return refuse(state, '战斗中不能编辑牌组')
  if (deck.length !== DECK_SIZE) return refuse(state, '牌组必须正好 15 张')
  for (const name of deck) {
    if (isSage(name)) return refuse(state, '智者不能进入牌组')
  }
  for (const name of deck) {
    if (countCopies(deck, name) > countCopies(state.box, name)) {
      return refuse(state, '卡盒里没有足够的副本支付这张牌')
    }
  }
  return { ok: true, state: { ...state, deck: [...deck] } }
}

/** 牌组必须正好 15 张，且每一张都能由卡盒里的副本支付。战斗中拒绝。 */
export function editDeck(state: CampaignState, deck: readonly string[]): RuleResult {
  return commitDeck(state, deck)
}

/** 拍下当前牌组快照并进入战斗。已经在战斗中则不覆盖快照。 */
export function beginBattle(state: CampaignState): CampaignState {
  if (state.inBattle) return state
  return {
    ...state,
    inBattle: true,
    deckSnapshot: [...state.deck],
  }
}

/**
 * 战斗模块改写本场牌组。不改快照，不改卡盒，不跑回合。
 * 战斗结束时由 finishBattle 丢掉这份牌组。
 */
export function setInBattleDeck(state: CampaignState, deck: readonly string[]): CampaignState {
  if (!state.inBattle) return state
  return { ...state, deck: [...deck] }
}

/**
 * 不论胜负先把牌组恢复成开战快照。
 * 失败不改金币和卡盒。胜利先加金币，再按奖励名单逐张尝试入盒。
 * 不把奖励自动塞进牌组。重复胜利仍发完整奖励。
 */
export function finishBattle(state: CampaignState, monsterId: string, victory: boolean): FinishBattleResult {
  if (!state.inBattle || state.deckSnapshot === null) {
    throw new Error('当前不在战斗中')
  }
  const restored: CampaignState = {
    ...state,
    gold: state.gold,
    box: [...state.box],
    deck: [...state.deckSnapshot],
    inBattle: false,
    deckSnapshot: null,
    pendingRewardNames: [],
    notices: [...state.notices],
  }
  if (!victory) {
    return { state: restored, addedCardNames: [], messages: [] }
  }

  const monster = getMonster(monsterId)
  if (!monster) {
    return { state: restored, addedCardNames: [], messages: ['找不到这只怪物'] }
  }

  let next: CampaignState = { ...restored, gold: restored.gold + monster.rewardGold }
  const addedCardNames: string[] = []
  const messages: string[] = []
  for (const name of monster.rewardCardNames) {
    const added = addCardToBox(next, name)
    if (added.ok) {
      next = added.state
      addedCardNames.push(name)
    } else {
      messages.push(added.message)
    }
  }
  if (monster.rewardHugeCardBack) messages.push(HUGE_CARD_BACK_NOTICE)
  next = {
    ...next,
    pendingRewardNames: [...addedCardNames],
    notices: [...next.notices, ...messages],
  }
  return { state: next, addedCardNames, messages }
}

/**
 * 用刚入盒的奖励替换牌组中的一张。replaceIndex 为 null 时不加入，牌组不动。
 * 被换下的牌留在卡盒。替换后牌组仍是 15 张。
 */
export function includeRewardCard(
  state: CampaignState,
  cardName: string,
  replaceIndex: number | null,
): RuleResult {
  if (state.inBattle) return refuse(state, '战斗中不能编辑牌组')
  const pending = withoutOne(state.pendingRewardNames, cardName)
  if (!pending) return refuse(state, '这张不是刚入盒的奖励')
  const decided: CampaignState = { ...state, pendingRewardNames: pending }
  if (replaceIndex === null) {
    return { ok: true, state: { ...decided, deck: [...state.deck] } }
  }
  if (!Number.isInteger(replaceIndex) || replaceIndex < 0 || replaceIndex >= state.deck.length) {
    return refuse(state, '替换位置超出牌组')
  }
  const deck = [...state.deck]
  deck[replaceIndex] = cardName
  const edited = commitDeck(decided, deck)
  if (!edited.ok) return refuse(state, edited.message)
  return edited
}
