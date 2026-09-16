import type { DomainEvent } from '../../core/messages'
import type { BattleOutcome, BattlePhase, CardKind, RemoveReason, RemoveTo, SettleReason } from '../types'
import type { Cell } from '../geometry'
import type { EncounterId } from '../types'

export type PointsSource =
  | 'cover'
  | 'enter'
  | 'spell'
  | 'pressure'
  | 'removed'
  | 'aura'
  | 'map'
  | 'lock'

export type BattleEvent =
  | (DomainEvent<'battle.started'> & {
      encounterId: EncounterId
      setup: { cell: Cell; defId: string; current: number }[]
      text: string
    })
  | (DomainEvent<'battle.avatarDealt'> & { card: string; defId: string; deckLeft: number; text: string })
  | (DomainEvent<'battle.cardDrawn'> & { card: string; defId: string; deckLeft: number; text: string })
  | (DomainEvent<'battle.turnStarted'> & { turn: number; opening: boolean; leading: boolean; won: boolean; text: string })
  | (DomainEvent<'battle.phaseChanged'> & { phase: BattlePhase; text: string })
  | (DomainEvent<'battle.manaChanged'> & { current: number; cap: number; text: string })
  | (DomainEvent<'battle.cardPlayed'> & { card: string; defId: string; kind: CardKind; cell?: Cell; text: string })
  | (DomainEvent<'battle.cardCovered'> & { victim: string; by: string; cell: Cell; victimPoints: number; text: string })
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
  | (DomainEvent<'battle.statusAdded'> & { card: string; status: 'sealed'; text: string })
  | (DomainEvent<'battle.statusRemoved'> & { card: string; status: 'sealed'; text: string })
  | (DomainEvent<'battle.pressureResolved'> & { cell: Cell; defId: string; kind: string; text: string })
  | (DomainEvent<'battle.leadChanged'> & { leading: boolean; text: string })
  | (DomainEvent<'battle.settled'> & { outcome: BattleOutcome; reason: SettleReason; wound: number; text: string })
