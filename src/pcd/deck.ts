import type { PcdCatalog } from './types'

export const DECK_SIZE = 15
const STORAGE_KEY = 'pcd-build'

export type Slot = { cardId: string; backId: string }
export type Build = { slots: Array<Slot | null> }

export function starterBuild(catalog: PcdCatalog): Build {
  const deck = catalog.decks.find((item) => item.id === 'deck.science') ?? catalog.decks[0]
  const cards = deck?.cards ?? []
  return {
    slots: Array.from({ length: DECK_SIZE }, (_, index) => {
      const cardId = cards[index]
      return cardId ? { cardId, backId: '' } : null
    }),
  }
}

export function filled(build: Build): { cards: string[]; backs: string[] } {
  const slots = build.slots.filter((slot): slot is Slot => slot !== null)
  return {
    cards: slots.map((slot) => slot.cardId),
    backs: slots.map((slot) => slot.backId),
  }
}

export function placeCard(build: Build, cardId: string): Build {
  const index = build.slots.findIndex((slot) => slot === null)
  if (index < 0) return build
  const slots = build.slots.slice()
  slots[index] = { cardId, backId: '' }
  return { slots }
}

export function clearSlot(build: Build, index: number): Build {
  if (!build.slots[index]) return build
  const slots = build.slots.slice()
  slots[index] = null
  return { slots }
}

export function setBack(build: Build, index: number, backId: string): Build {
  const slot = build.slots[index]
  if (!slot) return build
  const slots = build.slots.slice()
  slots[index] = { ...slot, backId }
  return { slots }
}

export function parseBuild(raw: string | null): Build | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { slots?: unknown }
    if (!Array.isArray(parsed.slots) || parsed.slots.length !== DECK_SIZE) return null
    const slots = parsed.slots.map((slot) => {
      if (slot == null || typeof slot !== 'object') return null
      const record = slot as { cardId?: unknown; backId?: unknown }
      if (typeof record.cardId !== 'string' || record.cardId.length === 0) return null
      return { cardId: record.cardId, backId: typeof record.backId === 'string' ? record.backId : '' }
    })
    return { slots }
  } catch {
    return null
  }
}

export function loadBuild(): Build | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return parseBuild(localStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

export function saveBuild(build: Build) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(build))
  } catch {
    /* Private mode can refuse storage. The in-memory build still stands. */
  }
}
