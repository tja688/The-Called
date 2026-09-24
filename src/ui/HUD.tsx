import { useEffect } from 'react'
import { playCameraTransition } from '../audio/gameAudio'
import { useInteractionStore } from '../stores/interactionStore'
import { useNavigationStore } from '../stores/navigationStore'
import { PlaybackControls } from './PlaybackControls'
import { finalBattleMessage, getBoardPower } from '../game/core/matchEngine'
import { useGameStore } from '../stores/gameStore'
import { getMonsterConfig, getNextLevelId } from '../config/gameContent'
import type { MatchResult } from '../game/types'

export function formatMatchResultMessage(winner: MatchResult['winner'], monsterName: string) {
  return winner === 'draw' ? '平局。' : winner === 'player' ? '你赢了！' : `${monsterName} 获胜。`
}

export function matchResultActions(winner: MatchResult['winner'], hasNextLevel: boolean) {
  if (winner === 'player' && hasNextLevel) return ['next', 'retry', 'map'] as const
  return ['retry', 'map'] as const
}

export function HUD() {
  const setCameraMode = useInteractionStore((state) => state.setCameraMode)
  const resetBattleView = useInteractionStore((state) => state.resetBattleView)
  const match = useGameStore((state) => state.match)
  const initialize = useGameStore((state) => state.initialize)
  const startLevel = useNavigationStore((state) => state.startLevel)
  const exitToMap = useNavigationStore((state) => state.exitToMap)
  const placementNotice = useInteractionStore((state) => state.placementNotice)
  const showPlacementNotice = useInteractionStore((state) => state.showPlacementNotice)
  const monsterName = getMonsterConfig(match?.monsterId ?? null)?.name ?? 'UNKNOWN'
  const resultMessage = formatMatchResultMessage(match?.result?.winner ?? 'draw', monsterName)
  const nextLevelId = getNextLevelId(match?.levelId ?? null)
  const actions = matchResultActions(match?.result?.winner ?? 'draw', Boolean(nextLevelId))

  useEffect(() => {
    if (!placementNotice) return
    const timer = window.setTimeout(() => showPlacementNotice(undefined), 2400)
    return () => window.clearTimeout(timer)
  }, [placementNotice, showPlacementNotice])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.repeat) return
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
      event.preventDefault()
      const current = useInteractionStore.getState().cameraMode
      const enteringOverview = current !== 'overview'
      playCameraTransition(enteringOverview ? 'up' : 'down')
      setCameraMode(enteringOverview ? 'overview' : 'board')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setCameraMode])

  return (
    <>
      <PlaybackControls />
      {match && (
        <section className="battle-status" aria-live="polite">
          <div className="battle-status__score">
            <span>{getBoardPower(match, 'player')}</span>
            <span>—</span>
            <span>{getBoardPower(match, 'monster')}</span>
          </div>
          <div className="battle-status__meta">
            <span>{monsterName}</span>
            <span>{match.status === 'finished' ? '结束' : match.turn === 'player' ? '你的回合' : '对方回合'}</span>
          </div>
        </section>
      )}
      {placementNotice && <div className="placement-notice" role="status">{placementNotice}</div>}
      {match?.finalBattle && match.status === 'playing' && !placementNotice && (
        <div className="placement-notice" role="status">{finalBattleMessage}</div>
      )}
      {match?.status === 'finished' && match.result && (
        <div className="match-result" role="dialog" aria-modal="true" aria-label="对局结果">
          <div className="match-result__panel">
            <strong>{resultMessage}</strong>
            <span>YOU {match.result.playerPower} — {match.result.monsterPower} {monsterName}</span>
            <div className="match-result__actions">
              {actions.includes('next') && nextLevelId && (
                <button type="button" onClick={() => { resetBattleView(); startLevel(nextLevelId) }}>下一关</button>
              )}
              {actions.includes('retry') && (
                <button type="button" onClick={() => { resetBattleView(); initialize(match.levelId, match.monsterId) }}>再来</button>
              )}
              {actions.includes('map') && (
                <button type="button" onClick={exitToMap}>回地图</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
