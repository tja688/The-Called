import { describe, expect, it } from 'vitest'
import type { BattleEvent } from '../../domain/battle/events'
import { playDef, startBattle } from '../../test/helpers'
import { foldBattleLog, type LogLine } from './battleLog'

function dump(lines: LogLine[]): string {
  return lines.map((l) => [l.text, ...l.notes.map((n) => `  ${n}`)].join('\n')).join('\n')
}

describe('战报', () => {
  it('记下放置、印记、走位和抽牌，省掉阶段和空费用', () => {
    const { aggregate: b, events } = startBattle('MON.N01')
    const all: BattleEvent[] = [...events]
    all.push(...playDef(b, 'PC.A00', 9))
    all.push(...playDef(b, 'PC.A01', 2))
    all.push(...b.playerEndTurn())
    const text = dump(foldBattleLog(all))
    const place = text.indexOf('把巡猎者放到格9')
    const end = text.indexOf('回合结束时')
    const turn2 = text.indexOf('第2回合')
    expect(place).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(place)
    expect(turn2).toBeGreaterThan(end)
    expect(text).toContain('开战 · 独行食人魔')
    expect(text).toContain('格3 食人魔')
    expect(text).toContain('化身 巡猎者 入手')
    expect(text).toContain('起手 猎犬×4')
    expect(text).toContain('第1回合')
    expect(text).toContain('把猎犬放到格2')
    expect(text).toContain('被印上猎印')
    expect(text).toContain('从格3走到格6')
    expect(text).toContain('抽到 猎犬')
    expect(text).toContain('占领 1/1')
    expect(text).toContain('占领回满')
    expect(text).not.toContain('出牌阶段')
    expect(text).not.toContain('0/0')
    expect(text).not.toContain('没有打中')
  })

  it('没打中的回合结束不单开一行', () => {
    const { aggregate: b, events } = startBattle('MON.N01')
    const all: BattleEvent[] = [...events]
    all.push(...playDef(b, 'PC.A00', 7))
    all.push(...playDef(b, 'PC.A01', 8))
    all.push(...b.playerEndTurn())
    const text = dump(foldBattleLog(all))
    expect(text).not.toContain('没有打中')
    expect(text).not.toContain('猎犬·格')
    expect(text).toContain('把猎犬放到格8')
  })

  it('法术写出点数变化', () => {
    const { aggregate: b, events } = startBattle('MON.N01', ['PC.A02', 'PC.A02', 'PC.A02', 'PC.A02', 'PC.A02'])
    const all: BattleEvent[] = [...events]
    all.push(...playDef(b, 'PC.A00', 5))
    all.push(...playDef(b, 'PC.A02', undefined, 'EC.01'))
    const text = dump(foldBattleLog(all))
    expect(text).toContain('你 打出猎箭')
    expect(text).toContain('30→28')
  })

  it('覆盖用后来才出现的名字，平点和胜负各只说一次', () => {
    const covered: BattleEvent[] = [
      { type: 'battle.cardPlayed', card: 'c1', defId: 'PC.A01', kind: 'occupy', cell: 3, text: '' },
      { type: 'battle.cardCovered', victim: 'c9', by: 'c1', cell: 3, victimPoints: 4, text: '' },
      { type: 'battle.cardRemoved', card: 'c9', defId: 'EC.03', cell: 3, to: 'discard', reason: 'cover', text: '' },
    ]
    const coverText = dump(foldBattleLog(covered))
    expect(coverText).toContain('盖住 蛛卵，扣掉 4 点')
    expect(coverText).not.toContain('离场')

    const tied: BattleEvent[] = [
      { type: 'battle.cardPlayed', card: 'c1', defId: 'PC.A01', kind: 'occupy', cell: 3, text: '' },
      { type: 'battle.cardCovered', victim: 'c9', by: 'c1', cell: 3, victimPoints: 4, tied: true, text: '' },
      { type: 'battle.cardRemoved', card: 'c9', defId: 'EC.03', cell: 3, to: 'discard', reason: 'tie', text: '' },
      { type: 'battle.cardRemoved', card: 'c1', defId: 'PC.A01', cell: 3, to: 'discard', reason: 'tie', text: '' },
    ]
    const tieText = dump(foldBattleLog(tied))
    expect(tieText).toContain('平点，双方离场')
    expect(tieText.match(/离场/g)).toHaveLength(1)

    const done = foldBattleLog([
      { type: 'battle.settled', outcome: 'win', reason: 'clear', avatarCost: 4, text: '' },
    ])
    expect(done[0]?.text).toBe('胜利 · 清场 · 化身代价 4')

    const miss: BattleEvent[] = [
      { type: 'battle.cardPlayed', card: 'c1', defId: 'PC.A02', kind: 'spell', text: '' },
      { type: 'battle.effectResolved', card: 'c1', defId: 'PC.A02', timing: 'play', hit: false, text: '' },
    ]
    expect(dump(foldBattleLog(miss))).toContain('没有打中')
  })
})
