import { describe, expect, it } from 'vitest'
import { beginBattle, createCampaign, finishBattle } from '../../meta'
import {
  boxCopies,
  commitOrganizedDeck,
  firstOpen,
  freshCopies,
  placeCopy,
  seatedDraft,
  unseatAt,
} from './organize'

function wonRun() {
  const started = createCampaign()
  const won = finishBattle(beginBattle(started), 'runaway-machine', true)
  return won.state
}

describe('organized deck draft', () => {
  it('keeps new cards in their own pile and leaves the current deck seated', () => {
    const state = wonRun()
    const draft = seatedDraft(state.deck)

    expect(draft).toHaveLength(15)
    expect(draft.every((seat) => seat !== null && !seat.fresh)).toBe(true)
    expect(freshCopies(state.pendingRewardNames, draft).map((row) => row.name)).toEqual([
      '显微镜',
      '攻击炮台',
    ])
    expect(boxCopies(state.box, draft, state.pendingRewardNames)).toEqual([])
  })

  it('returns an unseated card to the box, then accepts one new card into that hole', () => {
    const state = wonRun()
    const removed = state.deck[0]
    const opened = unseatAt(seatedDraft(state.deck), 0)

    expect(firstOpen(opened)).toBe(0)
    expect(boxCopies(state.box, opened, state.pendingRewardNames)).toEqual([{ name: removed, count: 1 }])
    expect(freshCopies(state.pendingRewardNames, opened).map((row) => row.name)).toEqual([
      '显微镜',
      '攻击炮台',
    ])

    const seated = placeCopy(opened, 0, '显微镜', 'fresh', state.box, state.pendingRewardNames)
    expect(seated[0]).toEqual({ name: '显微镜', fresh: true })
    expect(freshCopies(state.pendingRewardNames, seated).map((row) => row.name)).toEqual(['攻击炮台'])
    expect(boxCopies(state.box, seated, state.pendingRewardNames)).toEqual([{ name: removed, count: 1 }])
  })

  it('sends a new card back to the fresh pile when it is lifted out again', () => {
    const state = wonRun()
    const opened = unseatAt(seatedDraft(state.deck), 0)
    const seated = placeCopy(opened, 0, '显微镜', 'fresh', state.box, state.pendingRewardNames)
    const lifted = unseatAt(seated, 0)

    expect(freshCopies(state.pendingRewardNames, lifted).map((row) => row.name)).toEqual([
      '显微镜',
      '攻击炮台',
    ])
  })

  it('refuses a second copy when only one new card of that name is waiting', () => {
    const state = wonRun()
    let draft = unseatAt(seatedDraft(state.deck), 0)
    draft = unseatAt(draft, 1)
    draft = placeCopy(draft, 0, '显微镜', 'fresh', state.box, state.pendingRewardNames)
    const again = placeCopy(draft, 1, '显微镜', 'fresh', state.box, state.pendingRewardNames)

    expect(again[1]).toBeNull()
  })

  it('saves a full deck, clears the pending list, and keeps unused new cards in the box', () => {
    const state = wonRun()
    const removed = state.deck[0]
    const opened = unseatAt(seatedDraft(state.deck), 0)
    const seated = placeCopy(opened, 0, '显微镜', 'fresh', state.box, state.pendingRewardNames)
    const saved = commitOrganizedDeck(state, seated)

    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.state.deck).toHaveLength(15)
    expect(saved.state.deck[0]).toBe('显微镜')
    expect(saved.state.pendingRewardNames).toEqual([])
    expect(saved.state.box).toContain('显微镜')
    expect(saved.state.box).toContain('攻击炮台')
    expect(saved.state.box).toContain(removed)
  })

  it('leaves the deck unchanged when the player keeps every current card', () => {
    const state = wonRun()
    const saved = commitOrganizedDeck(state, seatedDraft(state.deck))

    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.state.deck).toEqual(state.deck)
    expect(saved.state.box).toEqual(state.box)
    expect(saved.state.pendingRewardNames).toEqual([])
  })

  it('refuses to save while a seat is empty', () => {
    const state = wonRun()
    const opened = unseatAt(seatedDraft(state.deck), 0)
    const saved = commitOrganizedDeck(state, opened)

    expect(saved.ok).toBe(false)
    if (saved.ok) return
    expect(saved.message).toBe('牌组必须正好 15 张')
    expect(saved.state.deck).toEqual(state.deck)
    expect(saved.state.pendingRewardNames).toEqual(state.pendingRewardNames)
  })
})
