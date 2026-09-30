import { describe, expect, it } from 'vitest'
import { FORK_MONSTERS, createSession, moveTo } from '../../map'
import { arriveAt, toMapView } from './viewModel'

describe('地图视图', () => {
  it('开局四处都看得见，三场战斗都能走进去', () => {
    const view = toMapView(createSession())
    expect(view.places.map((place) => place.sight).sort()).toEqual(['here', 'open', 'open', 'open'])
    expect(view.places.find((place) => place.sight === 'here')).toMatchObject({
      id: 'start',
      title: '起点',
      mark: 'start',
    })
    expect(view.action).toEqual({ type: 'idle' })
    expect(view.arrival).toBeNull()
    for (const monster of FORK_MONSTERS) {
      const place = view.places.find((item) => item.id === monster.nodeId)
      expect(place).toMatchObject({ sight: 'open', title: monster.title, mark: monster.monsterId })
    }
  })

  it('走到一支就开战，走回起点再去另一支', () => {
    const first = arriveAt(createSession(), FORK_MONSTERS[0].nodeId)
    expect(first.type).toBe('enter')
    if (first.type !== 'enter') return
    expect(first.monsterId).toBe('monster.001')
    const back = arriveAt(first.session, 'start')
    expect(back.type).toBe('idle')
    if (back.type !== 'idle') return
    const second = arriveAt(back.session, FORK_MONSTERS[2].nodeId)
    expect(second).toMatchObject({ type: 'enter', monsterId: 'monster.003' })
  })

  it('站在战斗节点上，当前动作仍是再战', () => {
    const stood = moveTo(createSession(), FORK_MONSTERS[1].nodeId)
    expect(toMapView(stood).action).toEqual({
      type: 'enter',
      monsterId: 'monster.002',
      nodeId: FORK_MONSTERS[1].nodeId,
    })
    const seen = toMapView(stood).places.filter((place) => place.sight === 'seen')
    expect(seen.map((place) => place.id).sort()).toEqual([
      FORK_MONSTERS[0].nodeId,
      FORK_MONSTERS[2].nodeId,
    ])
  })
})
