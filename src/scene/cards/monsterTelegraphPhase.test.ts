import { describe, expect, it } from 'vitest'
import { shouldLaunchMonsterCard, shouldReleaseMonsterFlight } from './monsterTelegraphPhase'

const ready = {
  playing: true,
  turn: 'monster' as const,
  openingTurn: false,
  resolving: false,
  telegraphId: 'monster-next',
  launchedId: 'monster-previous',
}

describe('monster telegraph launch', () => {
  it('launches the next card after final battle hides the previous one under the overview camera', () => {
    expect(shouldLaunchMonsterCard({ ...ready, phase: 'concealed' })).toBe(true)
  })

  it('keeps the landed flyer until that card exists on the board', () => {
    expect(shouldReleaseMonsterFlight('flying', 'card-a', 'card-b')).toBe(false)
    expect(shouldReleaseMonsterFlight('flying', null, 'card-a')).toBe(false)
    expect(shouldReleaseMonsterFlight('rest', 'card-a', 'card-a')).toBe(false)
    expect(shouldReleaseMonsterFlight('flying', 'card-a', 'card-a')).toBe(true)
  })

  it('waits out the opening check, a resolution, and a card already in flight', () => {
    expect(shouldLaunchMonsterCard({ ...ready, phase: 'concealed', openingTurn: true })).toBe(false)
    expect(shouldLaunchMonsterCard({ ...ready, phase: 'rest', resolving: true })).toBe(false)
    expect(shouldLaunchMonsterCard({ ...ready, phase: 'flying' })).toBe(false)
    expect(shouldLaunchMonsterCard({ ...ready, phase: 'rest', launchedId: 'monster-next' })).toBe(false)
  })
})
