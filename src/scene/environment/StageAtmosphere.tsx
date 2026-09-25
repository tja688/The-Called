import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { BufferGeometry, Group, Line, LineBasicMaterial, MathUtils, Vector3 } from 'three'
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

function Wire({ geometry, opacity, position, rotation }: {
  geometry: BufferGeometry
  opacity: number
  position?: [number, number, number]
  rotation?: [number, number, number]
}) {
  const object = useMemo(() => {
    const material = new LineBasicMaterial({ color: BONE, transparent: true, opacity })
    const line = new Line(geometry, material)
    line.raycast = () => null
    return line
  }, [geometry, opacity])
  return <primitive object={object} position={position} rotation={rotation} />
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
      <Wire geometry={geometry} opacity={opacity} />
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

function SplitMarks() {
  const bridge = useMemo(() => {
    const points = [
      new Vector3(-6.2, 4.2, 0), new Vector3(-4.4, 6.1, 0),
      new Vector3(4.4, 3.4, 0), new Vector3(6.2, 5.3, 0),
      new Vector3(-5.3, 5.15, 0), new Vector3(5.3, 4.35, 0),
    ]
    return new BufferGeometry().setFromPoints(points)
  }, [])
  return (
    <group>
      <lineSegments geometry={bridge} position={[0, 0, -9]} raycast={() => null}>
        <lineBasicMaterial color={BONE} transparent opacity={0.4} />
      </lineSegments>
      <LineCircle radius={0.55} position={[-5.3, 5.15, -8.6]} opacity={0.55} />
      <LineCircle radius={0.55} position={[5.3, 4.35, -8.6]} opacity={0.55} />
      <LineCircle radius={1.35} position={[-5.3, 5.15, -9.1]} opacity={0.2} spin={0.07} />
      <LineCircle radius={1.35} position={[5.3, 4.35, -9.1]} opacity={0.2} spin={-0.07} />
    </group>
  )
}

function CrescentMarks() {
  const crescent = useMemo(() => circleGeometry(2.8, Math.PI * 0.28, Math.PI * 1.72, 56), [])
  const orbit = useMemo(() => circleGeometry(4.6, 0, Math.PI * 2, 72), [])
  return (
    <group position={[5.4, 5.2, -8.8]}>
      <Wire geometry={crescent} opacity={0.62} />
      <Wire geometry={orbit} opacity={0.2} />
      <mesh position={[1.15, 0.15, 0]} raycast={() => null}>
        <circleGeometry args={[0.16, 20]} />
        <meshBasicMaterial color={BONE} />
      </mesh>
    </group>
  )
}

function FloorMotif({ motif }: { motif: 'eclipse' | 'split' | 'crescent' }) {
  if (motif === 'split') {
    return (
      <group position={[0, -0.16, -1.2]}>
        {[-7.1, 7.1].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[-Math.PI / 2, 0, 0.2 * Math.sign(x)]} raycast={() => null}>
            <planeGeometry args={[0.045, 16]} />
            <meshBasicMaterial color={BONE} transparent opacity={0.34} />
          </mesh>
        ))}
      </group>
    )
  }
  if (motif === 'crescent') {
    return (
      <group position={[0, -0.16, -1.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh raycast={() => null}>
          <ringGeometry args={[8.4, 8.48, 90]} />
          <meshBasicMaterial color={BONE} side={2} transparent opacity={0.32} />
        </mesh>
        <mesh raycast={() => null}>
          <ringGeometry args={[5.1, 5.16, 70]} />
          <meshBasicMaterial color={BONE} side={2} transparent opacity={0.18} />
        </mesh>
      </group>
    )
  }
  return null
}

export function StageAtmosphere({ monsterId }: { monsterId: string }) {
  const motif = monsterId === 'rahu-ketu' ? 'split' : monsterId === 'moon' ? 'crescent' : 'eclipse'
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
      <FloorMotif motif={motif} />
      <group ref={sky}>
        {motif === 'eclipse' && (
          <>
            <LineCircle radius={2.15} position={[-7.6, 5.35, -8.8]} opacity={0.28} spin={0.04} />
            <LineCircle radius={1.15} position={[-6.7, 6.15, -9.4]} opacity={0.16} spin={-0.06} />
            <LineCircle radius={1.7} position={[7.8, 4.7, -8.2]} opacity={0.24} spin={-0.05} />
            <Wire geometry={horizon} opacity={0.16} position={[0, 0.02, -10.5]} rotation={[-Math.PI / 2, 0, 0]} />
            <HorizonTicks />
          </>
        )}
        {motif === 'split' && <SplitMarks />}
        {motif === 'crescent' && <CrescentMarks />}
        <points geometry={stars} raycast={() => null}>
          <pointsMaterial color={BONE} size={0.035} transparent opacity={motif === 'eclipse' ? 0.4 : 0.22} sizeAttenuation />
        </points>
      </group>
    </group>
  )
}
