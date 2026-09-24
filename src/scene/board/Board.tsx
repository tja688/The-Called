import { useEffect } from 'react'
import { createBoard, cellWorldPosition } from '../../game/core/spatial'
import { useGameStore } from '../../stores/gameStore'
import { BONE } from '../presentation/palette'
import { Cell } from './Cell'
import { resolutionBeatMs } from './resolutionBeat'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { BoxGeometry, Group } from 'three'
import { STAGE_INTRO, stageProgress } from '../environment/stageIntro'

const cells = createBoard()
const boardFrame = new BoxGeometry(6.7, 0.02, 9.15)

function StagedCell({ index, ...props }: { index: number; id: Parameters<typeof Cell>[0]['id']; position: readonly [number, number, number] }) {
  const group = useRef<Group>(null)
  useLayoutEffect(() => {
    group.current?.scale.setScalar(0.001)
  }, [])
  useFrame((state) => {
    if (!group.current) return
    const progress = stageProgress(state.clock.elapsedTime, STAGE_INTRO.boardStart + index * STAGE_INTRO.boardStep, STAGE_INTRO.boardCellDuration)
    const bounce = Math.sin(progress * Math.PI) * 0.16
    group.current.position.y = (1 - progress) * 1.25 + bounce
    group.current.rotation.y = (1 - progress) * 0.28 * (index % 2 ? -1 : 1)
    group.current.scale.setScalar(Math.max(0.001, progress))
  })
  return <group ref={group}><Cell {...props} /></group>
}

function ResolutionClock() {
  const resolution = useGameStore((state) => state.resolution)
  const placementSettled = useGameStore((state) => state.placementSettled)
  const finishResolution = useGameStore((state) => state.finishResolution)

  useEffect(() => {
    if (!resolution || !placementSettled) return
    const timer = window.setTimeout(finishResolution, resolutionBeatMs(resolution))
    return () => window.clearTimeout(timer)
  }, [finishResolution, placementSettled, resolution])

  return null
}

export function Board() {
  return (
    <group position={[0, -0.1, -0.65]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[6.7, 9.15]} />
        <meshBasicMaterial color="#141311" />
      </mesh>
      <lineSegments position={[0, 0.03, 0]} raycast={() => null}>
        <edgesGeometry args={[boardFrame]} />
        <lineBasicMaterial color={BONE} />
      </lineSegments>
      <ResolutionClock />
      {cells.map((cell, index) => (
        <StagedCell key={cell.id} index={index} id={cell.id} position={cellWorldPosition(cell.row, cell.col)} />
      ))}
    </group>
  )
}
