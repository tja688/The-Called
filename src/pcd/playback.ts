import { intentKey, instanceKey } from './ids'
import type { PcdAdvance, PcdEvent, PcdView, PcdViewCard } from './types'

export type Fly = {
  side: 'player' | 'monster'
  /** Instance key of the card that lands on the board. */
  instanceId: string
  cell: number
  /** Preview id already showing as the monster's intent, so the same mesh can fly. */
  telegraphId: string
  cardId: string
}

export type Beat = {
  view: PcdView
  fly: Fly | null
}

const NOTABLE = new Set([
  'intent-revealed',
  'card-played',
  'card-entered',
  'points-changed',
  'card-removed',
  'card-drawn',
])

export function beatsFor(previous: PcdView | null, advance: Pick<PcdAdvance, 'view' | 'steps'>): Beat[] {
  if (!previous) return [{ view: advance.view, fly: null }]
  const steps = advance.steps.length
    ? advance.steps
    : [{ view: advance.view, pending: null, result: null, events: [] }]
  let cursor = previous
  const beats: Beat[] = []
  for (const step of steps) {
    let draft = stamp(structuredClone(cursor), step.view)
    for (const event of step.events) {
      if (!NOTABLE.has(event.type)) continue
      const next = apply(draft, event, step.view)
      if (next === draft) continue
      const fly = flyFor(draft, event)
      draft = next
      remember(beats, { view: stamp(draft, step.view), fly })
    }
    remember(beats, { view: step.view, fly: null })
    cursor = step.view
  }
  if (!beats.length) beats.push({ view: advance.view, fly: null })
  return beats
}

function stamp(draft: PcdView, step: PcdView): PcdView {
  return {
    ...draft,
    playerPoints: step.playerPoints,
    monsterPoints: step.monsterPoints,
    pools: step.pools,
    cells: draft.cells.map((cell, index) => ({
      ...cell,
      polluted: step.cells[index]?.polluted ?? cell.polluted,
    })),
  }
}

function apply(draft: PcdView, event: PcdEvent, final: PcdView): PcdView {
  if (event.type === 'card-played') {
    if (event.cell) return placeCard(draft, event, final)
    if (event.instance == null) return draft
    const hand = draft.hand.filter((card) => card.instance !== event.instance)
    if (hand.length === draft.hand.length) return draft
    return { ...draft, hand, handCount: hand.length }
  }
  if (event.type === 'card-entered') return placeCard(draft, event, final)
  if (event.type === 'card-removed' && event.instance != null) return removeCard(draft, event.instance)
  if (event.type === 'points-changed' && event.instance != null && event.after != null) {
    return setPoints(draft, event.instance, event.after)
  }
  if (event.type === 'card-drawn' && event.instance != null) return drawCard(draft, event.instance, final)
  if (event.type === 'intent-revealed' && event.card) {
    return {
      ...draft,
      revealedIntent: event.card,
      intentIndex: event.index ?? draft.intentIndex,
    }
  }
  return draft
}

function flyFor(before: PcdView, event: PcdEvent): Fly | null {
  if (event.type !== 'card-played' || !event.cell || event.instance == null || !event.card) return null
  const side = event.owner === 'player' ? 'player' : 'monster'
  return {
    side,
    instanceId: instanceKey(event.instance),
    cell: event.cell,
    telegraphId: intentKey(before.intentIndex, before.revealedIntent ?? event.card),
    cardId: event.card,
  }
}

function placeCard(draft: PcdView, event: PcdEvent, final: PcdView): PcdView {
  const instance = event.instance
  const cellNo = event.cell
  if (instance == null || cellNo == null || cellNo < 1 || cellNo > 9) return draft
  const sitting = draft.cells.find((cell) => cell.card?.instance === instance)
  if (sitting?.cell === cellNo) return draft
  const card = cardFrom(event, final, cellNo)
  const cells = draft.cells.map((cell) => {
    if (cell.card?.instance === instance && cell.cell !== cellNo) return { ...cell, card: null }
    if (cell.cell !== cellNo) return cell
    return { ...cell, card }
  })
  const hand = draft.hand.filter((item) => item.instance !== instance)
  return { ...draft, cells, hand, handCount: hand.length }
}

function cardFrom(event: PcdEvent, final: PcdView, cell: number): PcdViewCard {
  const found = event.instance == null ? undefined : findCard(final, event.instance)
  const points = event.points ?? found?.currentPoints ?? 0
  return {
    instance: event.instance ?? found?.instance ?? 0,
    cardId: event.card ?? found?.cardId ?? '',
    owner: event.owner ?? found?.owner ?? 'monster',
    zone: 'board',
    cell,
    basePoints: found?.basePoints ?? points,
    currentPoints: points,
    cardBackId: found?.cardBackId ?? null,
    modifierCount: found?.modifierCount ?? 0,
    isSpell: found?.isSpell ?? false,
    timer: found?.timer ?? 0,
    statuses: found?.statuses ?? [],
  }
}

function findCard(view: PcdView, instance: number) {
  for (const cell of view.cells) {
    if (cell.card?.instance === instance) return cell.card
  }
  return (
    view.hand.find((card) => card.instance === instance)
    ?? view.playerDiscard.find((card) => card.instance === instance)
    ?? view.monsterDiscard.find((card) => card.instance === instance)
  )
}

function removeCard(draft: PcdView, instance: number): PcdView {
  let changed = false
  const cells = draft.cells.map((cell) => {
    if (cell.card?.instance !== instance) return cell
    changed = true
    return { ...cell, card: null }
  })
  const hand = draft.hand.filter((card) => {
    if (card.instance !== instance) return true
    changed = true
    return false
  })
  if (!changed) return draft
  return { ...draft, cells, hand, handCount: hand.length }
}

function setPoints(draft: PcdView, instance: number, after: number): PcdView {
  let changed = false
  const paint = (card: PcdViewCard) => {
    if (card.instance !== instance || card.currentPoints === after) return card
    changed = true
    return { ...card, currentPoints: after }
  }
  const cells = draft.cells.map((cell) => (cell.card ? { ...cell, card: paint(cell.card) } : cell))
  const hand = draft.hand.map(paint)
  if (!changed) return draft
  return { ...draft, cells, hand }
}

function drawCard(draft: PcdView, instance: number, final: PcdView): PcdView {
  if (draft.hand.some((card) => card.instance === instance)) return draft
  const drawn = final.hand.find((card) => card.instance === instance)
  if (!drawn) return draft
  const hand = [...draft.hand, drawn]
  return {
    ...draft,
    hand,
    handCount: hand.length,
    matchDeckCount: Math.max(0, draft.matchDeckCount - 1),
  }
}

function remember(beats: Beat[], beat: Beat) {
  const last = beats[beats.length - 1]
  if (last && !beat.fly && !last.fly && signature(last.view) === signature(beat.view)) return
  beats.push(beat)
}

function signature(view: PcdView) {
  return JSON.stringify({
    cells: view.cells.map((cell) => [cell.card?.instance ?? 0, cell.card?.currentPoints ?? 0, cell.polluted]),
    hand: view.hand.map((card) => [card.instance, card.currentPoints]),
    intent: view.revealedIntent,
    index: view.intentIndex,
    deck: view.matchDeckCount,
    discard: view.playerDiscardCount,
    monsterDiscard: view.monsterDiscardCount,
    winner: view.winner,
  })
}
