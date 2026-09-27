import { describe, expect, it } from 'vitest'
import { createBattle, executeOpcodes, type CardDefinition, type CardSetup } from '../../rules'
import { concealedIds, gainedSuppress } from './reel'

function field(id: string, points: number, extra: Partial<CardDefinition> = {}): CardDefinition {
  return { id, name: id, ruleType: 'field', basePoints: points, ...extra }
}

function at(definition: CardDefinition, zone: CardSetup['zone'], extra: Partial<CardSetup> = {}): CardSetup {
  return { definition, owner: 'player', zone, instanceId: definition.id, ...extra }
}

describe('effect reel', () => {
  it('hides a spawn until it has grown, and keeps the landing player card visible', () => {
    const token = field('token', 1)
    const nest = field('nest', 1, { effects: [{ op: 'spawn', definitionId: 'token', cell: 2 }] })
    const before = createBattle({ cards: [at(nest, 'hand')], catalog: [token] })
    const played = executeOpcodes(before, nest.effects ?? [], { selfId: 'nest' })
    const spawn = played.cues.find((cue) => cue.kind === 'spawn')
    const arrive = { ...spawn!, kind: 'arrive' as const, owner: 'player' as const, targetId: 'nest', cell: 5 as const, seq: 0 }
    if (!spawn) throw new Error('missing spawn')
    expect(concealedIds(played, [arrive, spawn])).not.toContain('nest')
    expect(concealedIds(played, [arrive, spawn])).toContain(spawn.targetId)
    expect(concealedIds(played, [spawn])).toContain(spawn.targetId)
  })

  it('holds a new mark back until its picture starts', () => {
    const before = createBattle({ cards: [at(field('body', 2), 'board', { cell: 1 })] })
    const after = executeOpcodes(before, [{ op: 'addMark', target: { ref: 'self' } }], { selfId: 'body' })
    expect(gainedSuppress(before, after)).toEqual([{ id: 'body', flag: 'analyzed' }])
  })
})
