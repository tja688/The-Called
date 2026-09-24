import type { PlayResolution } from '../../game/types'

export const POWER_COUNT_MS = 520
export const DEPART_FADE_MS = 420

export function resolutionBeatMs(resolution: PlayResolution) {
  const steps = resolution.cover ? Math.max(0, resolution.cover.fromPower - resolution.cover.toPower) : 0
  const countMs = steps > 0 ? POWER_COUNT_MS : 0
  const placedRemoved = Boolean(
    resolution.cover && resolution.removed.some((item) => item.card.instanceId === resolution.cover?.cardInstanceId),
  )
  const neighborRemoved = resolution.removed.some((item) => item.card.instanceId !== resolution.cover?.cardInstanceId)
  const fadeMs = placedRemoved || (!resolution.cover && neighborRemoved) ? DEPART_FADE_MS : 0
  return countMs + fadeMs
}
