import type { DomainEvent } from '../../core/messages'
import type { Timing } from '../effects'
import type { BattleOutcome, BattlePhase, CardKind, CardStatus, RemoveReason, RemoveTo, SettleReason } from '../types'
import type { Cell } from '../geometry'

export type PointsSource =
  | 'cover'
  | 'enter'
  | 'play'
  | 'leave'
  | 'turnStart'
  | 'turnEnd'
  | 'timer'
  | 'active'
  | 'onCover'
  | 'aura'
  | 'map'
  | 'relic'
  | 'lock'
  | 'stack'

/** 这一下是谁、在什么时机、用哪条 op 打出来的。展示名由表现层查表。 */
export interface Cause {
  actor: string
  defId: string
  timing: Timing
  op: string
}

export interface AuraShare {
  card: string
  defId: string
  n: number
}

export interface TimerLeft {
  card: string
  defId: string
  left: number
}

export type BattleEvent =
  | (DomainEvent<'battle.started'> & {
      encounterId: string
      setup: { cell: Cell; defId: string; current: number }[]
      text: string
    })
  | (DomainEvent<'battle.avatarDealt'> & { card: string; defId: string; deckLeft: number; text: string })
  | (DomainEvent<'battle.cardDrawn'> & { card: string; defId: string; deckLeft: number; text: string })
  | (DomainEvent<'battle.turnStarted'> & {
      turn: number
      opening: boolean
      leading: boolean
      won: boolean
      timers: TimerLeft[]
      text: string
    })
  | (DomainEvent<'battle.phaseChanged'> & { phase: BattlePhase; text: string })
  | (DomainEvent<'battle.occupyChanged'> & { current: number; cap: number; cause?: Cause; text: string })
  | (DomainEvent<'battle.resourceChanged'> & { resource: 'RES.A'; current: number; cause?: Cause; text: string })
  | (DomainEvent<'battle.cardPlayed'> & { card: string; defId: string; kind: CardKind; cell?: Cell; text: string })
  | (DomainEvent<'battle.cardCovered'> & { victim: string; by: string; cell: Cell; victimPoints: number; tied?: boolean; text: string })
  | (DomainEvent<'battle.cardEntered'> & {
      card: string
      cell: Cell
      covered: boolean
      motion: 'place' | 'move'
      from?: Cell
      cause?: Cause
      text: string
    })
  | (DomainEvent<'battle.cardRemoved'> & {
      card: string
      defId: string
      cell: Cell
      to: RemoveTo
      reason: RemoveReason
      cause?: Cause
      text: string
    })
  | (DomainEvent<'battle.pointsChanged'> & {
      card: string
      before: number
      after: number
      source: PointsSource
      cause?: Cause
      /** 本次因易伤多减的点数。没有则为 0。 */
      vulnerableBonus?: number
      /** 变化之后的驻场贡献。净变化仍是 before → after。 */
      auras?: AuraShare[]
      mapEffect?: string
      text: string
    })
  | (DomainEvent<'battle.statusAdded'> & { card: string; status: CardStatus; cause?: Cause; text: string })
  | (DomainEvent<'battle.statusRemoved'> & { card: string; status: CardStatus; cause?: Cause; text: string })
  | (DomainEvent<'battle.effectResolved'> & {
      card: string
      defId: string
      timing: string
      cell?: Cell
      /** 本时机至少有一条带同一 actor 的后果。 */
      hit: boolean
      text: string
    })
  | (DomainEvent<'battle.activated'> & { card: string; defId: string; text: string })
  | (DomainEvent<'battle.settled'> & {
      outcome: BattleOutcome
      reason: SettleReason
      avatarCost: number
      text: string
    })
