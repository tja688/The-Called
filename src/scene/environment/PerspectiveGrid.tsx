import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, Group, MeshBasicMaterial } from 'three'
import { STAGE_INTRO, stageProgress } from './stageIntro'

type PerspectiveGridProps = {
  columns?: number
  rows?: number
  tileWidth?: number
  tileDepth?: number
  gutter?: number
  lightColor?: string
  darkColor?: string
  position?: [number, number, number]
}

/** Reusable 3D checkerboard surface. Keep transforms on the parent group so
 * future scenes can animate the whole grid without rebuilding its tiles. */
export function PerspectiveGrid({
  columns = 17,
  rows = 17,
  tileWidth = 2.1,
  tileDepth = tileWidth * (500 / 360),
  gutter = 0.08,
  lightColor = '#dedbd3',
  darkColor = '#101014',
  position = [0, -0.2, -0.65],
}: PerspectiveGridProps) {
  const group = useRef<Group>(null)
  const [lightMaterial, darkMaterial] = useMemo(() => [
    new MeshBasicMaterial({ color: new Color(lightColor) }),
    new MeshBasicMaterial({ color: new Color(darkColor) }),
  ], [darkColor, lightColor])

  const tiles = useMemo(() => Array.from({ length: columns * rows }, (_, index) => ({
    row: Math.floor(index / columns),
    column: index % columns,
  })), [columns, rows])

  useLayoutEffect(() => {
    group.current?.position.set(position[0], position[1], position[2] - 25)
  }, [])

  useFrame((state) => {
    if (!group.current) return
    const progress = stageProgress(state.clock.elapsedTime, STAGE_INTRO.floorStart, STAGE_INTRO.floorDuration)
    group.current.position.z = position[2] - (1 - progress) * 25
    group.current.position.y = position[1] - (1 - progress) * 0.45
  })

  return (
    <group ref={group} position={position}>
      {tiles.map(({ row, column }) => (
        <mesh
          key={`${row}-${column}`}
          position={[
            (column - (columns - 1) / 2) * tileWidth,
            0,
            (row - (rows - 1) / 2) * tileDepth,
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[tileWidth - gutter, tileDepth - gutter]} />
          <primitive
            object={(row + column) % 2 === 0 ? lightMaterial : darkMaterial}
            attach="material"
          />
        </mesh>
      ))}
    </group>
  )
}
