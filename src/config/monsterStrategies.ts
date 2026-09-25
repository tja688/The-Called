import { beginnerPlayerDeck, type DeckConfig } from './decks'

/** What an encounter is allowed to know before the match starts. */
export type MonsterAiProfile = {
  opponentDeck: DeckConfig
}

/**
 * Svarbhanu knows the beginner deck list, the same way an encounter knows
 * which investigator showed up. The hidden hand and deck order stay hidden.
 */
export const svarbhanuBeginnerStrategy: MonsterAiProfile = {
  opponentDeck: beginnerPlayerDeck,
}
