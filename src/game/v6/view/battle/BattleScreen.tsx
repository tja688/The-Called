import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { GameCanvas } from '../../../../scene/GameCanvas'
import { HAND_VIEW_RETURN_MS } from '../../../../scene/camera/cameraMotion'
import { playCameraTransition } from '../../../../audio/gameAudio'
import { clearPresentedCards } from '../../../../config/cardCatalog'
import { getBoardPower } from '../../../../game/core/matchEngine'
import type { PlayCardAction } from '../../../../game/types'
import { useGameStore, type MonsterTelegraph } from '../../../../stores/gameStore'
import { useInteractionStore } from '../../../../stores/interactionStore'
import { usePresentationStore } from '../../../../stores/presentationStore'
import {
  answerEncounterChoice,
  endEncounterTurn,
  playEncounterCard,
  snapshotEncounter,
  type Encounter,
} from '../../encounter'
import { inspectPlay, type BattleState, type CellId } from '../../rules'
import { ARRIVAL_COPY } from '../map'
import { actOnCell, actOnConfirm, readPlayChoice, togglePlayTargets, type PlayChoiceView } from './playChoice'
import { useBattleCue } from './cue'
import {
  arrivalTelegraph,
  boardArrivals,
  buriedUnder,
  intentPreview,
  monsterScene,
  openingLay,
  projectMatch,
  publishFaces,
  ruleCell,
  sceneCell,
  type BoardArrival,
  type IntentPreview,
} from './project'
import './battle.css'

const LAY_DELAY_MS = 2800

type Mode = 'wait' | 'lay' | 'play' | 'enemy'

type Session = {
  encounter: Encounter
  targets: string[]
  queue: BoardArrival[]
  pending: Encounter | null
  mode: Mode
  buried: boolean
  started: boolean
  /** End the action once this play's landing animation finishes. */
  seal: boolean
}

type ShowInput = {
  battle: BattleState
  faces: BattleState[]
  previews?: IntentPreview[]
  hidden?: ReadonlySet<string>
  turn: 'player' | 'monster'
  openingTurn?: boolean
  over: boolean
  winner: 'player' | 'enemy' | null
  telegraph?: MonsterTelegraph
  activePlacement?: PlayCardAction
  buried?: { cell: CellId; instanceId: string } | null
}

