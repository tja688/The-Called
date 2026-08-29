import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'

export type SceneTransitionConfig = {
  coverMs: number
  revealMs: number
  color: string
  accent: string
  noiseOpacity: number
}

const DEFAULT_CONFIG: SceneTransitionConfig = {
  coverMs: 360,
  revealMs: 520,
  color: '#020405',
  accent: '#77fba6',
  noiseOpacity: 0.11,
}

type TransitionPhase = 'idle' | 'covering' | 'revealing'

type SceneTransitionProps<T extends string> = {
  scene: T
  children: (displayedScene: T) => ReactNode
  config?: Partial<SceneTransitionConfig>
}

/**
 * Keeps the old scene alive until a full-screen shutter covers it, swaps the
 * scene on the hidden frame, then reveals the new one. All app-level scene
 * changes should pass through this component so its visual language can be
 * tuned in one place.
 */
export function SceneTransition<T extends string>({
  scene,
  children,
  config: configOverrides,
}: SceneTransitionProps<T>) {
  const config = { ...DEFAULT_CONFIG, ...configOverrides }
  const [displayedScene, setDisplayedScene] = useState(scene)
  const [phase, setPhase] = useState<TransitionPhase>('idle')
  const pendingScene = useRef(scene)

  pendingScene.current = scene

  useEffect(() => {
    if (phase !== 'idle' || pendingScene.current === displayedScene) return

    setPhase('covering')
  }, [displayedScene, phase, scene])

  useEffect(() => {
    if (phase === 'idle') return

    const delay = phase === 'covering' ? config.coverMs : config.revealMs
    const timer = window.setTimeout(() => {
      if (phase === 'covering') {
        setDisplayedScene(pendingScene.current)
        setPhase('revealing')
      } else {
        setPhase('idle')
      }
    }, delay)

    return () => window.clearTimeout(timer)
  }, [config.coverMs, config.revealMs, phase])

  const style = {
    '--scene-transition-cover-ms': `${config.coverMs}ms`,
    '--scene-transition-reveal-ms': `${config.revealMs}ms`,
    '--scene-transition-color': config.color,
    '--scene-transition-accent': config.accent,
    '--scene-transition-noise-opacity': config.noiseOpacity,
  } as CSSProperties

  return (
    <div className="scene-transition" data-phase={phase} style={style}>
      <div className="scene-transition__content" aria-hidden={phase === 'covering' || undefined}>
        {children(displayedScene)}
      </div>
      <div className="scene-transition__overlay" aria-hidden="true">
        <div className="scene-transition__shutter scene-transition__shutter--top" />
        <div className="scene-transition__shutter scene-transition__shutter--bottom" />
        <div className="scene-transition__seam" />
        <div className="scene-transition__noise" />
      </div>
    </div>
  )
}
