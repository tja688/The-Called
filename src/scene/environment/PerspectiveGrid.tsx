import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { BufferGeometry, Group, Vector3 } from 'three'
import { BONE } from '../presentation/palette'
import { useGameStore } from '../../stores/gameStore'
import { STAGE_INTRO, stageNow, stageProgress } from './stageIntro'

function gridGeometry(extent: number, step: number) {
  const points: Vector3[] = []
  for (let i = -extent; i <= extent; i += step) {
    points.push(new Vector3(i, 0, -extent), new Vector3(i, 0, extent))
    points.push(new Vector3(-extent, 0, i), new Vector3(extent, 0, i))
  }
  return new BufferGeometry().setFromPoints(points)
}

export function PerspectiveGrid({ position = [0, -0.2, -0.65] as [number, number, number] }) {
  const battleKey = useGameStore((state) => state.battleKey)
  const group = useRef<Group>(null)
  const geometry = useMemo(() => gridGeometry(18, 4.2), [])

  useLayoutEffect(() => {
    group.current?.position.set(position[0], position[1], position[2] - 18)
  }, [position])

  useFrame((state) => {
    if (!group.current) return
    const progress = stageProgress(stageNow(battleKey, state.clock.elapsedTime), STAGE_INTRO.floorStart, STAGE_INTRO.floorDuration)
    group.current.position.z = position[2] - (1 - progress) * 18
    group.current.position.y = position[1] - (1 - progress) * 0.45
  })

  return (
    <group ref={group} position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} raycast={() => null}>
        <planeGeometry args={[48, 48]} />
        <meshBasicMaterial color="#1c1b18" />
      </mesh>
      <lineSegments geometry={geometry} raycast={() => null}>
        <lineBasicMaterial color={BONE} transparent opacity={0.22} />
      </lineSegments>
    </group>
  )
}