export function BattleScreen({
  encounter,
  monsterId,
  title,
  announceArrival,
  onEncounter,
  onLeave,
}: {
  encounter: Encounter
  monsterId: string
  title: string
  announceArrival: boolean
  onEncounter: (encounter: Encounter) => void
  onLeave: (winner: 'player' | 'enemy') => void
}) {
  const stage = useMemo(() => monsterScene(monsterId, title), [monsterId, title])
  const sessionRef = useRef<Session>({
    encounter,
    targets: [],
    queue: [],
    pending: null,
    mode: 'play',
    buried: false,
    started: false,
    seal: false,
  })
  const onEncounterRef = useRef(onEncounter)
  const monsterRef = useRef(monsterId)
  const api = useRef<{
    allows: (instanceId: string, cell: PlayCardAction['cellId']) => boolean
    picks: (cell: PlayCardAction['cellId']) => boolean
    answers: (cell: PlayCardAction['cellId']) => boolean
    play: (action: PlayCardAction) => string | undefined
    land: () => void
    answer: (cell: PlayCardAction['cellId']) => void
    commit: (instanceId: string) => void
  }>({
    allows: () => false,
    picks: () => false,
    answers: () => false,
    play: () => 'MATCH_NOT_READY',
    land: () => undefined,
    answer: () => undefined,
    commit: () => undefined,
  })
  const layTimer = useRef<number | undefined>(undefined)
  const returnTimer = useRef<number | undefined>(undefined)
  const landedRef = useRef<() => void>(() => {})
  const [mode, setMode] = useState<Mode>('play')
  const [leaving, setLeaving] = useState(false)
  const selectedId = useInteractionStore((state) => state.selectedCardInstanceId)
  const placementNotice = useInteractionStore((state) => state.placementNotice)
  const showPlacementNotice = useInteractionStore((state) => state.showPlacementNotice)
  const projected = useGameStore((state) => state.match)
  const placing = useGameStore((state) => state.activePlacement)
  const picks = useBattleCue((state) => state.picksIds)
  onEncounterRef.current = onEncounter
  monsterRef.current = monsterId

  const show = (input: ShowInput) => {
    const session = sessionRef.current
    const bump = !session.started
    session.started = true
    publishFaces(input.faces, input.previews ?? [])
    const match = projectMatch({
      battle: input.battle,
      monsterId: monsterRef.current,
      hidden: input.hidden,
      turn: input.turn,
      openingTurn: input.openingTurn,
      over: input.over,
      winner: input.winner,
      buried: input.buried,
    })
    if (bump) useInteractionStore.getState().resetBattleView()
    const cue = useBattleCue.getState()
    useGameStore.setState({
      match,
      battleKey: bump ? useGameStore.getState().battleKey + 1 : useGameStore.getState().battleKey,
      telegraph: input.telegraph,
      activePlacement: input.activePlacement,
      resolution: undefined,
      placementSettled: false,
    })
    cue.bump(cue.picksIds, input.battle.polluted.map(sceneCell))
  }

  const reveal = (enc: Encounter) => {
    const preview = enc.match.over ? null : intentPreview(enc.match)
    show({
      battle: enc.match.battle,
      faces: [enc.match.battle],
      previews: preview ? [preview] : [],
      turn: 'player',
      openingTurn: needsChoice(enc),
      over: enc.match.over,
      winner: enc.match.winner,
      telegraph: preview ? previewTelegraph(preview) : undefined,
    })
  }

  const liftCamera = () => {
    const interaction = useInteractionStore.getState()
    if (interaction.cameraMode === 'overview') return
    playCameraTransition('up')
    interaction.setCameraMode('overview')
  }

  const adopt = (after: Encounter, placed?: PlayCardAction) => {
    const session = sessionRef.current
    const buriedId = placed ? buriedUnder(session.encounter.match.battle, after.match.battle, ruleCell(placed.cellId)) : null
    session.encounter = after
    session.pending = null
    session.buried = Boolean(buriedId)
    session.targets = []
    session.mode = 'play'
    setMode('play')
    useBattleCue.getState().bump([])
    const preview = after.match.over ? null : intentPreview(after.match)
    show({
      battle: after.match.battle,
      faces: [after.match.battle],
      previews: preview ? [preview] : [],
      turn: 'player',
      openingTurn: needsChoice(after),
      over: after.match.over,
      winner: after.match.winner,
      telegraph: preview ? previewTelegraph(preview) : undefined,
      activePlacement: placed,
      buried: buriedId && placed ? { cell: ruleCell(placed.cellId), instanceId: buriedId } : null,
    })
    onEncounterRef.current(after)
  }

  const stageArrivals = (before: Encounter, after: Encounter, placed?: PlayCardAction) => {
    const session = sessionRef.current
    const arrivals = boardArrivals(before.match.battle, after.match.battle)
      .filter((item) => item.instanceId !== placed?.cardInstanceId)
    session.targets = []
    useBattleCue.getState().bump([])
    if (arrivals.length === 0) {
      adopt(after, placed)
      return
    }
    session.pending = after
    session.queue = arrivals
    session.buried = false
    session.mode = 'enemy'
    setMode('enemy')
    liftCamera()
    const first = arrivals[0]
    if (!placed) {
      show({
        battle: before.match.battle,
        faces: [before.match.battle, after.match.battle],
        turn: 'monster',
        over: false,
        winner: null,
        telegraph: arrivalTelegraph(after.match.battle, first, true),
      })
      return
    }
    const buriedId = buriedUnder(before.match.battle, after.match.battle, ruleCell(placed.cellId))
    session.buried = Boolean(buriedId)
    show({
      battle: after.match.battle,
      faces: [before.match.battle, after.match.battle],
      hidden: new Set(arrivals.map((item) => item.instanceId)),
      turn: 'monster',
      over: false,
      winner: null,
      telegraph: arrivalTelegraph(after.match.battle, first, true),
      activePlacement: placed,
      buried: buriedId ? { cell: ruleCell(placed.cellId), instanceId: buriedId } : null,
    })
  }

  const presentPlay = (before: Encounter, after: Encounter, placed?: PlayCardAction) => {
    const arrivals = boardArrivals(before.match.battle, after.match.battle)
      .filter((item) => item.instanceId !== placed?.cardInstanceId)
    const animated = Boolean(placed) || arrivals.length > 0
    if (!animated && actionSpent(after)) {
      sessionRef.current.seal = false
      stageArrivals(after, endEncounterTurn(after))
      return
    }
    sessionRef.current.seal = actionSpent(after)
    stageArrivals(before, after, placed)
  }

  const release = (enc: Encounter, step: ReturnType<typeof actOnCell>, placed?: PlayCardAction) => {
    if (step.kind === 'wait') {
      useInteractionStore.getState().showPlacementNotice(step.message)
      return step.message
    }
    if (step.kind !== 'play') return 'choose'
    const played = playEncounterCard(enc, step.request)
    if (!played.ok) {
      useInteractionStore.getState().showPlacementNotice(failureText(played.reason))
      return played.reason
    }
    useInteractionStore.getState().finishCardPlacement()
    presentPlay(enc, played.encounter, placed)
    return undefined
  }

  landedRef.current = () => {
    const session = sessionRef.current
    if (session.queue.length > 0) return
    const finalEnc = session.pending ?? session.encounter
    if (session.seal && actionSpent(finalEnc)) {
      session.seal = false
      session.pending = null
      session.buried = false
      session.queue = []
      session.encounter = finalEnc
      session.mode = 'play'
      setMode('play')
      onEncounterRef.current(finalEnc)
      stageArrivals(finalEnc, endEncounterTurn(finalEnc))
      return
    }
    if (!session.pending && !session.buried && session.mode === 'play') return
    const wasEnemy = session.mode === 'enemy'
    session.pending = null
    session.buried = false
    session.queue = []
    session.encounter = finalEnc
    session.mode = 'play'
    setMode('play')
    onEncounterRef.current(finalEnc)
    reveal(finalEnc)
    if (!wasEnemy) return
    returnTimer.current = window.setTimeout(() => {
      playCameraTransition('down')
      useInteractionStore.getState().setCameraMode('board')
    }, HAND_VIEW_RETURN_MS)
  }

  api.current = {
    allows: (instanceId, cellId) => {
      const session = sessionRef.current
      const match = session.encounter.match
      if (session.seal || session.mode !== 'play' || match.over || match.phase !== 'playerAction' || match.pendingChoice) return false
      const choice = readPlayChoice(match.battle, instanceId)
      if (choice.blocked || choice.placement !== 'cell') return false
      if (choice.from === 'board' && choice.targets.length > 0 && session.targets.length === 0) return false
      return inspectPlay(match.battle, {
        instanceId,
        cell: ruleCell(cellId),
        choice: session.targets.length ? { targets: session.targets } : undefined,
      }) === null
    },
    picks: (cellId) => {
      const session = sessionRef.current
      const match = session.encounter.match
      const selected = useInteractionStore.getState().selectedCardInstanceId
      if (session.seal || session.mode !== 'play' || !selected || match.over || match.phase !== 'playerAction' || match.pendingChoice) return false
      const choice = readPlayChoice(match.battle, selected)
      if (choice.from !== 'board') return false
      const occupant = match.battle.cells[ruleCell(cellId)]
      return Boolean(occupant && choice.targets.some((target) => target.instanceId === occupant))
    },
    answers: (cellId) => {
      const enc = sessionRef.current.encounter
      if (enc.match.over || !enc.match.pendingChoice) return false
      const cell = ruleCell(cellId)
      return Boolean(snapshotEncounter(enc).legalTargets?.some((target) => target.cell === cell))
    },
    play: (action) => {
      const session = sessionRef.current
      const enc = session.encounter
      if (session.seal || session.mode !== 'play' || enc.match.over || enc.match.phase !== 'playerAction' || enc.match.pendingChoice) {
        return 'busy'
      }
      const cell = ruleCell(action.cellId)
      const occupant = enc.match.battle.cells[cell]
      if (occupant && session.targets.includes(occupant)) {
        session.targets = session.targets.filter((id) => id !== occupant)
        useBattleCue.getState().bump(session.targets)
        return 'choose'
      }
      const choice = readPlayChoice(enc.match.battle, action.cardInstanceId)
      const step = actOnCell({
        instanceId: action.cardInstanceId,
        choice,
        selected: session.targets,
        cell,
        occupantId: occupant,
      })
      if (step.kind === 'choose') {
        session.targets = step.targetIds
        useBattleCue.getState().bump(session.targets)
        return 'choose'
      }
      return release(enc, step, choice.placement === 'cell' ? action : undefined)
    },
    land: () => {
      const session = sessionRef.current
      const arrived = session.queue[0]
      if (!arrived) return
      session.queue = session.queue.slice(1)
      const after = session.pending?.match.battle ?? session.encounter.match.battle
      const next = session.queue[0]
      show({
        battle: after,
        faces: [after, session.encounter.match.battle],
        hidden: new Set(session.queue.map((item) => item.instanceId)),
        turn: 'monster',
        over: false,
        winner: null,
        telegraph: next ? arrivalTelegraph(after, next, true) : undefined,
        activePlacement: {
          side: 'monster',
          cardInstanceId: arrived.instanceId,
          cellId: sceneCell(arrived.cell),
        },
      })
      if (next && useInteractionStore.getState().cameraMode === 'overview') {
        useInteractionStore.getState().setCameraMode('board')
      }
    },
    answer: (cellId) => {
      const enc = sessionRef.current.encounter
      const cell = ruleCell(cellId)
      const target = snapshotEncounter(enc).legalTargets?.find((item) => item.cell === cell)
      if (!target) return
      presentPlay(enc, answerEncounterChoice(enc, target.instanceId))
    },
    commit: (instanceId) => {
      const session = sessionRef.current
      const enc = session.encounter
      if (session.seal || session.mode !== 'play' || enc.match.over || enc.match.phase !== 'playerAction' || enc.match.pendingChoice) return
      const choice = readPlayChoice(enc.match.battle, instanceId)
      if (choice.placement !== 'confirm' || choice.blocked || choice.targets.length > 0) return
      release(enc, actOnConfirm({ instanceId, choice, selected: [] }))
    },
  }

  useLayoutEffect(() => {
    clearPresentedCards()
    const enc = sessionRef.current.encounter
    const lays = openingLay(enc.match.battle)
    if (lays.length === 0) {
      sessionRef.current.mode = 'play'
      setMode('play')
      reveal(enc)
    } else {
      sessionRef.current.queue = lays
      sessionRef.current.mode = 'wait'
      setMode('wait')
      show({
        battle: enc.match.battle,
        faces: [enc.match.battle],
        hidden: new Set(lays.map((item) => item.instanceId)),
        turn: 'monster',
        over: false,
        winner: null,
        telegraph: arrivalTelegraph(enc.match.battle, lays[0], false),
      })
      layTimer.current = window.setTimeout(() => {
        const first = sessionRef.current.queue[0]
        if (!first || sessionRef.current.mode !== 'wait') return
        sessionRef.current.mode = 'lay'
        setMode('lay')
        show({
          battle: enc.match.battle,
          faces: [enc.match.battle],
          hidden: new Set(sessionRef.current.queue.map((item) => item.instanceId)),
          turn: 'monster',
          over: false,
          winner: null,
          telegraph: arrivalTelegraph(enc.match.battle, first, true),
        })
      }, LAY_DELAY_MS)
    }
    useBattleCue.getState().bind({
      allows: (instanceId, cell) => api.current.allows(instanceId, cell),
      picks: (cell) => api.current.picks(cell),
      answers: (cell) => api.current.answers(cell),
      play: (action) => api.current.play(action),
      land: () => api.current.land(),
      answer: (cell) => api.current.answer(cell),
      commit: (instanceId) => api.current.commit(instanceId),
    })
    return () => {
      window.clearTimeout(layTimer.current)
      window.clearTimeout(returnTimer.current)
      useBattleCue.getState().clear()
      clearPresentedCards()
      usePresentationStore.getState().setInputLocked(false)
      useInteractionStore.getState().resetBattleView()
      useGameStore.getState().abandon()
    }
  }, [])

  useEffect(() => useGameStore.subscribe((state, previous) => {
    if (!useBattleCue.getState().bound) return
    if (!previous.activePlacement || state.activePlacement) return
    landedRef.current()
  }), [])

  useEffect(() => {
    sessionRef.current.targets = []
    if (useBattleCue.getState().bound) useBattleCue.getState().bump([])
  }, [selectedId])

  useEffect(() => {
    if (!placementNotice) return
    const timer = window.setTimeout(() => showPlacementNotice(undefined), 2400)
    return () => window.clearTimeout(timer)
  }, [placementNotice, showPlacementNotice])

  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 8) return
      const target = event.target
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) return
      const match = useGameStore.getState().match
      if (!match || match.status !== 'playing' || match.turn !== 'player' || match.openingTurn) return
      const interaction = useInteractionStore.getState()
      const forward = event.deltaY < 0
      if (forward && interaction.cameraMode !== 'overview') {
        playCameraTransition('up')
        interaction.setCameraMode('overview')
        event.preventDefault()
      }
      if (!forward && interaction.cameraMode === 'overview') {
        playCameraTransition('down')
        interaction.finishCardPlacement()
        interaction.setCameraMode('board')
        event.preventDefault()
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
      const match = useGameStore.getState().match
      if (!match || match.status !== 'playing') return
      event.preventDefault()
      const interaction = useInteractionStore.getState()
      const entering = interaction.cameraMode !== 'overview'
      playCameraTransition(entering ? 'up' : 'down')
      if (!entering) interaction.finishCardPlacement()
      interaction.setCameraMode(entering ? 'overview' : 'board')
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const live = sessionRef.current.encounter
  const view = snapshotEncounter(encounter)
  const choice = selectedId && mode === 'play' ? readPlayChoice(encounter.match.battle, selectedId) : null
  const choosing = Boolean(view.legalTargets?.length) && !encounter.match.over
  const canAct = mode === 'play' && !encounter.match.over && encounter.match.phase === 'playerAction' && !choosing
  const playerScore = projected ? getBoardPower(projected, 'player') : view.points.player
  const enemyScore = projected ? getBoardPower(projected, 'monster') : view.points.enemy
  const finished = encounter.match.over && !placing && mode === 'play'
  const winner = encounter.match.winner

  const finishTurn = () => {
    const enc = sessionRef.current.encounter
    if (sessionRef.current.mode !== 'play' || enc.match.over || enc.match.phase !== 'playerAction' || enc.match.pendingChoice) return
    sessionRef.current.seal = false
    useInteractionStore.getState().finishCardPlacement()
    stageArrivals(enc, endEncounterTurn(enc))
  }

  const toggleDeck = (instanceId: string, limit: number) => {
    const enc = sessionRef.current.encounter
    const selected = useInteractionStore.getState().selectedCardInstanceId
    const next = togglePlayTargets(sessionRef.current.targets, instanceId, limit)
    sessionRef.current.targets = next
    useBattleCue.getState().bump(next)
    if (!selected || !canAct) return
    const deckChoice = readPlayChoice(enc.match.battle, selected)
    if (deckChoice.placement !== 'confirm' || deckChoice.limit <= 0 || next.length < deckChoice.limit) return
    release(enc, actOnConfirm({ instanceId: selected, choice: deckChoice, selected: next }))
  }

  const answerTarget = (instanceId: string) => {
    const enc = sessionRef.current.encounter
    presentPlay(enc, answerEncounterChoice(enc, instanceId))
  }

  const leave = () => {
    if (leaving || (winner !== 'player' && winner !== 'enemy')) return
    setLeaving(true)
    onLeave(winner)
  }

  return (
    <main className="app-shell v6-battle-stage">
      <div className="scene-layer">
        <GameCanvas monster={stage.monster} scene={stage.scene} />
      </div>
      {projected?.status === 'playing' && (
        <aside className="view-hint">
          <span className="view-hint__mark" aria-hidden="true" />
          <span>滚轮向前 俯视</span>
          <span>滚轮向后 手牌</span>
        </aside>
      )}
      <section className="battle-status" aria-live="polite">
        <div className="battle-status__score">
          <span>{playerScore}</span>
          <span>—</span>
          <span>{enemyScore}</span>
        </div>
        <div className="battle-status__meta">
          <span>{title}</span>
          <span>{statusLabel(projected?.status, projected?.turn, mode)}</span>
          {view.intent ? <span>下一张 {view.intent.name}</span> : null}
          <span>牌组 {projected?.player.deck.length ?? live.match.battle.deck.length}</span>
          <span>弃牌 {projected?.graveyard.length ?? live.match.battle.discard.length}</span>
          {live.match.battle.faith.player > 0 ? <span>信仰 {live.match.battle.faith.player}</span> : null}
        </div>
      </section>
      {placementNotice ? <div className="placement-notice" role="status">{placementNotice}</div> : null}
      {choosing ? (
        <div className="v6-stage-banner" role="status">
          <p>{pauseText(encounter.match.phase, view.choiceSource?.name ?? '这一张牌')}</p>
          <div className="v6-stage-picks">
            {view.legalTargets?.map((target) => (
              <button key={target.instanceId} type="button" onClick={() => answerTarget(target.instanceId)}>
                {target.name} · 第 {target.cell} 格
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {choice && choice.from === 'deck' && choice.targets.length > 0 ? (
        <div className="v6-stage-picks" role="group" aria-label="牌组目标">
          {choice.targets.map((target) => (
            <button
              key={target.instanceId}
              type="button"
              aria-pressed={picks.includes(target.instanceId)}
              onClick={() => toggleDeck(target.instanceId, choice.limit)}
            >
              {target.name} · 基础点数 {target.basePoints ?? 0}
            </button>
          ))}
        </div>
      ) : null}
      <div className="v6-stage-actions">
        <p className="v6-stage-hint">{hint(canAct, choosing, Boolean(selectedId), choice, picks.length)}</p>
        <button type="button" disabled={!canAct} onClick={finishTurn}>结束回合</button>
      </div>
      {finished ? (
        <div className="match-result" role="dialog" aria-modal="true" aria-label="对局结果">
          <div className="match-result__panel">
            <strong>{winner === 'player' ? '你赢了' : winner === 'enemy' ? '对方赢了' : '战斗结束'}</strong>
            <span>YOU {playerScore} — {enemyScore} {title}</span>
            {winner === 'player' && announceArrival ? <span>{ARRIVAL_COPY}</span> : null}
            <button type="button" disabled={leaving || (winner !== 'player' && winner !== 'enemy')} onClick={leave}>
              {winner === 'player' ? '查看奖励' : '回到地图'}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  )
}

function needsChoice(enc: Encounter) {
  return Boolean(snapshotEncounter(enc).legalTargets?.length) && !enc.match.over
}

/** The action has no play left, so the turn can close on its own. */
function actionSpent(enc: Encounter) {
  const match = enc.match
  return !match.over && !match.pendingChoice && match.phase === 'playerAction' && match.playsRemaining <= 0
}

function previewTelegraph(preview: IntentPreview): MonsterTelegraph {
  return {
    card: {
      instanceId: preview.instanceId,
      cardId: preview.instanceId,
      owner: 'monster',
      currentPower: preview.power,
    },
  }
}

function statusLabel(
  status: 'playing' | 'finished' | undefined,
  turn: 'player' | 'monster' | undefined,
  mode: Mode,
) {
  if (status === 'finished') return '结束'
  if (mode === 'wait' || mode === 'lay') return '铺场'
  if (turn === 'monster' || mode === 'enemy') return '对方回合'
  return '你的回合'
}

function pauseText(phase: string, name: string): string {
  if (phase === 'playerTurnStart') return `${name} 的回合开始效果要选一个目标`
  if (phase === 'playerTurnEnd') return `${name} 的回合结束效果要选一个目标`
  return `${name} 要选一个目标`
}

function hint(
  canAct: boolean,
  choosingTarget: boolean,
  selected: boolean,
  choice: PlayChoiceView | null,
  picked: number,
): string {
  if (choosingTarget) return '先点一个目标'
  if (!canAct) return '点牌组可以翻开预览'
  if (!selected || !choice) return '点一张手牌，再点格子'
  if (choice.blocked) return '这张法术没有合法目标'
  if (choice.skipped && choice.placement === 'cell') return '没有可指向的目标，直接点格子'
  if (choice.skipped) return '没有可检索的牌，点这张手牌就会打出'
  if (choice.from === 'deck' && picked === 0) return '从牌组点一张牌'
  if (choice.from === 'board' && picked === 0) {
    return choice.placement === 'confirm' ? '点场上的那张牌' : '先点场上的合法牌，再点格子'
  }
  if (choice.limit > 1 && picked < choice.limit) return `已选 ${picked} 张，还可以再点，或点格子放入`
  if (choice.placement === 'confirm') return '点选目标后就会打出'
  return '再点一个格子放入'
}

function failureText(reason: string): string {
  if (reason === 'no-plays') return '这一回合已经出过牌'
  if (reason === 'occupied-by-ally') return '不能盖住自己的牌'
  if (reason === 'occupied-by-higher' || reason === 'below-threshold') return '点数不够，盖不住这一格'
  if (reason === 'illegal-cell' || reason === 'missing-cell') return '这一格放不了'
  if (reason === 'no-target') return '还没有目标'
  return '这张牌没有打出'
}
