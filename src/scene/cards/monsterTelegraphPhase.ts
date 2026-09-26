export type TelegraphPhase = 'rest' | 'flying' | 'concealed' | 'assembling'

/** The flyer stays up until the board mesh for that exact card is in place. */
export function shouldReleaseMonsterFlight(phase: TelegraphPhase, launchedId: string | null, presentedId: string) {
  return phase === 'flying' && launchedId !== null && launchedId === presentedId
}

/** The shown monster card may start its play even while still concealed. */
export function shouldLaunchMonsterCard(input: {
  playing: boolean
  turn: 'player' | 'monster' | undefined
  openingTurn: boolean
  resolving: boolean
  phase: TelegraphPhase
  telegraphId?: string
  launchedId: string | null
}): boolean {
  if (!input.playing || input.turn !== 'monster' || input.openingTurn || input.resolving) return false
  if (input.phase === 'flying') return false
  if (!input.telegraphId || input.launchedId === input.telegraphId) return false
  return true
}
