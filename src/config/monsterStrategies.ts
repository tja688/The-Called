import { beginnerPlayerDeck, type DeckConfig } from './decks'

/** What an encounter is allowed to know before the match starts. */
export type MonsterAiProfile = {
  opponentDeck: DeckConfig
  /**
   * 0 plays the expected hand. 1 guards the worst plausible hand.
   * Personalities change this. They do not skip a search or misplay on purpose.
   */
  risk?: number
}

/**
 * Svarbhanu knows the beginner deck list, the same way an encounter knows
 * which investigator showed up. The hidden hand and deck order stay hidden.
 */
export const svarbhanuBeginnerStrategy: MonsterAiProfile = {
  opponentDeck: beginnerPlayerDeck,
}
