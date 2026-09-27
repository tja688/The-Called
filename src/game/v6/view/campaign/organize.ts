import type { CampaignState, RuleResult } from '../../meta'
import { commitDeckEdit } from './deck'

/** 出战牌组里的一个位置。fresh 表示这张是本场放进去的新牌。 */
export interface Seat {
  name: string
  fresh: boolean
}

export type Draft = Array<Seat | null>

/**
 * 战后和地图共用的编组草稿。
 * 可以先把出战牌卸下，再从新获得或卡盒放回空位。
 * 提交时必须正好坐满。没放进牌组的新牌仍留在卡盒。
 */
export function seatedDraft(deck: readonly string[]): Draft {
  return deck.map((name) => ({ name, fresh: false }))
}

export function unseatAt(draft: readonly (Seat | null)[], index: number): Draft {
  if (!Number.isInteger(index) || index < 0 || index >= draft.length || draft[index] === null) {
    return draft as Draft
  }
  return draft.map((seat, seatIndex) => {
    if (seatIndex === index) return null
    return seat ? { ...seat } : null
  })
}

export function firstOpen(draft: readonly (Seat | null)[]): number | null {
  const index = draft.findIndex((seat) => seat === null)
  return index < 0 ? null : index
}

export function filledCount(draft: readonly (Seat | null)[]): number {
  let count = 0
  for (const seat of draft) {
    if (seat) count += 1
  }
  return count
}

export interface PileRow {
  name: string
  count: number
}

/** 还没放进出战牌组的新牌。已放入的从这一栏减去。 */
export function freshCopies(
  pending: readonly string[],
  draft: readonly (Seat | null)[],
): PileRow[] {
  return remainders(pending, countNames(draft.flatMap((seat) => (seat?.fresh ? [seat.name] : []))))
}

/**
 * 卡盒里还能再放入的副本。
 * 已经坐在出战牌组里的、以及仍标在新获得栏里的，都不在这里重复出现。
 */
export function boxCopies(
  box: readonly string[],
  draft: readonly (Seat | null)[],
  pending: readonly string[],
): PileRow[] {
  const totals = countNames(box)
  const seated = countNames(draft.flatMap((seat) => (seat ? [seat.name] : [])))
  const heldFresh = new Map(freshCopies(pending, draft).map((row) => [row.name, row.count]))
  const rows: PileRow[] = []
  const seen = new Set<string>()
  for (const name of box) {
    if (seen.has(name)) continue
    seen.add(name)
    const spare = (totals.get(name) ?? 0) - (seated.get(name) ?? 0) - (heldFresh.get(name) ?? 0)
    if (spare > 0) rows.push({ name, count: spare })
  }
  return rows
}

/** 把新获得或卡盒里的一张放进空位。没有空位或没有副本时草稿不动。 */
export function placeCopy(
  draft: readonly (Seat | null)[],
  index: number,
  name: string,
  source: 'fresh' | 'box',
  box: readonly string[],
  pending: readonly string[],
): Draft {
  if (!Number.isInteger(index) || index < 0 || index >= draft.length || draft[index] !== null) {
    return draft as Draft
  }
  const pile = source === 'fresh' ? freshCopies(pending, draft) : boxCopies(box, draft, pending)
  const row = pile.find((item) => item.name === name)
  if (!row || row.count < 1) return draft as Draft
  return draft.map((seat, seatIndex) => {
    if (seatIndex === index) return { name, fresh: source === 'fresh' }
    return seat ? { ...seat } : null
  })
}

/** 坐满才写入牌组，并清掉「待决定」名单。卡盒不动。 */
export function commitOrganizedDeck(
  state: CampaignState,
  draft: readonly (Seat | null)[],
): RuleResult {
  const names: string[] = []
  for (const seat of draft) {
    if (!seat) return { ok: false, state, message: '牌组必须正好 15 张' }
    names.push(seat.name)
  }
  const edited = commitDeckEdit(state, names)
  if (!edited.ok) return edited
  return { ok: true, state: { ...edited.state, pendingRewardNames: [] } }
}

function countNames(names: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1)
  return counts
}

function remainders(names: readonly string[], used: ReadonlyMap<string, number>): PileRow[] {
  const totals = countNames(names)
  const rows: PileRow[] = []
  const seen = new Set<string>()
  for (const name of names) {
    if (seen.has(name)) continue
    seen.add(name)
    const left = (totals.get(name) ?? 0) - (used.get(name) ?? 0)
    if (left > 0) rows.push({ name, count: left })
  }
  return rows
}
