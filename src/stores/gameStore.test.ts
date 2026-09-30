import { beforeEach, describe, expect, it } from 'vitest'
import { useBattleCue } from '../game/v6/view/battle/cue'
import { useGameStore } from './gameStore'

describe('presentation match', () => {
  beforeEach(() => {
    useBattleCue.getState().clear()
    useGameStore.getState().abandon()
  })

  it('refuses a placement until a battle is bound', () => {
    expect(useGameStore.getState().play({
      side: 'player',
      cardInstanceId: 'pcd-1',
      cellId: 'cell-0-0',
    })).toBe('MATCH_NOT_READY')
  })

  it('hands a placement to the bound battle', () => {
    useBattleCue.getState().bind({
      allows: () => true,
      picks: () => false,
      answers: () => false,
      play: () => undefined,
      land: () => undefined,
      answer: () => undefined,
      commit: () => undefined,
    })
    expect(useGameStore.getState().play({
      side: 'player',
      cardInstanceId: 'pcd-1',
      cellId: 'cell-0-0',
    })).toBeUndefined()
  })
})
