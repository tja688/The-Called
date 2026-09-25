import { create } from 'zustand'
import {
  createDefaultLoadout,
  filledSlotCount,
  grantToLibrary,
  isBattleDeckComplete,
  placeFromLibrary,
  removeFromDeck,
  toBattleDeck,
  type DeckLoadout,
  type LoadoutResult,
} from '../config/deckLoadout'
import { levelRewardCardIds, type DeckConfig } from '../config/decks'

type DeckStore = DeckLoadout & {
  claimedLevelIds: readonly string[]
  removeSlot: (slotIndex: number) => LoadoutResult
  placeCard: (cardId: string, slotIndex?: number) => LoadoutResult
  grant: (cardId: string, count?: number) => LoadoutResult
  claimLevelReward: (levelId: string) => string[]
  reset: () => void
}

function apply(result: LoadoutResult, set: (partial: Pick<DeckLoadout, 'slots' | 'library'>) => void) {
  if (result.ok) set({ slots: result.loadout.slots, library: result.loadout.library })
  return result
}

export const useDeckStore = create<DeckStore>((set, get) => ({
  ...createDefaultLoadout(),
  claimedLevelIds: [],
  removeSlot: (slotIndex) => apply(removeFromDeck(get(), slotIndex), set),
  placeCard: (cardId, slotIndex) => apply(placeFromLibrary(get(), cardId, slotIndex), set),
  grant: (cardId, count) => apply(grantToLibrary(get(), cardId, count), set),
  claimLevelReward: (levelId) => {
    const rewards = levelRewardCardIds[levelId]
    if (!rewards || get().claimedLevelIds.includes(levelId)) return []
    let loadout: DeckLoadout = { slots: get().slots, library: get().library }
    for (const cardId of rewards) {
      const result = grantToLibrary(loadout, cardId)
      if (!result.ok) return []
      loadout = result.loadout
    }
    set({ slots: loadout.slots, library: loadout.library, claimedLevelIds: [...get().claimedLevelIds, levelId] })
    return [...rewards]
  },
  reset: () => set({ ...createDefaultLoadout(), claimedLevelIds: [] }),
}))

/** Cards granted here wait in the library until the player seats them. */
export function grantLibraryCards(cardId: string, count = 1): LoadoutResult {
  return useDeckStore.getState().grant(cardId, count)
}

export function getPlayerLoadout(): DeckLoadout {
  const { slots, library } = useDeckStore.getState()
  return { slots, library }
}

export function getBattleDeck(): DeckConfig | null {
  return toBattleDeck(useDeckStore.getState())
}

export function canEnterBattle(): boolean {
  return isBattleDeckComplete(useDeckStore.getState())
}

export function battleDeckFill(): { filled: number; limit: number } {
  const loadout = useDeckStore.getState()
  return { filled: filledSlotCount(loadout), limit: loadout.slots.length }
}
