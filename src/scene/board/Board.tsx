import { createBoard, cellWorldPosition } from '../../game/core/spatial'
import { Cell } from './Cell'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { Group } from 'three'
import { STAGE_INTRO, stageProgress } from '../environment/stageIntro'

const cells = createBoard()

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

export function Board() {
  return (
    <group position={[0, -0.1, -0.65]}>
      {cells.map((cell, index) => (
        <StagedCell key={cell.id} index={index} id={cell.id} position={cellWorldPosition(cell.row, cell.col)} />
      ))}
    </group>
  )
}
