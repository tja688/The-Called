import type { DeckId, SchoolId } from '../domain/types'

export interface StartingDeck {
  id: DeckId
  school: SchoolId
  avatar: string
  cards: string[]
}

export const STARTING_DECKS: Record<DeckId, StartingDeck> = {
  'DK.A': {
    id: 'DK.A',
    school: 'SYS.A',
    avatar: 'PC.A00',
    cards: ['PC.A01', 'PC.A01', 'PC.A01', 'PC.A01', 'PC.A01', 'PC.A02', 'PC.A02', 'PC.A02', 'PC.A02', 'PC.A03'],
  },
  'DK.B': {
    id: 'DK.B',
    school: 'SYS.B',
    avatar: 'PC.B00',
    cards: ['PC.B01', 'PC.B01', 'PC.B01', 'PC.B01', 'PC.B02', 'PC.B02', 'PC.B02', 'PC.B02', 'PC.B03', 'PC.B03'],
  },
  'DK.C': {
    id: 'DK.C',
    school: 'SYS.C',
    avatar: 'PC.C00',
    cards: ['PC.C01', 'PC.C01', 'PC.C01', 'PC.C01', 'PC.C01', 'PC.C02', 'PC.C02', 'PC.C02', 'PC.C02', 'PC.C03'],
  },
}

export function startingDeck(id: DeckId): StartingDeck {
  return STARTING_DECKS[id]
}

export function schoolOf(deckId: DeckId): SchoolId {
  return STARTING_DECKS[deckId].school
}
