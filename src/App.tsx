import { Canvas } from '@react-three/fiber'
import { Experience } from './scene/Experience'

export function App() {
  return (
    <Canvas
      camera={{ position: [3.2, 2.4, 4.2], fov: 50, near: 0.1, far: 100 }}
      dpr={[1, 2]}
      shadows
      gl={{ antialias: true }}
    >
      <Experience />
    </Canvas>
  )
}
