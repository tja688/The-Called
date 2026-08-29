import { useEffect } from 'react'
import { playCameraTransition } from '../audio/gameAudio'
import { useInteractionStore } from '../stores/interactionStore'
import { PlaybackControls } from './PlaybackControls'
import { getBoardPower } from '../game/core/matchEngine'
import { useGameStore } from '../stores/gameStore'
import { getMonsterConfig } from '../config/gameContent'
import type { MatchResult } from '../game/types'

export function formatMatchResultMessage(winner: MatchResult['winner'], monsterName: string) {
  return winner === 'draw' ? '平局。' : winner === 'player' ? '你赢了！' : `${monsterName} 获胜。`
}

export function HUD() {
  const setCameraMode = useInteractionStore((state) => state.setCameraMode)
  const match = useGameStore((state) => state.match)
  const initialize = useGameStore((state) => state.initialize)
  const placementNotice = useInteractionStore((state) => state.placementNotice)
  const showPlacementNotice = useInteractionStore((state) => state.showPlacementNotice)
  const monsterName = getMonsterConfig(match?.monsterId ?? null)?.name ?? 'UNKNOWN'
  const resultMessage = formatMatchResultMessage(match?.result?.winner ?? 'draw', monsterName)

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
          <div className="battle-status__names">
            <span>YOU</span>
            <small>VS</small>
            <span>{monsterName}</span>
          </div>
          <div className="battle-status__score">
            <span>{getBoardPower(match, 'player')}</span>
            <span>—</span>
            <span>{getBoardPower(match, 'monster')}</span>
          </div>
          <div className="battle-status__meta">
            <span>{match.status === 'finished' ? 'MATCH COMPLETE' : match.turn === 'player' ? 'YOUR TURN' : 'MONSTER TURN'}</span>
            <span>DECK {match.player.deck.length}</span>
          </div>
        </section>
      )}
      {placementNotice && <div className="placement-notice" role="status">{placementNotice}<small>只有点数更大的牌可以覆盖敌方卡牌</small></div>}
      {match?.status === 'finished' && match.result && (
        <div className="match-result" role="dialog" aria-modal="true" aria-label="对局结果">
          <div className="match-result__panel">
            <span className="match-result__eyebrow">MATCH COMPLETE</span>
            <strong>{resultMessage}</strong>
            <span>YOU {match.result.playerPower} — {match.result.monsterPower} {monsterName}</span>
            <button type="button" onClick={() => initialize(match.levelId, match.monsterId)}>再来一局</button>
          </div>
        </div>
      )}
    </>
  )
}
