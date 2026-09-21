import type { DomainEvent } from '../../core/messages'
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
  | 'aura'
  | 'map'
  | 'relic'
  | 'lock'
  | 'stack'

export type BattleEvent =
  | (DomainEvent<'battle.started'> & {
      encounterId: string
      setup: { cell: Cell; defId: string; current: number }[]
      text: string
    })
  | (DomainEvent<'battle.avatarDealt'> & { card: string; defId: string; deckLeft: number; text: string })
  | (DomainEvent<'battle.cardDrawn'> & { card: string; defId: string; deckLeft: number; text: string })
  | (DomainEvent<'battle.turnStarted'> & { turn: number; opening: boolean; leading: boolean; won: boolean; text: string })
  | (DomainEvent<'battle.phaseChanged'> & { phase: BattlePhase; text: string })
  | (DomainEvent<'battle.occupyChanged'> & { current: number; cap: number; text: string })
  | (DomainEvent<'battle.resourceChanged'> & { resource: 'RES.A'; current: number; text: string })
  | (DomainEvent<'battle.cardPlayed'> & { card: string; defId: string; kind: CardKind; cell?: Cell; text: string })
  | (DomainEvent<'battle.cardCovered'> & { victim: string; by: string; cell: Cell; victimPoints: number; tied?: boolean; text: string })
  | (DomainEvent<'battle.cardEntered'> & { card: string; cell: Cell; covered: boolean; text: string })
  | (DomainEvent<'battle.cardRemoved'> & {
      card: string
      defId: string
      cell: Cell
      to: RemoveTo
      reason: RemoveReason
      text: string
    })
  | (DomainEvent<'battle.pointsChanged'> & { card: string; before: number; after: number; source: PointsSource; text: string })
  | (DomainEvent<'battle.statusAdded'> & { card: string; status: CardStatus; text: string })
  | (DomainEvent<'battle.statusRemoved'> & { card: string; status: CardStatus; text: string })
  | (DomainEvent<'battle.effectResolved'> & { card: string; defId: string; timing: string; cell?: Cell; text: string })
  | (DomainEvent<'battle.activated'> & { card: string; defId: string; text: string })
  | (DomainEvent<'battle.settled'> & {
      outcome: BattleOutcome
      reason: SettleReason
      avatarCost: number
      text: string
    })
