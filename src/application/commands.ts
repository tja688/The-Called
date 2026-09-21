import type { Command } from '../core/messages'
import type { Cell } from '../domain/geometry'
import type { DeckId } from '../domain/types'

/** 全部命令。UI 只能通过这些改变游戏状态。 */
export type GameCommand =
  | (Command<'run.start'> & { seed?: number; deckId: DeckId })
  | Command<'run.abandon'>
  | (Command<'run.enterNode'> & { node: string })
  | (Command<'run.setDeck'> & { deck: string[] })
  | (Command<'run.eventOption'> & { index: 0 | 1 | 2; cardUid?: string; cardUid2?: string })
  | (Command<'run.rewardPick'> & { cardId: string })
  | Command<'run.finishFlow'>
  | (Command<'run.shopBuyCard'> & { index: number })
  | (Command<'run.shopCopy'> & { uid: string })
  | Command<'run.shopBuyRelic'>
  | (Command<'run.restPick'> & { choice: 'heal' | 'grow' })
  | (Command<'run.forgeBuff'> & { uid: string })
  | (Command<'run.forgeRecast'> & { uid: string })
  | (Command<'battle.play'> & { card: string; cell?: Cell; target?: string; target2?: string })
  | Command<'battle.endTurn'>
  | (Command<'battle.activate'> & { card: string; target?: string })

export type CommandOf<T extends GameCommand['type']> = Extract<GameCommand, { type: T }>
