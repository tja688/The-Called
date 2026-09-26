import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { Vector3 } from 'three'
import { useInteractionStore } from '../../stores/interactionStore'
import type { CameraMode } from '../../game/types'
import { cameraDamping, cameraMotion } from './cameraMotion'

const POSES: Record<CameraMode, { position: [number, number, number]; target: [number, number, number]; fov: number }> = {
  board: { position: [0, 4.7, 12.9], target: [0, 0.02, -2.15], fov: 60 },
  hand: { position: [0, 4.85, 9.7], target: [0, 0.28, 1.6], fov: 46 },
  overview: { position: [1.7, 17.2, 1.15], target: [1.7, 0, -0.35], fov: 34 },
}

const desiredTarget = new Vector3()
const desiredPosition = new Vector3()

const SETTLE_DISTANCE = 0.02

export function CameraRig() {
  const mode = useInteractionStore((state) => state.cameraMode)
  const camera = useThree((state) => state.camera)
  const lookTarget = useRef(new Vector3(...POSES.board.target))
  const modeRef = useRef(mode)

  useLayoutEffect(() => {
    const pose = POSES[modeRef.current]
    camera.position.set(...pose.position)
    lookTarget.current.set(...pose.target)
    camera.lookAt(lookTarget.current)
    if ('fov' in camera) {
      camera.fov = pose.fov
      camera.updateProjectionMatrix()
    }
    cameraMotion.settled = true
  }, [camera])

  useLayoutEffect(() => {
    if (modeRef.current === mode) return
    modeRef.current = mode
    cameraMotion.settled = false
  }, [mode])

  useFrame((_, delta) => {
    const pose = POSES[mode]
    desiredPosition.set(...pose.position)
    desiredTarget.set(...pose.target)
    const fovGap = 'fov' in camera ? Math.abs(camera.fov - pose.fov) : 0
    const seated = camera.position.distanceTo(desiredPosition) < SETTLE_DISTANCE
      && lookTarget.current.distanceTo(desiredTarget) < SETTLE_DISTANCE
      && fovGap < 0.05
    if (seated) {
      if (!cameraMotion.settled) {
        camera.position.copy(desiredPosition)
        lookTarget.current.copy(desiredTarget)
        camera.lookAt(lookTarget.current)
        if ('fov' in camera && fovGap > 0) {
          camera.fov = pose.fov
          camera.updateProjectionMatrix()
        }
        cameraMotion.settled = true
      }
      return
    }
    cameraMotion.settled = false
    const damping = cameraDamping(delta)
    camera.position.lerp(desiredPosition, damping)
    lookTarget.current.lerp(desiredTarget, damping)
    camera.lookAt(lookTarget.current)
    if ('fov' in camera) {
      const nextFov = camera.fov + (pose.fov - camera.fov) * damping
      if (Math.abs(camera.fov - nextFov) > 0.001) {
        camera.fov = nextFov
        camera.updateProjectionMatrix()
      }
    }
  })

  return null
}
