import { OrbitControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Mesh } from 'three'

function Placeholder() {
  const mesh = useRef<Mesh>(null)

  useFrame((_, delta) => {
    if (!mesh.current) return
    mesh.current.rotation.x += delta * 0.15
    mesh.current.rotation.y += delta * 0.4
  })

  return (
    <mesh ref={mesh} castShadow receiveShadow>
      <boxGeometry args={[1.2, 1.2, 1.2]} />
      <meshStandardMaterial color="#6ea8fe" metalness={0.15} roughness={0.35} />
    </mesh>
  )
}

export function Experience() {
  return (
    <>
      <color attach="background" args={['#111318']} />
      <hemisphereLight args={['#ffffff', '#1a1c22', 0.55]} />
      <directionalLight
        castShadow
        position={[4, 6, 3]}
        intensity={1.25}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]}>
        <planeGeometry args={[20, 20]} />
        <shadowMaterial opacity={0.28} />
      </mesh>
      <gridHelper args={[20, 20, '#2a2e38', '#1c1f27']} />
      <Placeholder />
      <OrbitControls makeDefault enableDamping />
    </>
  )
}
