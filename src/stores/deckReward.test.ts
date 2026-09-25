import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultLoadout } from '../config/deckLoadout'
import { useCampaignStore } from './campaignStore'
import { useDeckStore } from './deckStore'

describe('level rewards', () => {
  beforeEach(() => {
    useDeckStore.getState().reset()
    useCampaignStore.getState().reset()
  })

  it('grants a level once, leaves the battle slots, and can be claimed again after reset', () => {
    const slots = [...useDeckStore.getState().slots]
    const first = useDeckStore.getState().claimLevelReward('level-01')
    expect(first).toEqual(['player_antipode', 'player_meridian', 'player_error_correction'])
    expect(useDeckStore.getState().slots).toEqual(slots)
    expect(useDeckStore.getState().library.find((entry) => entry.cardId === 'player_antipode')?.count).toBe(1)
    expect(useDeckStore.getState().library.find((entry) => entry.cardId === 'player_meridian')?.count).toBe(1)
    expect(useDeckStore.getState().library.find((entry) => entry.cardId === 'player_error_correction')?.count).toBe(2)
    expect(useDeckStore.getState().claimLevelReward('level-01')).toEqual([])
    expect(useDeckStore.getState().library.find((entry) => entry.cardId === 'player_antipode')?.count).toBe(1)

    useCampaignStore.getState().reset()
    expect(useDeckStore.getState().claimedLevelIds).toEqual(['level-01'])
    expect(useDeckStore.getState().library.find((entry) => entry.cardId === 'player_antipode')?.count).toBe(1)

    useDeckStore.getState().reset()
    expect(useDeckStore.getState().claimedLevelIds).toEqual([])
    expect(useDeckStore.getState().library).toEqual(createDefaultLoadout().library)
    expect(useDeckStore.getState().claimLevelReward('level-02')).toEqual([
      'player_center_condition',
      'player_syzygy',
      'player_boundary_condition',
    ])
    expect(useDeckStore.getState().slots).toEqual(createDefaultLoadout().slots)
  })

  it('returns nothing for a level without a reward', () => {
    expect(useDeckStore.getState().claimLevelReward('level-03')).toEqual([])
    expect(useDeckStore.getState().claimedLevelIds).toEqual([])
  })
})
