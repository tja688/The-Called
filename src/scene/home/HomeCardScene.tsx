import { Canvas, useFrame } from '@react-three/fiber'
import { useState } from 'react'
import { MathUtils } from 'three'
import { cardCatalog } from '../../config/cardCatalog'
import { Card3D } from '../cards/Card3D'

const SHOWCASE = [
  cardCatalog.player_calibration,
  cardCatalog.player_falsification,
  cardCatalog.player_boundary_condition,
]

function Showcase() {
  const [index, setIndex] = useState(0)
  useFrame(({ clock }) => {
    const next = Math.floor(clock.elapsedTime / 4.5) % SHOWCASE.length
    setIndex((current) => (current === next ? current : next))
  })
  const card = SHOWCASE[index]
  return (
    <group position={[0.15, -0.85, 0]} rotation={[Math.PI / 2, 0.28, 0]}>
      <Card3D position={[0, 0, 0]} scale={2.15} face="hero" card={card} />
    </group>
  )
}

function CameraBreathing() {
  useFrame(({ camera, clock }, delta) => {
    camera.position.z = MathUtils.damp(camera.position.z, 8.4, 2.2, delta)
    camera.lookAt(0, 0, 0)
  })
  return null
}

export function HomeCardScene() {
  return (
    <div className="home-card-scene" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 8.4], fov: 42, near: 0.1, far: 30 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: true }}
      >
        <color attach="background" args={['#141311']} />
        <Showcase />
        <CameraBreathing />
      </Canvas>
    </div>
  )
}
