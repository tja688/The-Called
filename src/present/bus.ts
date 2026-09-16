import type { GameService } from '../application/GameService'
import type { GameCommand } from '../application/commands'
import type { GameQuery, QueryResultOf } from '../application/queries'

/** 表现层唯一允许穿过的读写口。 */
export function ask<Q extends GameQuery>(game: GameService, q: Q): QueryResultOf<Q> {
  return game.ask(q)
}

export function send(game: GameService, c: GameCommand): Promise<void> {
  return game.dispatch(c).then(() => undefined)
}
