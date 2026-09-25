import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BufferGeometry, Group, MathUtils, Vector3 } from 'three'
import { useInteractionStore } from '../../stores/interactionStore'
import { BONE } from '../presentation/palette'

function circleGeometry(radius: number, from = 0, to = Math.PI * 2, segments = 80) {
  const points: Vector3[] = []
  for (let i = 0; i <= segments; i += 1) {
    const angle = from + ((to - from) * i) / segments
    points.push(new Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0))
  }
  return new BufferGeometry().setFromPoints(points)
}

function LineCircle({ radius, position, opacity, spin = 0 }: {
  radius: number
  position: [number, number, number]
  opacity: number
  spin?: number
}) {
  const geometry = useMemo(() => circleGeometry(radius), [radius])
  const group = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (!group.current || spin === 0) return
    group.current.rotation.z = clock.elapsedTime * spin
  })
  return (
    <group ref={group} position={position}>
      <line geometry={geometry} raycast={() => null}>
        <lineBasicMaterial color={BONE} transparent opacity={opacity} />
      </line>
    </group>
  )
}

function HorizonTicks() {
  const geometry = useMemo(() => {
    const points: Vector3[] = []
    for (let i = -8; i <= 8; i += 1) {
      if (Math.abs(i) < 3) continue
      const x = i * 1.7
      const height = i % 2 === 0 ? 0.55 : 0.28
      points.push(new Vector3(x, 0, 0), new Vector3(x, height, 0))
    }
    return new BufferGeometry().setFromPoints(points)
  }, [])
  return (
    <lineSegments geometry={geometry} position={[0, 0.04, -12.2]} raycast={() => null}>
      <lineBasicMaterial color={BONE} transparent opacity={0.22} />
    </lineSegments>
  )
}

export function StageAtmosphere() {
  const tactical = useInteractionStore((state) => state.cameraMode === 'overview')
  const sky = useRef<Group>(null)
  const stars = useMemo(() => {
    const points: Vector3[] = []
    for (let i = 0; i < 28; i += 1) {
      const angle = i * 2.399
      const radius = 7.5 + (i % 5) * 1.5
      points.push(new Vector3(Math.cos(angle) * radius * 1.4, 3.4 + (i % 4) * 1.05, -11 - (i % 3)))
    }
    return new BufferGeometry().setFromPoints(points)
  }, [])
  const horizon = useMemo(() => circleGeometry(9.2, Math.PI * 0.08, Math.PI * 0.92, 48), [])

  useFrame((_, delta) => {
    if (!sky.current) return
    const damping = 1 - Math.exp(-delta * 4)
    sky.current.scale.setScalar(MathUtils.lerp(sky.current.scale.x, tactical ? 0.001 : 1, damping))
  })

  return (
    <group raycast={() => null}>
      <group ref={sky}>
        <LineCircle radius={2.15} position={[-7.6, 5.35, -8.8]} opacity={0.28} spin={0.04} />
        <LineCircle radius={1.15} position={[-6.7, 6.15, -9.4]} opacity={0.16} spin={-0.06} />
        <LineCircle radius={1.7} position={[7.8, 4.7, -8.2]} opacity={0.24} spin={-0.05} />
        <line geometry={horizon} position={[0, 0.02, -10.5]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <lineBasicMaterial color={BONE} transparent opacity={0.16} />
        </line>
        <HorizonTicks />
        <points geometry={stars} raycast={() => null}>
          <pointsMaterial color={BONE} size={0.035} transparent opacity={0.4} sizeAttenuation />
        </points>
      </group>
    </group>
  )
}
