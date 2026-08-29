import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Color, ShaderMaterial } from 'three'

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uBaseColor;
  uniform float uSeed;

  varying vec2 vUv;
  varying vec3 vWorldPosition;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float valueNoise(float x, float salt) {
    float cell = floor(x);
    float blend = smoothstep(0.0, 1.0, fract(x));
    float a = hash21(vec2(cell, salt));
    float b = hash21(vec2(cell + 1.0, salt));
    return mix(a, b, blend);
  }

  void main() {
    vec2 pixel = floor(gl_FragCoord.xy);
    float grain = hash21(pixel + floor(uTime * 18.0));

    // A coarse pixel screen, closer to the printed/checkered texture in the reference.
    vec2 screenCell = floor(gl_FragCoord.xy * 0.42);
    float halftone = mod(screenCell.x + screenCell.y, 2.0);

    vec2 edgePair = min(vUv, 1.0 - vUv);
    float edgeDistance = min(edgePair.x, edgePair.y);
    float verticalEdge = step(edgePair.x, edgePair.y);
    float alongEdge = mix(vUv.x, vUv.y, verticalEdge);

    vec2 tileId = floor(vec2(vWorldPosition.x / 2.1 + 8.5, vWorldPosition.z / 2.9166667 + 8.5));
    float tileNoise = hash21(tileId + uSeed);
    float timeBlock = floor(uTime * mix(2.0, 4.5, tileNoise));
    float pulse = step(0.76, hash21(tileId * 1.73 + timeBlock));

    // Wide, continuous RGB registration errors. Low-frequency noise makes each
    // edge swell, break and rejoin instead of producing a repeating stripe.
    float edgeNoise = valueNoise(alongEdge * 7.0 + tileNoise * 9.0, uSeed + tileId.x * 0.31 + tileId.y);
    float fineNoise = valueNoise(alongEdge * 19.0, uSeed + timeBlock * 0.17 + tileNoise);
    float animatedShift = pulse * (fineNoise - 0.5) * 0.035;
    float continuity = smoothstep(0.08, 0.28, edgeNoise + fineNoise * 0.24);
    float colorSection = hash21(vec2(floor(alongEdge * 4.0) + tileId.x * 2.7, tileId.y + uSeed));
    float magentaWeight = mix(0.30, 1.0, smoothstep(0.34, 0.68, colorSection));
    float greenWeight = mix(0.28, 1.0, 1.0 - smoothstep(0.30, 0.62, colorSection));
    float blueWeight = mix(0.48, 0.92, 1.0 - abs(colorSection * 2.0 - 1.0));

    float magentaEdge = 1.0 - smoothstep(0.040 + animatedShift, 0.066 + animatedShift, edgeDistance);
    float blueEdge = 1.0 - smoothstep(0.068 + edgeNoise * 0.020, 0.094 + edgeNoise * 0.020, edgeDistance);
    float greenEdge = 1.0 - smoothstep(0.092 + fineNoise * 0.035, 0.122 + fineNoise * 0.035, edgeDistance);

    magentaEdge *= mix(0.32, 1.0, continuity) * magentaWeight;
    blueEdge *= mix(0.24, 0.88, continuity) * blueWeight;
    greenEdge *= mix(0.14, 0.82, continuity) * greenWeight * mix(0.65, 1.0, pulse);

    vec3 color = uBaseColor;
    color *= 0.90 + grain * 0.16;
    color *= mix(0.84, 1.08, halftone);
    color = mix(color, vec3(0.10, 0.22, 1.00), blueEdge * 0.68);
    color = mix(color, vec3(0.10, 1.00, 0.35), greenEdge * 0.66);
    color = mix(color, vec3(1.00, 0.02, 0.67), magentaEdge * 0.80);
    color += vec3(0.08, 0.78, 1.0) * pulse * fineNoise * greenEdge * 0.18;

    gl_FragColor = vec4(color, 0.7);
  }
`

export function useFloorMaterials() {
  const materials = useMemo(() => {
    const makeMaterial = (color: string, seed: number) => new ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uBaseColor: { value: new Color(color) },
        uSeed: { value: seed },
      },
      transparent: true,
      toneMapped: false,
    })

    return [makeMaterial('#96949c', 3.17), makeMaterial('#08070c', 8.43)] as const
  }, [])

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime()
    materials[0].uniforms.uTime.value = time
    materials[1].uniforms.uTime.value = time
  })

  useEffect(() => () => {
    materials.forEach((material) => material.dispose())
  }, [materials])

  return materials
}
