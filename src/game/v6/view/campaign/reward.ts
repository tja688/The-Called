import { getMonster } from '../../content'
import {
  COPY_LIMIT_MESSAGE,
  HUGE_CARD_BACK_NOTICE,
  includeRewardCard,
} from '../../meta'
import type { CampaignState, FinishBattleResult, RuleResult } from '../../meta'

export interface RejectedReward {
  name: string
  reason: string
  /** 拒收说明。卡名来自奖励名单，原因来自 finishBattle，不另算掉落。 */
  text: string
}

export interface RewardView {
  goldGained: number
  gold: number
  goldText: string
  /** 本次成功入盒、可以编进牌组的卡，顺序与结算一致。 */
  includable: string[]
  rejected: RejectedReward[]
  hugeCardBackNotice: string | null
  notices: string[]
}

/**
 * 把一次 finishBattle 的结果摊成奖励视图。
 * goldBefore 用来算增量；拒收卡名用怪物奖励名单和入盒名单对齐。
 */
export function rewardView(
  result: FinishBattleResult,
  monsterId: string,
  goldBefore: number,
): RewardView {
  const goldGained = result.state.gold - goldBefore
  const hugeCardBackNotice = result.messages.includes(HUGE_CARD_BACK_NOTICE)
    ? HUGE_CARD_BACK_NOTICE
    : null
  const awarded =
    goldGained !== 0 || result.addedCardNames.length > 0 || result.messages.length > 0

  if (!awarded) {
    return {
      goldGained: 0,
      gold: result.state.gold,
      goldText: '获得 0 金币',
      includable: [],
      rejected: [],
      hugeCardBackNotice: null,
      notices: [],
    }
  }

  const offered = getMonster(monsterId)?.rewardCardNames ?? []
  const remainingAdded = [...result.addedCardNames]
  const reasons = result.messages.filter((message) => message !== HUGE_CARD_BACK_NOTICE)
  const includable: string[] = []
  const rejected: RejectedReward[] = []

  for (const name of offered) {
    if (remainingAdded[0] === name) {
      includable.push(name)
      remainingAdded.shift()
      continue
    }
    const reason = reasons.shift() ?? COPY_LIMIT_MESSAGE
    rejected.push({ name, reason, text: `${name}：${reason}` })
  }

  includable.push(...remainingAdded)

  return {
    goldGained,
    gold: result.state.gold,
    goldText: `获得 ${goldGained} 金币`,
    includable,
    rejected,
    hugeCardBackNotice,
    notices: reasons,
  }
}

/** 编入或跳过刚入盒的奖励。replaceIndex 为 null 时牌组不动。 */
export function includeReward(
  state: CampaignState,
  cardName: string,
  replaceIndex: number | null,
): RuleResult {
  return includeRewardCard(state, cardName, replaceIndex)
}
