import { svarbhanuBeginnerStrategy, type MonsterAiProfile } from '../../config/monsterStrategies'
import type { MatchState, PlayCardAction } from '../types'
import { selectMonsterAction } from './search'

/**
 * Chooses the monster's card and cell.
 *
 * The search plays through the real rules engine. It may use the monster's own
 * hand and deck, the public board, pile sizes, and the encounter's known deck
 * list. It does not read which cards are in the player's hand or deck.
 * A missing reply is treated as the strongest card that could still be there.
 * Pass lockedInstanceId when the telegraphed card must be the one that is played.
 */
export function chooseMonsterAction(
  state: MatchState,
  profile: MonsterAiProfile = svarbhanuBeginnerStrategy,
  lockedInstanceId?: string,
): PlayCardAction | null {
  return selectMonsterAction(state, profile, lockedInstanceId)
}
