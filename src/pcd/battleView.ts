import type { CameraMode } from '../game/types'
import { instanceKey } from './ids'

export type PendingView = {
  actor: string
  options: readonly { kind: string; instance: number }[]
}

/** The player can pick a hand card. A board target is a different gesture. */
export function canPlayFromHand(pending: PendingView | null | undefined) {
  if (!pending || pending.actor !== 'player') return false
  return pending.options.some((option) => option.kind === 'play' || option.kind === 'cast')
}

function pointsAtBoard(pending: PendingView, boardInstances: ReadonlySet<number>) {
  return pending.options.some((option) =>
    option.kind === 'cell' || (option.kind === 'card' && boardInstances.has(option.instance)),
  )
}

/**
 * Where the camera rests once a kernel step has finished.
 * Playing a card lifts to overhead; the hand view comes back when the player
 * can choose another card. Pointing at the board stays overhead.
 */
export function nextCameraMode(
  cameraMode: CameraMode,
  selected: boolean,
  pending: PendingView | null | undefined,
  boardInstances: ReadonlySet<number>,
): CameraMode {
  if (pending && pending.actor === 'player' && !canPlayFromHand(pending) && pointsAtBoard(pending, boardInstances)) {
    return 'overview'
  }
  if (selected) return cameraMode
  if (cameraMode === 'overview') return 'board'
  return cameraMode
}

export function boardTargetIds(
  options: readonly { kind: string; instance: number }[],
  boardInstances: ReadonlySet<number>,
) {
  return options
    .filter((option) => option.kind === 'card' && boardInstances.has(option.instance))
    .map((option) => instanceKey(option.instance))
}
