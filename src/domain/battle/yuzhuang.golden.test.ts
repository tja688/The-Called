import { describe, expect, it } from 'vitest'
import { currentPoints, finalPoints } from './points'
import { avatar, playDef, startBattle } from '../../test/helpers'

describe('余桩黄金手顺', () => {
  it('化身格7 → 余温重心 → 楔8钉4 → 第三回合开始赢', () => {
    const { aggregate: b } = startBattle('yuZhuang')
    expect(finalPoints(b.state, 'enemy')).toBe(17)
    expect(b.mustPlaceAvatar()).toBe(true)

    playDef(b, 'AVATAR', 7)
    expect(currentPoints(b.state, avatar(b))).toBe(11)
    expect(b.state.mana).toBe(1)
    expect(b.state.manaCap).toBe(1)

    playDef(b, 'P05', undefined, 'E1B')
    expect(currentPoints(b.state, Object.values(b.state.cards).find((c) => c.defId === 'E1B')!)).toBe(5)
    expect(finalPoints(b.state, 'player')).toBe(11)
    expect(finalPoints(b.state, 'enemy')).toBe(15)

    b.playerEndTurn()
    expect(b.state.result).toBeUndefined()
    expect(currentPoints(b.state, avatar(b))).toBe(11)
    expect(b.state.turn).toBe(2)
    expect(b.state.opening).toBe(false)

    playDef(b, 'P02', 8)
    playDef(b, 'P01', 4)
    expect(finalPoints(b.state, 'player')).toBeGreaterThan(17)
    b.playerEndTurn()

    expect(b.state.result).toMatchObject({ outcome: 'win', reason: 'lead' })
    expect(b.state.result!.wound).toBe(0)
  })
})
