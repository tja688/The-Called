import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { Group, MathUtils } from 'three'
import { getCardDefinition } from '../../config/cardCatalog'
import type { CameraMode } from '../../game/types'
import { useGameStore } from '../../stores/gameStore'
import { useInteractionStore } from '../../stores/interactionStore'
import { Card3D } from './Card3D'

const POSE: Record<CameraMode, { position: [number, number, number]; tilt: number; scale: number }> = {
  board: { position: [-7.45, 1.55, 0.35], tilt: 1.12, scale: 1.46 },
  hand: { position: [-7.45, 1.55, 0.35], tilt: 1.12, scale: 1.46 },
  overview: { position: [-5.55, 0.34, -1.55], tilt: 0.08, scale: 1.38 },
}

export function MonsterTelegraphCard() {
  const telegraph = useGameStore((state) => state.telegraph)
  const playing = useGameStore((state) => state.match?.status === 'playing')
  const cameraMode = useInteractionStore((state) => state.cameraMode)
  const group = useRef<Group>(null)
  const cardId = telegraph?.card.instanceId

  useLayoutEffect(() => {
    const pose = POSE.board
    group.current?.position.set(...pose.position)
    group.current?.rotation.set(pose.tilt, 0, 0)
    group.current?.scale.setScalar(0.2)
  }, [cardId])

  useFrame((_, delta) => {
    if (!group.current) return
    const pose = POSE[cameraMode]
    const damping = 1 - Math.exp(-delta * 7)
    group.current.position.x = MathUtils.lerp(group.current.position.x, pose.position[0], damping)
    group.current.position.y = MathUtils.lerp(group.current.position.y, pose.position[1], damping)
    group.current.position.z = MathUtils.lerp(group.current.position.z, pose.position[2], damping)
    group.current.rotation.x = MathUtils.lerp(group.current.rotation.x, pose.tilt, damping)
    group.current.scale.setScalar(MathUtils.lerp(group.current.scale.x, pose.scale, damping))
  })

  if (!playing || !telegraph) return null
  const definition = getCardDefinition(telegraph.card.cardId)
  return (
    <group ref={group}>
      <Card3D position={[0, 0, 0]} face="monster" card={definition} currentPower={telegraph.card.currentPower} silent />
    </group>
  )
}
