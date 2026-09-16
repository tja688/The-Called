import type { Command } from '../core/messages'
import type { Cell } from '../domain/geometry'
import type { NodeId } from '../domain/types'

/** 全部命令。UI 只能通过这些改变游戏状态。 */
export type GameCommand =
  | (Command<'run.start'> & { seed?: number })
  | Command<'run.abandon'>
  | (Command<'run.enterNode'> & { node: NodeId })
  | (Command<'run.setDeck'> & { deck: string[] })
  | (Command<'run.eventOption'> & { index: 0 | 1 | 2 })
  | (Command<'run.rewardPick'> & { cardId: string })
  | Command<'run.finishFlow'>
  | (Command<'battle.play'> & { card: string; cell?: Cell; target?: string })
  | Command<'battle.endTurn'>

export type CommandOf<T extends GameCommand['type']> = Extract<GameCommand, { type: T }>
