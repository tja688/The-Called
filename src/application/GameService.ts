import { CommandBus } from '../core/CommandBus'
import { QueryBus } from '../core/QueryBus'
import { EventBus } from '../core/EventBus'
import { EventStore } from '../core/EventStore'
import { hashString } from '../core/Rng'
import type { DomainEvent } from '../core/messages'
import { content } from '../content'
import { BattleAggregate } from '../domain/battle/BattleAggregate'
import { RunAggregate } from '../domain/run/RunAggregate'
import type { RunEvent } from '../domain/run/events'
import { toBattleView } from './readmodels/BattleView'
import { toRunView } from './readmodels/RunView'
import type { GameCommand, CommandOf } from './commands'
import type { GameQuery, QueryResultOf, QueryResults } from './queries'

/**
 * 深模块：外面只看见 dispatch / ask / on。
 * 覆盖、占领费用、化身代价、总点数全部藏在聚合里。压迫与领先撑一轮已退役。
 */
export class GameService {
  readonly commands = new CommandBus()
  readonly queries = new QueryBus()
  readonly events = new EventBus()
  readonly store = new EventStore()
  private run?: RunAggregate
  private battle?: BattleAggregate

  constructor() {
    content()
    this.registerCommands()
    this.registerQueries()
  }

  async dispatch(command: GameCommand): Promise<DomainEvent[]> {
    return this.commands.dispatch(command)
  }

  ask<Q extends GameQuery>(query: Q): QueryResultOf<Q> {
    return this.queries.ask(query) as QueryResultOf<Q>
  }

  on(type: '*' | DomainEvent['type'], listener: (e: DomainEvent) => void): () => void {
    return this.events.on(type, listener)
  }

  private publish(events: DomainEvent[], stream: 'run' | 'battle'): DomainEvent[] {
    const stamped = this.store.append(events, stream)
    this.events.publishAll(stamped)
    return stamped
  }

  private publishRun(events: RunEvent[]): DomainEvent[] {
    const out = this.publish(events, 'run')
    const queued = events.find((e) => e.type === 'run.battleQueued')
    if (queued && queued.type === 'run.battleQueued' && this.run) {
      const setup = this.run.battleSetup()
      const started = BattleAggregate.start({
        encounterId: setup.encounterId,
        deck: setup.deck,
        seed: setup.seed,
        avatarDefId: setup.avatarDefId,
        avatarBase: setup.avatarBase,
        mapEffect: setup.mapEffect,
        relicFirstOccupy: setup.relicFirstOccupy,
      })
      this.battle = started.aggregate
      out.push(...this.publish(started.events, 'battle'))
    }
    return out
  }

  private onCmd<T extends GameCommand['type']>(type: T, handler: (c: CommandOf<T>) => DomainEvent[]): void {
    this.commands.register(type, handler as (c: GameCommand) => DomainEvent[])
  }

  private registerCommands(): void {
    const needRun = () => {
      if (!this.run) throw new Error('还没开一趟')
      return this.run
    }
    const needBattle = () => {
      if (!this.battle) throw new Error('没有进行中的战斗')
      return this.battle
    }

    this.onCmd('run.start', (c) => {
      if (!c.deckId) throw new Error('必须选择初始牌组')
      const seed = c.seed ?? (Date.now() >>> 0) ^ hashString('called')
      const { aggregate, events } = RunAggregate.start(seed, c.deckId)
      this.run = aggregate
      this.battle = undefined
      this.store.clear()
      return this.publishRun(events)
    })
    this.onCmd('run.abandon', () => {
      const ev = needRun().abandon()
      this.battle = undefined
      return this.publishRun(ev)
    })
    this.onCmd('run.enterNode', (c) => this.publishRun(needRun().enterNode(c.node)))
    this.onCmd('run.setDeck', (c) => this.publishRun(needRun().setDeck(c.deck)))
    this.onCmd('run.eventOption', (c) => this.publishRun(needRun().eventOption(c.index, c.cardUid, c.cardUid2)))
    this.onCmd('run.rewardPick', (c) => this.publishRun(needRun().rewardPick(c.cardId)))
    this.onCmd('run.shopBuyCard', (c) => this.publishRun(needRun().shopBuyCard(c.index)))
    this.onCmd('run.shopCopy', (c) => this.publishRun(needRun().shopCopy(c.uid)))
    this.onCmd('run.shopBuyRelic', () => this.publishRun(needRun().shopBuyRelic()))
    this.onCmd('run.restPick', (c) => this.publishRun(needRun().restPick(c.choice)))
    this.onCmd('run.forgeBuff', (c) => this.publishRun(needRun().forgeBuff(c.uid)))
    this.onCmd('run.forgeRecast', (c) => this.publishRun(needRun().forgeRecast(c.uid)))
    this.onCmd('run.finishFlow', () => {
      const run = needRun()
      if (run.state.screen === 'battle') {
        const b = needBattle()
        if (!b.state.result) throw new Error('战斗还没结束')
        const ev = run.applyBattleResult(b.state.result, {
          goldDelta: b.state.goldDelta,
          burnedUids: b.state.burnedUids,
        })
        this.battle = undefined
        return this.publishRun(ev)
      }
      return this.publishRun(run.returnToMap())
    })
    this.onCmd('battle.play', (c) => this.publish(needBattle().playerPlay(c.card, c.cell, c.target, c.target2), 'battle'))
    this.onCmd('battle.endTurn', () => this.publish(needBattle().playerEndTurn(), 'battle'))
    this.onCmd('battle.activate', (c) => this.publish(needBattle().playerActivate(c.card, c.target), 'battle'))
  }

  private askQ<T extends GameQuery['type']>(
    type: T,
    handler: (q: Extract<GameQuery, { type: T }>) => QueryResults[T],
  ): void {
    this.queries.register(type, handler as (q: GameQuery) => QueryResults[T])
  }

  private registerQueries(): void {
    this.askQ('run.view', () => (this.run ? toRunView(this.run.state, this.run.availableNodes()) : null))
    this.askQ('battle.view', () => {
      if (!this.battle) return null
      return toBattleView(
        this.battle.state,
        this.battle.mustPlaceAvatar(),
        this.battle.canEndTurn(),
        this.battle.canActivate(),
      )
    })
    this.askQ('battle.legalPlays', () => this.battle?.legalPlays() ?? [])
    this.askQ('battle.legalActivates', () => this.battle?.legalActivates() ?? [])
    this.askQ('battle.previewPlay', (q) => this.battle?.previewPlay(q.card, q.cell, q.target, q.target2) ?? null)
    this.askQ('battle.inspect', (q) => this.battle?.inspect(q.card) ?? null)
    this.askQ('content.card', (q) => content().card(q.defId))
  }
}
