import type { Query } from '../core/messages'
import type { Cell } from '../domain/geometry'
import type { CardDef } from '../content/cards'
import type { LegalPlay } from '../domain/battle/BattleAggregate'
import type { BattleView } from './readmodels/BattleView'
import type { RunView } from './readmodels/RunView'

export type InspectView = {
  defId: string
  name: string
  basePoints: number
  currentPoints: number
  statuses: string[]
  isAvatar: boolean
  owner: string
  zone: string
  cell?: number
} | null

export interface QueryResults {
  'run.view': RunView | null
  'battle.view': BattleView | null
  'battle.legalPlays': LegalPlay[]
  'battle.legalActivates': { card: string; targets: string[] }[]
  'battle.previewPlay': import('../domain/battle/BattleAggregate').PreviewPlay | null
  'battle.inspect': InspectView
  'content.card': CardDef
}

export type GameQuery =
  | Query<'run.view'>
  | Query<'battle.view'>
  | Query<'battle.legalPlays'>
  | Query<'battle.legalActivates'>
  | (Query<'battle.previewPlay'> & { card: string; cell?: Cell; target?: string; target2?: string })
  | (Query<'battle.inspect'> & { card: string })
  | (Query<'content.card'> & { defId: string })

export type QueryResultOf<Q extends GameQuery> = QueryResults[Q['type']]
