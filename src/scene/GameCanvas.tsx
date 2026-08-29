import { Canvas } from '@react-three/fiber'
import { CameraRig } from './camera/CameraRig'
import { TableScene } from './environment/TableScene'
import type { MonsterConfig, SceneConfig } from '../config/gameContent'

export function GameCanvas({ monster, scene }: { monster: MonsterConfig; scene: SceneConfig }) {
  return (
    <Canvas
      camera={{ position: [0, 3.75, 12.4], fov: 63, near: 0.1, far: 60 }}
      dpr={[1, 1.75]}
      shadows
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <CameraRig />
      <TableScene monster={monster} scene={scene} />
    </Canvas>
  )
}
