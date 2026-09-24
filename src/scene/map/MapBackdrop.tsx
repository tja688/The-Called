import { Canvas } from '@react-three/fiber'
import { NeonGridFloor } from './NeonGridFloor'

export function MapBackdrop() {
  return (
    <div className="map-grid" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 5.4, 11.8], fov: 58, near: 0.1, far: 80 }}
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#141311']} />
        <fog attach="fog" args={['#141311', 17, 39]} />
        <NeonGridFloor nearColor="#efeae0" farColor="#3a3834" speed={0.35} />
      </Canvas>
    </div>
  )
}
