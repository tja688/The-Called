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
  id: 'monster-beginner', name: '遮光体牌组',
  cards: [
    { cardId: 'sva_occluder', count: 3 }, { cardId: 'sva_off_axis_projection', count: 2 },
    { cardId: 'sva_boundary_convergence', count: 2 }, { cardId: 'sva_unobservable_zone', count: 2 },
    { cardId: 'sva_distorted_reading', count: 1 }, { cardId: 'sva_black_box_model', count: 1 },
    { cardId: 'sva_afterimage', count: 1 },
  ],
}

export const rahuKetuDeck: DeckConfig = {
  id: 'rahu-ketu', name: '罗睺与计都',
  cards: [
    { cardId: 'rk_vacant_pole', count: 2 }, { cardId: 'rk_dipole', count: 2 },
    { cardId: 'rk_deep_eclipse', count: 1 }, { cardId: 'rk_latitude', count: 2 },
    { cardId: 'rk_longitude', count: 2 }, { cardId: 'rk_antipode', count: 2 },
    { cardId: 'rk_node', count: 1 },
  ],
}

export const moonDeck: DeckConfig = {
  id: 'moon', name: '月',
  cards: [
    { cardId: 'moon_horn', count: 3 }, { cardId: 'moon_waxing', count: 2 },
    { cardId: 'moon_waning', count: 1 }, { cardId: 'moon_full', count: 1 },
    { cardId: 'moon_occult', count: 1 }, { cardId: 'moon_tide', count: 2 },
    { cardId: 'moon_facing', count: 2 },
  ],
}

const monsterDecks: Record<string, DeckConfig> = {
  'level-01': beginnerMonsterDeck,
  'level-02': rahuKetuDeck,
  'level-03': moonDeck,
}

export function monsterDeckForLevel(levelId: string): DeckConfig {
  const deck = monsterDecks[levelId]
  if (!deck) throw new Error(`Unknown level: ${levelId}`)
  return deck
}

export const levelRewardCardIds: Record<string, readonly CardId[]> = {
  'level-01': ['player_antipode', 'player_meridian', 'player_error_correction'],
  'level-02': ['player_center_condition', 'player_syzygy', 'player_boundary_condition'],
}

// Kept as an alias for existing imports and saved test fixtures.
export const svarbhanuBeginnerDeck = beginnerMonsterDeck
