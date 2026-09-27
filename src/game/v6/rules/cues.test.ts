import { describe, expect, it } from 'vitest';
import { createBattle, executeOpcodes, playCard, runTurnStartEffects, type CardDefinition, type CardSetup } from './index';
import { freshCues, presentCues } from './cues';

function field(id: string, points: number, extra: Partial<CardDefinition> = {}): CardDefinition {
  return { id, name: id, ruleType: 'field', basePoints: points, ...extra };
}

function at(definition: CardDefinition, zone: CardSetup['zone'], extra: Partial<CardSetup> = {}): CardSetup {
  return { definition, owner: 'player', zone, instanceId: definition.id, ...extra };
}

describe('effect cues', () => {
  it('plays same-step turn effects in cell order', () => {
    const low = field('low', 1, { onTurnStart: [{ op: 'gainFaith', amount: 1 }] });
    const high = field('high', 1, { onTurnStart: [{ op: 'gainFaith', amount: 1 }] });
    const state = createBattle({
      cards: [
        at(low, 'board', { cell: 8, owner: 'enemy' }),
        at(high, 'board', { cell: 2, owner: 'enemy' }),
      ],
    });
    const next = runTurnStartEffects(state, 'enemy');
    const faith = freshCues(state.cues, next.cues).filter((cue) => cue.kind === 'faith');
    expect(faith.map((cue) => cue.sourceId)).toEqual(['high', 'low']);
    expect(faith.map((cue) => cue.sourceCell)).toEqual([2, 8]);
  });

  it('plays a mark before the listener it wakes, listeners in cell order', () => {
    const listener = (id: string): CardDefinition =>
      field(id, 1, {
        reactions: [{ event: 'gainedMark', effects: [{ op: 'gainFaith', amount: 1 }] }],
      });
    const state = createBattle({
      cards: [
        at(field('body', 3), 'board', { cell: 5 }),
        at(listener('late'), 'board', { cell: 7, owner: 'enemy' }),
        at(listener('early'), 'board', { cell: 1, owner: 'enemy' }),
      ],
    });
    const next = executeOpcodes(state, [{ op: 'addMark', target: { ref: 'instance', id: 'body' } }], { selfId: 'body' });
    expect(freshCues(state.cues, next.cues).map((cue) => `${cue.kind}:${cue.sourceId}`)).toEqual([
      'mark:body',
      'faith:early',
      'faith:late',
    ]);
  });

  it('grows a spawned card from the card that made it, before the token resolves', () => {
    const token = field('token', 2, { effects: [{ op: 'modPermanent', amount: 1, target: { ref: 'self' } }] });
    const nest = field('nest', 1, { effects: [{ op: 'spawn', definitionId: 'token', cell: 4 }] });
    const state = createBattle({
      cards: [at(nest, 'board', { cell: 5 })],
      catalog: [token],
    });
    const next = executeOpcodes(state, nest.effects ?? [], { selfId: 'nest' });
    const cues = freshCues(state.cues, next.cues);
    expect(cues.map((cue) => cue.kind)).toEqual(['spawn', 'points']);
    expect(cues[0]).toMatchObject({ sourceId: 'nest', sourceCell: 5, cell: 4, owner: 'player' });
    expect(cues[1]?.sourceCell).toBe(4);
  });

  it('keeps earlier cues and only returns the new tail', () => {
    const state = createBattle({
      cards: [at(field('body', 2, { effects: [{ op: 'giveProtect', target: { ref: 'self' } }] }), 'board', { cell: 1 })],
    });
    const once = executeOpcodes(state, [{ op: 'giveProtect', target: { ref: 'self' } }], { selfId: 'body' });
    const twice = executeOpcodes(once, [{ op: 'addMark', target: { ref: 'self' } }], { selfId: 'body' });
    expect(freshCues(once.cues, twice.cues).map((cue) => cue.kind)).toEqual(['mark']);
    expect(twice.cues.map((cue) => cue.kind)).toEqual(['protect', 'mark']);
  });

  it('lets a landing carry the cover that made its cell', () => {
    const state = createBattle({
      cards: [
        at(field('wall', 1), 'board', { cell: 1, owner: 'enemy' }),
        at(field('ram', 4), 'hand'),
      ],
    });
    const played = playCard(state, { instanceId: 'ram', cell: 1 });
    if (!played.ok) throw new Error(played.reason);
    const raw = freshCues(state.cues, played.state.cues);
    expect(raw.some((cue) => cue.kind === 'cover')).toBe(true);
    expect(presentCues(raw).some((cue) => cue.kind === 'cover')).toBe(false);
    expect(presentCues(raw)[0]?.kind).toBe('arrive');
  });
});
