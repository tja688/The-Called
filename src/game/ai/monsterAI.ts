import { getCardDefinition } from '../../config/cardCatalog'
import { svarbhanuBeginnerStrategy, type StrategyWeights } from '../../config/monsterStrategies'
import type { CellId, MatchState, PlayCardAction } from '../types'
import { canPlaceCard, getBoardPower, playCard } from '../core/matchEngine'

export function chooseMonsterAction(
  state: MatchState,
  weights: StrategyWeights = svarbhanuBeginnerStrategy,
): PlayCardAction | null {
  if (state.status !== 'playing' || state.turn !== 'monster') return null
  let best: { action: PlayCardAction; score: number } | null = null

  for (const card of state.monster.hand) {
    for (const cell of state.board) {
      if (!canPlaceCard(state, card, cell)) continue
      {
        const action: PlayCardAction = { side: 'monster', cardInstanceId: card.instanceId, cellId: cell.id }
        const simulation = playCard(state, action)
        if (simulation.error) continue
        const placed = simulation.state.board.find((candidate) => candidate.id === cell.id)?.card
        if (!placed) continue
        const definition = getCardDefinition(card.cardId)
        const coveredPower = cell.card?.owner === 'player' ? cell.card.currentPower : 0
        const immediateGain = placed.currentPower - definition.power
        const weakenedPower = Math.max(0, getBoardPower(state, 'player') - getBoardPower(simulation.state, 'player'))
        const isCenter = cell.id === ('cell-1-1' satisfies CellId)
        const score = (coveredPower ? weights.coverBase + coveredPower * weights.coveredPower : 0)
          + immediateGain * weights.immediatePowerGain
          + weakenedPower * weights.weakenTargetPower
          + (isCenter ? weights.center : 0)
          + placed.currentPower * weights.resultingPower
        if (!best || score > best.score) best = { action, score }
      }
    }
  }
  return best?.action ?? null
}
