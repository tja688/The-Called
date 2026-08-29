import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  ShaderMaterial,
} from 'three'

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform vec3 uColorNear;
  uniform vec3 uColorFar;
  varying vec2 vUv;

  float gridLine(float coordinate, float width) {
    float distanceToLine = abs(fract(coordinate - 0.5) - 0.5);
    float pixel = fwidth(coordinate);
    return 1.0 - smoothstep(pixel * width, pixel * (width + 1.35), distanceToLine);
  }

  void main() {
    // Offset only the depth axis: the grid appears to continuously travel
    // towards the viewer while its geometry remains stable in world space.
    vec2 grid = vec2(vUv.x * 15.0, vUv.y * 34.0 + uTime * uSpeed);
    float vertical = gridLine(grid.x, 0.72);
    float horizontal = gridLine(grid.y, 0.82);
    float core = max(vertical, horizontal);

    // A second, wider pass creates a restrained bloom-like halo without
    // requiring a post-processing pipeline.
    float glowVertical = gridLine(grid.x, 2.8);
    float glowHorizontal = gridLine(grid.y, 3.2);
    float glow = max(glowVertical, glowHorizontal);

    // vUv.y points towards the horizon after the plane rotation. Suppress the
    // upper field so the grid only rises from the lower part of the screen.
    float horizonFade = 1.0 - smoothstep(0.38, 0.88, vUv.y);
    float nearFade = smoothstep(0.0, 0.075, vUv.y);
    float sideFade = smoothstep(0.0, 0.08, vUv.x) * smoothstep(0.0, 0.08, 1.0 - vUv.x);
    float visibility = horizonFade * nearFade * sideFade;

    vec3 color = mix(uColorNear, uColorFar, smoothstep(0.08, 0.78, vUv.y));
    float alpha = (core * 0.9 + glow * 0.18) * visibility;
    gl_FragColor = vec4(color * (core * 1.25 + glow * 0.28), alpha);
  }
`

type NeonGridFloorProps = {
  speed?: number
  nearColor?: string
  farColor?: string
}

export function NeonGridFloor({
  speed = 3.2,
  nearColor = '#ff2b84',
  farColor = '#9d58ff',
}: NeonGridFloorProps) {
  const materialRef = useRef<ShaderMaterial>(null)
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uSpeed: { value: speed },
    uColorNear: { value: new Color(nearColor) },
    uColorFar: { value: new Color(farColor) },
  }), [farColor, nearColor, speed])

  useEffect(() => {
    uniforms.uSpeed.value = speed
    uniforms.uColorNear.value.set(nearColor)
    uniforms.uColorFar.value.set(farColor)
  }, [farColor, nearColor, speed, uniforms])

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
    }
  })

  return (
    <mesh position={[0, -2.15, -8.8]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[38, 58, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthWrite={false}
        side={DoubleSide}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  )
}
