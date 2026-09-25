import { svarbhanuBeginnerStrategy, type MonsterAiProfile } from '../../config/monsterStrategies'
import type { CardInstance, MatchState, PlayCardAction } from '../types'
import { chooseMonsterIntent, selectMonsterAction } from './search'

/**
 * Chooses the monster's card and cell on the monster's turn.
 * Pass lockedInstanceId for a card that was already shown. If that card has
 * no legal cell, this returns null. Callers must pass, not play a different card.
 *
 * The search sees the public board, both pile sizes, the monster's hand, and
 * the encounter's deck list. It does not see either deck's order or the
 * player's cards. Opponent lines are weighted possible hands.
 */
export function chooseMonsterAction(
  state: MatchState,
  profile: MonsterAiProfile = svarbhanuBeginnerStrategy,
  lockedInstanceId?: string,
): PlayCardAction | null {
  return selectMonsterAction(state, profile, lockedInstanceId)
}

/** Card to show before the player answers. Placement is chosen later. */
export function chooseShownCard(
  state: MatchState,
  profile: MonsterAiProfile = svarbhanuBeginnerStrategy,
): CardInstance | null {
  return chooseMonsterIntent(state, profile)
}
