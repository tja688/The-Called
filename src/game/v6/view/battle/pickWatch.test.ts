import { describe, expect, it } from 'vitest'
import type { PlayChoiceView } from './playChoice'
import { PICK_PROMPT, pickPhase, waitingPlayTargets } from './pickWatch'

function choice(partial: Partial<PlayChoiceView> & Pick<PlayChoiceView, 'targets'>): PlayChoiceView {
  return {
    blocked: false,
    skipped: false,
    placement: 'cell',
    limit: 1,
    from: 'board',
    ...partial,
  }
}

const foe = {
  instanceId: 'foe',
  name: 'foe',
  zone: 'board' as const,
  cell: 2 as const,
  owner: 'enemy' as const,
  basePoints: 3,
}

describe('提前选牌', () => {
  it('举起需要选目标的牌时，还没点的场上牌进入呼吸，并带上那句提示', () => {
    const open = waitingPlayTargets(choice({ targets: [foe, { ...foe, instanceId: 'other', cell: 4 }] }), [])
    expect(pickPhase({
      armedCardId: 'sampler',
      playBoardIds: open.boardIds,
      playDeckIds: open.deckIds,
      effectIds: null,
    })).toEqual({
      kind: 'picking',
      source: 'play',
      boardIds: ['foe', 'other'],
      deckIds: [],
      prompt: PICK_PROMPT,
    })
  })

  it('已经点中的牌不再呼吸，点满之后提示结束，举起的牌还在', () => {
    const open = waitingPlayTargets(choice({ limit: 2, targets: [foe, { ...foe, instanceId: 'other', cell: 4 }] }), ['foe'])
    expect(open.boardIds).toEqual(['other'])
    const filled = waitingPlayTargets(choice({ targets: [foe] }), ['foe'])
    expect(pickPhase({
      armedCardId: 'sampler',
      playBoardIds: filled.boardIds,
      playDeckIds: filled.deckIds,
      effectIds: null,
    })).toEqual({ kind: 'idle' })
  })

  it('滚轮放下举起的牌时，即使目标列表还没清掉，选牌也取消', () => {
    const open = waitingPlayTargets(choice({ targets: [foe] }), [])
    expect(pickPhase({
      armedCardId: undefined,
      playBoardIds: open.boardIds,
      playDeckIds: open.deckIds,
      effectIds: null,
    })).toEqual({ kind: 'idle' })
  })

  it('效果停下来等选牌时，放下手牌取消不了这场等待', () => {
    expect(pickPhase({
      armedCardId: undefined,
      playBoardIds: ['foe'],
      playDeckIds: [],
      effectIds: ['near', 'far'],
    })).toEqual({
      kind: 'picking',
      source: 'effect',
      boardIds: ['near', 'far'],
      deckIds: [],
      prompt: PICK_PROMPT,
    })
  })

  it('效果等待盖过出牌前的选牌；等完之后，手牌还举着就回到出牌前', () => {
    const during = pickPhase({
      armedCardId: 'sampler',
      playBoardIds: ['foe'],
      playDeckIds: ['drawn'],
      effectIds: ['near'],
    })
    expect(during.kind === 'picking' && during.source).toBe('effect')
    expect(pickPhase({
      armedCardId: 'sampler',
      playBoardIds: ['foe'],
      playDeckIds: ['drawn'],
      effectIds: null,
    })).toMatchObject({ source: 'play', boardIds: ['foe'], deckIds: ['drawn'] })
  })

  it('牌组里待选的牌单独列出来，不进场上呼吸', () => {
    const heavy = { ...foe, instanceId: 'heavy', zone: 'deck' as const, cell: null, owner: 'player' as const, basePoints: 8 }
    expect(waitingPlayTargets(choice({ from: 'deck', placement: 'confirm', targets: [heavy, foe] }), [])).toEqual({
      boardIds: ['foe'],
      deckIds: ['heavy'],
    })
  })
})
