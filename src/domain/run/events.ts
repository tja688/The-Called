import type { DomainEvent } from '../../core/messages'
import type { EncounterId, RunResult, Screen } from '../types'

export type RunEvent =
  | (DomainEvent<'run.started'> & { seed: number; hp: number; box: string[]; deck: string[]; text: string })
  | (DomainEvent<'run.hpChanged'> & { before: number; after: number; reason: string; text: string })
  | (DomainEvent<'run.cardBoxed'> & { cardId: string; text: string })
  | (DomainEvent<'run.deckChanged'> & { deck: string[]; text: string })
  | (DomainEvent<'run.battleQueued'> & { encounterId: EncounterId; text: string })
  | (DomainEvent<'run.rewardOffered'> & { pool: string[]; text: string })
  | (DomainEvent<'run.eventOffered'> & { eventId: string; text: string })
  | (DomainEvent<'run.screen'> & { screen: Screen; text: string })
  | (DomainEvent<'run.ended'> & { result: RunResult; text: string })
