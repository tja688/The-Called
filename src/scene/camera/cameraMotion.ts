/** Shared camera-move clock. A long frame must not leap the rig. */
export const CAMERA_LAMBDA = 5.5
export const CAMERA_FRAME_SECONDS = 1 / 30

/** How long the overhead view holds after a turn comes back, before the hand view returns. */
export const HAND_VIEW_RETURN_MS = 360

export const cameraMotion = { settled: false }

export function cameraDamping(delta: number, lambda = CAMERA_LAMBDA) {
  const step = Math.min(Math.max(delta, 0), CAMERA_FRAME_SECONDS)
  return 1 - Math.exp(-step * lambda)
}
