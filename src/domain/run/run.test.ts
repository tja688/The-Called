import { describe, expect, it } from 'vitest'
import { RunAggregate } from './RunAggregate'
import { GameService } from '../../application/GameService'

describe('RunAggregate', () => {
  it('线性四节点，不能跳', () => {
    const { aggregate: r } = RunAggregate.start(1)
    expect(r.availableNodes()).toEqual(['yuZhuang'])
    expect(() => r.enterNode('boShou')).toThrow()
  })

  it('牌组不能编成 0', () => {
    const { aggregate: r } = RunAggregate.start(1)
    expect(() => r.setDeck([])).toThrow()
  })

  it('普通战败扣 10，节点仍在', () => {
    const { aggregate: r } = RunAggregate.start(1)
    r.enterNode('yuZhuang')
    const ev = r.applyBattleResult({ outcome: 'lose', reason: 'noPlay', wound: 10 })
    expect(r.state.hp).toBe(20)
    expect(r.state.screen).toBe('map')
    expect(r.availableNodes()).toEqual(['yuZhuang'])
    expect(ev.some((e) => e.type === 'run.ended')).toBe(false)
  })

  it('守门离场整趟失败，不扣血', () => {
    const { aggregate: r } = RunAggregate.start(1)
    r.state.progress = 3
    r.enterNode('shouMen')
    r.applyBattleResult({ outcome: 'lose', reason: 'avatarGone', wound: 10 })
    expect(r.state.ended).toBe('defeat')
    expect(r.state.hp).toBe(30)
  })

  it('战后伤口按化身掉点扣', () => {
    const { aggregate: r } = RunAggregate.start(1)
    r.enterNode('yuZhuang')
    r.applyBattleResult({ outcome: 'win', reason: 'lead', wound: 3 })
    expect(r.state.hp).toBe(27)
    expect(r.state.screen).toBe('reward')
    expect(r.state.pendingReward?.length).toBe(3)
  })

  it('夹层只对剥手 +1 抽', () => {
    const { aggregate: r } = RunAggregate.start(1)
    r.enterNode('yuZhuang')
    r.applyBattleResult({ outcome: 'win', reason: 'lead', wound: 0 })
    r.rewardPick(r.state.pendingReward![0])
    r.returnToMap()
    r.enterNode('drawer')
    r.eventOption(2)
    r.returnToMap()
    r.enterNode('boShou')
    const setup = r.battleSetup()
    expect(setup.handDelta).toBe(1)
    expect(r.state.extraDraw).toBe(0)
  })

  it('奖励进卡盒不进牌组，已获 ID 不再出现', () => {
    const { aggregate: r } = RunAggregate.start(1)
    r.enterNode('yuZhuang')
    r.applyBattleResult({ outcome: 'win', reason: 'lead', wound: 0 })
    const first = r.state.pendingReward![0]
    const deckBefore = [...r.state.deck]
    r.rewardPick(first)
    expect(r.state.box).toContain(first)
    expect(r.state.deck).toEqual(deckBefore)
    r.returnToMap()
    r.enterNode('drawer')
    r.eventOption(0)
    expect(r.state.box).toContain('EV01')
    expect(r.state.deck).not.toContain('EV01')
  })
})

describe('GameService 战败回地图', () => {
  it('一套钉打光未领先则扣 10，节点可再进', async () => {
    const game = new GameService()
    await game.dispatch({ type: 'run.start', seed: 1 })
    await game.dispatch({ type: 'run.setDeck', deck: ['P01'] })
    await game.dispatch({ type: 'run.enterNode', node: 'yuZhuang' })
    const hand = game.ask({ type: 'battle.view' })!.hand
    const inspect = (id: string) => game.ask({ type: 'battle.inspect', card: id })
    const avatar = hand.find((id) => inspect(id)?.isAvatar)!
    await game.dispatch({ type: 'battle.play', card: avatar, cell: 7 })
    const occupy = game.ask({ type: 'battle.view' })!.hand.find((id) => !inspect(id)?.isAvatar)
    if (occupy) await game.dispatch({ type: 'battle.play', card: occupy, cell: 3 })
    await game.dispatch({ type: 'battle.endTurn' })
    if (!game.ask({ type: 'battle.view' })?.result) {
      await game.dispatch({ type: 'battle.endTurn' })
    }
    expect(game.ask({ type: 'battle.view' })?.result?.outcome).toBe('lose')
    await game.dispatch({ type: 'run.finishFlow' })
    const run = game.ask({ type: 'run.view' })!
    expect(run.hp).toBe(20)
    expect(run.availableNodes).toEqual(['yuZhuang'])
    expect(run.ended).toBeUndefined()
  })
})
