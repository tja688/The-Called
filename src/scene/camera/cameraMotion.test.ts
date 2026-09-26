import { describe, expect, it } from 'vitest'
import { CAMERA_FRAME_SECONDS, HAND_VIEW_RETURN_MS, cameraDamping } from './cameraMotion'

describe('camera move', () => {
  it('does not leap the rig when a frame stalls', () => {
    const stalled = cameraDamping(0.5)
    expect(stalled).toBeCloseTo(cameraDamping(CAMERA_FRAME_SECONDS), 8)
    expect(stalled).toBeGreaterThan(0.1)
    expect(stalled).toBeLessThan(0.2)
  })

  it('returns to the hand view shortly after a turn resolves', () => {
    expect(HAND_VIEW_RETURN_MS).toBeGreaterThan(0)
    expect(HAND_VIEW_RETURN_MS).toBeLessThanOrEqual(400)
  })
})
