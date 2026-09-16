import type { BattleEvent } from '../domain/battle/events'
import type { RunEvent } from '../domain/run/events'

export type GameEvent = RunEvent | BattleEvent
export type { BattleEvent, RunEvent }
