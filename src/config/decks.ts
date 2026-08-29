import type { CardId } from './cardCatalog'

export type DeckEntry = { cardId: CardId; count: number }
export type DeckConfig = { id: string; name: string; cards: readonly DeckEntry[] }

export const beginnerPlayerDeck: DeckConfig = {
  id: 'beginner-science', name: '新手科学牌组',
  cards: [
    { cardId: 'player_reference_point', count: 3 }, { cardId: 'player_observation_record', count: 2 },
    { cardId: 'player_calibration', count: 2 }, { cardId: 'player_error_correction', count: 2 },
    { cardId: 'player_boundary_condition', count: 2 }, { cardId: 'player_falsification', count: 1 },
  ],
}

export const beginnerMonsterDeck: DeckConfig = {
  id: 'monster-beginner', name: '怪物新手牌组',
  cards: [
    { cardId: 'sva_occluder', count: 3 }, { cardId: 'sva_off_axis_projection', count: 2 },
    { cardId: 'sva_boundary_convergence', count: 2 }, { cardId: 'sva_unobservable_zone', count: 2 },
    { cardId: 'sva_distorted_reading', count: 1 }, { cardId: 'sva_black_box_model', count: 1 },
    { cardId: 'sva_afterimage', count: 1 },
  ],
}

// Kept as an alias for existing imports and saved test fixtures.
export const svarbhanuBeginnerDeck = beginnerMonsterDeck
