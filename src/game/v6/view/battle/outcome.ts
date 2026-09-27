import { recordVictory, type MapSession } from '../../map'
import { finishBattle, type CampaignState, type FinishBattleResult } from '../../meta'

export interface BattleRewardOffer {
  result: FinishBattleResult
  monsterId: string
  goldBefore: number
}

export interface BattleExitInput {
  campaign: CampaignState
  session: MapSession
  monsterId: string
  nodeId: string
  winner: 'player' | 'enemy'
}

export interface BattleExit {
  campaign: CampaignState
  session: MapSession
  phase: 'map' | 'reward'
  reward: BattleRewardOffer | null
  /** 结算后仍站在开战前的节点。 */
  nodeId: string
}

/**
 * 对局胜负接到发奖。
 * 胜利调用 finishBattle，登记怪物种类，停在奖励页。
 * 失败也调用 finishBattle，不改金币和卡盒，直接回地图。
 * 所在节点不因胜负移动。
 */
export function settleBattleExit(input: BattleExitInput): BattleExit {
  const victory = input.winner === 'player'
  const goldBefore = input.campaign.gold
  const finished = finishBattle(input.campaign, input.monsterId, victory)
  const nodeId = input.session.currentNodeId === input.nodeId
    ? input.nodeId
    : input.session.currentNodeId
  if (!victory) {
    return {
      campaign: finished.state,
      session: input.session,
      phase: 'map',
      reward: null,
      nodeId,
    }
  }
  return {
    campaign: finished.state,
    session: recordVictory(input.session, input.monsterId),
    phase: 'reward',
    reward: { result: finished, monsterId: input.monsterId, goldBefore },
    nodeId,
  }
}
