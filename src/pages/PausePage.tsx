import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent, type MouseEvent } from 'react'
import { playPauseConfirm, resumeBgmAfterPause } from '../audio/gameAudio'
import { useNavigationStore } from '../stores/navigationStore'
import { BattleFilters } from '../ui/BattleFilters'

type PauseTarget = 'quit' | 'deck' | 'resume' | 'map' | 'settings'

type BeamStyle = CSSProperties & {
  '--beam-angle': string
  '--beam-length': string
}

export function PausePage() {
  const resumeLevel = useNavigationStore((state) => state.resumeLevel)
  const exitToMap = useNavigationStore((state) => state.exitToMap)
  const exitToHome = useNavigationStore((state) => state.exitToHome)
  const beamOriginRef = useRef<HTMLSpanElement>(null)
  const resumeRef = useRef<HTMLButtonElement>(null)
  const aimedTargetRef = useRef<HTMLButtonElement>(null)
  const [aimedTarget, setAimedTarget] = useState<PauseTarget>('resume')
  const [beamStyle, setBeamStyle] = useState<BeamStyle>({
    '--beam-angle': '0deg',
    '--beam-length': '110vw',
  })

  const aimBeam = useCallback((target: HTMLElement, targetName: PauseTarget) => {
    const origin = beamOriginRef.current?.getBoundingClientRect()
    if (!origin) return

    const targetRect = target.getBoundingClientRect()
    const originX = origin.left + origin.width / 2
    const originY = origin.top + origin.height / 2
    const targetX = targetRect.left + targetRect.width / 2
    const targetY = targetRect.top + targetRect.height / 2
    const rawAngle = Math.atan2(targetY - originY, targetX - originX) * (180 / Math.PI) - 180
    const shortestAngle = ((rawAngle + 180) % 360 + 360) % 360 - 180
    const angle = Math.max(-32, Math.min(32, shortestAngle))

    setAimedTarget(targetName)
    aimedTargetRef.current = target as HTMLButtonElement
    setBeamStyle({
      '--beam-angle': `${angle}deg`,
      '--beam-length': `${originX + window.innerWidth * .08}px`,
    })
  }, [])

  const restoreResumeAim = useCallback(() => {
    if (resumeRef.current) aimBeam(resumeRef.current, 'resume')
  }, [aimBeam])

  const realignBeam = useCallback(() => {
    const target = aimedTargetRef.current ?? resumeRef.current
    if (target) aimBeam(target, aimedTarget)
  }, [aimBeam, aimedTarget])

  const handleAim = (targetName: PauseTarget) => (
    event: MouseEvent<HTMLButtonElement> | FocusEvent<HTMLButtonElement>
  ) => aimBeam(event.currentTarget, targetName)

  const confirm = (action: () => void) => () => {
    playPauseConfirm()
    resumeBgmAfterPause()
    action()
  }

  useLayoutEffect(() => {
    restoreResumeAim()
  }, [restoreResumeAim])

  useLayoutEffect(() => {
    window.addEventListener('resize', realignBeam)
    return () => window.removeEventListener('resize', realignBeam)
  }, [realignBeam])

  return (
    <main className="pause-page" aria-label="Game paused">
      <div className="pause-page__backdrop" aria-hidden="true" />
      <div className="pause-page__shade" aria-hidden="true" />

      <div className="pause-visual" aria-hidden="true">
        <img className="pause-visual__ornament" src="/pause/装饰.png" alt="" />
        <span ref={beamOriginRef} className="pause-visual__beam-origin" />
        <div className="pause-beam" style={beamStyle}>
          <div className="pause-beam__glow" />
          <div className="pause-beam__core" />
        </div>
        <img className="pause-visual__eye" src="/pause/eye.png" alt="" />
      </div>

      <nav className="pause-menu" aria-label="Pause menu">
        <button className={`pause-menu__item pause-menu__item--quit${aimedTarget === 'quit' ? ' is-aimed' : ''}`} type="button" onClick={confirm(exitToHome)} onMouseEnter={handleAim('quit')} onFocus={handleAim('quit')} data-text="QUIT">
          QUIT
        </button>
        <button className={`pause-menu__item pause-menu__item--deck${aimedTarget === 'deck' ? ' is-aimed' : ''}`} type="button" aria-disabled="true" onMouseEnter={handleAim('deck')} onFocus={handleAim('deck')} data-text="VIEW DECK">
          VIEW DECK
        </button>
        <button ref={resumeRef} className={`pause-menu__item pause-menu__item--active${aimedTarget === 'resume' ? ' is-aimed' : ''}`} type="button" onClick={confirm(resumeLevel)} onMouseEnter={handleAim('resume')} onFocus={handleAim('resume')} data-text="RESUME">
          RESUME
        </button>
        <button className={`pause-menu__item pause-menu__item--map${aimedTarget === 'map' ? ' is-aimed' : ''}`} type="button" onClick={confirm(exitToMap)} onMouseEnter={handleAim('map')} onFocus={handleAim('map')} data-text="BACK TO MAP">
          BACK TO MAP
        </button>
        <button className={`pause-menu__item pause-menu__item--settings${aimedTarget === 'settings' ? ' is-aimed' : ''}`} type="button" aria-disabled="true" onMouseEnter={handleAim('settings')} onFocus={handleAim('settings')} data-text="SETTING">
          SETTING
        </button>
      </nav>

      <BattleFilters fight fightBlue />
    </main>
  )
}
