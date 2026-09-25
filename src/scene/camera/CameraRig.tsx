import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import { MathUtils, Vector3 } from 'three'
import { useInteractionStore } from '../../stores/interactionStore'
import type { CameraMode } from '../../game/types'

const POSES: Record<CameraMode, { position: [number, number, number]; target: [number, number, number]; fov: number }> = {
  board: { position: [0, 4.7, 12.9], target: [0, 0.02, -2.15], fov: 60 },
  hand: { position: [0, 4.85, 9.7], target: [0, 0.28, 1.6], fov: 46 },
  overview: { position: [1.7, 17.2, 1.15], target: [1.7, 0, -0.35], fov: 34 },
}

const desiredTarget = new Vector3()
const desiredPosition = new Vector3()

export function CameraRig() {
  const mode = useInteractionStore((state) => state.cameraMode)
  const camera = useThree((state) => state.camera)
  const lookTarget = useRef(new Vector3(...POSES.board.target))

  useFrame((_, delta) => {
    const pose = POSES[mode]
    const damping = 1 - Math.exp(-delta * 5.5)
    desiredPosition.set(...pose.position)
    desiredTarget.set(...pose.target)
    camera.position.lerp(desiredPosition, damping)
    lookTarget.current.lerp(desiredTarget, damping)
    camera.lookAt(lookTarget.current)
    if ('fov' in camera) {
      camera.fov = MathUtils.lerp(camera.fov, pose.fov, damping)
      camera.updateProjectionMatrix()
    }
  })

  return null
}
