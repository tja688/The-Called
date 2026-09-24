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
        const before = getBoardPower(state, 'monster') - getBoardPower(state, 'player')
        const after = getBoardPower(simulation.state, 'monster') - getBoardPower(simulation.state, 'player')
        const weakenedPower = Math.max(0, getBoardPower(state, 'player') - getBoardPower(simulation.state, 'player'))
        const isCenter = cell.id === ('cell-1-1' satisfies CellId)
        const score = (after - before) * weights.powerSwing
          + weakenedPower * weights.weakenTargetPower
          + (isCenter ? weights.center : 0)
        if (!best || score > best.score) best = { action, score }
      }
    }
  }
  return best?.action ?? null
}
