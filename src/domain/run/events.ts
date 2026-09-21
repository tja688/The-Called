import type { DomainEvent } from '../../core/messages'
import type { DeckId, RunResult, Screen } from '../types'

export type RunEvent =
  | (DomainEvent<'run.started'> & {
      seed: number
      deckId: DeckId
      hp: number
      box: string[]
      deck: string[]
      floorEffect: string
      text: string
    })
  | (DomainEvent<'run.hpChanged'> & { before: number; after: number; reason: string; text: string })
  | (DomainEvent<'run.goldChanged'> & { before: number; after: number; reason: string; text: string })
  | (DomainEvent<'run.cardBoxed'> & { cardId: string; uid: string; text: string })
  | (DomainEvent<'run.cardUnboxed'> & { cardId: string; uid: string; text: string })
  | (DomainEvent<'run.deckChanged'> & { deck: string[]; text: string })
  | (DomainEvent<'run.relicGained'> & { relicId: string; text: string })
  | (DomainEvent<'run.battleQueued'> & { encounterId: string; node: string; text: string })
  | (DomainEvent<'run.rewardOffered'> & { pool: string[]; gold: number; text: string })
  | (DomainEvent<'run.eventOffered'> & { eventId: string; text: string })
  | (DomainEvent<'run.shopOffered'> & { cards: string[]; relicId?: string; text: string })
  | (DomainEvent<'run.screen'> & { screen: Screen; text: string })
  | (DomainEvent<'run.ended'> & { result: RunResult; text: string })
