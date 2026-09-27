import { describe, expect, it } from 'vitest';
import { getCardByName, getMonster } from '../content';
import { createBattle, playCard, type CardDefinition } from '../rules';
import { rustCard, scriptedRust } from '../scripts/rust';
import { endEncounterTurn, playEncounterCard, snapshotEncounter, type Encounter } from './index';
import { placeRustIntent, startRustEncounter } from './rust';

function openingWith(name: string): Encounter {
  for (let seed = 1; seed < 80; seed += 1) {
    const encounter = startRustEncounter(seed);
    if (snapshotEncounter(encounter).hand.some((card) => card.name === name)) return encounter;
  }
  throw new Error(`opening hand never contained ${name}`);
}

describe('rust colossus encounter', () => {
  it('opens with no preset and 钻心器 as the first intent', () => {
    const encounter = startRustEncounter(1);
    const view = snapshotEncounter(encounter);
    const monster = getMonster('rust-colossus');
    expect(encounter.match.phase).toBe('playerAction');
    expect(encounter.match.over).toBe(false);
    expect(view.cells.filter((cell) => cell.instanceId)).toEqual([]);
    expect(view.intent).toEqual({
      name: '钻心器',
      effectText: getCardByName('钻心器')?.effectText,
    });
    expect(view.points).toEqual({ player: 0, enemy: 0 });
    expect(monster).toMatchObject({
      id: 'rust-colossus',
      presets: [],
      intents: ['钻心器', '霸占者', '过载电池'],
      rewardGold: 60,
      rewardCardNames: ['钻心器', '霸占者', '过载电池', '调取图纸'],
    });
    expect(scriptedRust('钻心器').definition.effects).toEqual([]);
    expect(scriptedRust('霸占者').definition.effects).toEqual([
      { op: 'modPermanent', amount: -2, target: { ref: 'choice', index: 0 } },
    ]);
    expect(scriptedRust('过载电池').definition.onTurnEnd).toEqual([
      { op: 'modPermanent', amount: -1, target: { ref: 'self' } },
    ]);
    expect(rustCard('调取图纸').status).toBe('script');
    expect(rustCard('调取图纸').definition.effects).toEqual([{ op: 'search', minBase: 8 }]);
  });

  it('lets the player play one card and end the turn', () => {
    const encounter = openingWith('斥候');
    const scout = snapshotEncounter(encounter).hand.find((card) => card.name === '斥候');
    if (!scout) throw new Error('missing scout');
    const played = playEncounterCard(encounter, { instanceId: scout.instanceId, cell: 1 });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(snapshotEncounter(played.encounter).points.player).toBe(4);

    const ended = endEncounterTurn(played.encounter);
    const view = snapshotEncounter(ended);
    expect(ended.match.phase).toBe('playerAction');
    expect(ended.match.over).toBe(false);
    expect(view.intent?.name).toBe('霸占者');
    expect(view.cells.some((cell) => cell.name === '钻心器' && cell.owner === 'enemy')).toBe(true);
  });

  it('covers a lower player card instead of an empty cell', () => {
    const encounter = openingWith('斥候');
    const scout = snapshotEncounter(encounter).hand.find((card) => card.name === '斥候');
    if (!scout) throw new Error('missing scout');
    const played = playEncounterCard(encounter, { instanceId: scout.instanceId, cell: 7 });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    const before = snapshotEncounter(played.encounter);
    expect(before.cells.filter((cell) => cell.instanceId === null).length).toBeGreaterThan(0);
    const revealed = played.encounter.match.revealed;
    if (!revealed) throw new Error('missing intent');
    expect(placeRustIntent(played.encounter.match.battle, revealed)).toBe(7);

    const ended = snapshotEncounter(endEncounterTurn(played.encounter));
    expect(ended.cells.find((cell) => cell.cell === 7)).toMatchObject({
      name: '钻心器',
      owner: 'enemy',
      points: 1,
    });
    expect(ended.cells.filter((cell) => cell.name === '钻心器').map((cell) => cell.cell)).toEqual([7]);
  });

  it('adds one field card of printed base 8 or more, and still discards the spell when the deck has none', () => {
    const fetch = scriptedRust('调取图纸').definition;
    const heavy: CardDefinition = { id: 'heavy', name: 'heavy', ruleType: 'field', basePoints: 8 };
    const light: CardDefinition = { id: 'light', name: 'light', ruleType: 'field', basePoints: 7 };

    const added = playCard(
      createBattle({
        cards: [
          { definition: fetch, owner: 'player', zone: 'hand', instanceId: 'spell' },
          { definition: light, owner: 'player', zone: 'deck', instanceId: 'puffed', permanentMod: 9 },
          { definition: heavy, owner: 'player', zone: 'deck', instanceId: 'blueprint', permanentMod: -3 },
        ],
      }),
      { instanceId: 'spell' },
    );
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.state.hand).toEqual(['blueprint']);
    expect(added.state.deck).toEqual(['puffed']);
    expect(added.state.discard).toEqual(['spell']);
    expect(added.state.instances.blueprint.basePoints).toBe(8);
    expect(added.state.instances.blueprint.permanentMod).toBe(-3);
    expect(added.state.instances.puffed.zone).toBe('deck');

    const picked = playCard(
      createBattle({
        cards: [
          { definition: fetch, owner: 'player', zone: 'hand', instanceId: 'spell' },
          { definition: heavy, owner: 'player', zone: 'deck', instanceId: 'first' },
          { definition: heavy, owner: 'player', zone: 'deck', instanceId: 'second' },
        ],
      }),
      { instanceId: 'spell', choice: { targets: ['second'] } },
    );
    expect(picked.ok).toBe(true);
    if (!picked.ok) return;
    expect(picked.state.hand).toEqual(['second']);
    expect(picked.state.deck).toEqual(['first']);
    expect(picked.state.discard).toEqual(['spell']);

    const none = playCard(
      createBattle({
        cards: [
          { definition: fetch, owner: 'player', zone: 'hand', instanceId: 'spell' },
          { definition: light, owner: 'player', zone: 'deck', instanceId: 'puffed', permanentMod: 9 },
        ],
      }),
      { instanceId: 'spell' },
    );
    expect(none.ok).toBe(true);
    if (!none.ok) return;
    expect(none.state.hand).toEqual([]);
    expect(none.state.deck).toEqual(['puffed']);
    expect(none.state.discard).toEqual(['spell']);

    const empty = playCard(
      createBattle({
        cards: [{ definition: fetch, owner: 'player', zone: 'hand', instanceId: 'spell' }],
      }),
      { instanceId: 'spell' },
    );
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(empty.state.hand).toEqual([]);
    expect(empty.state.deck).toEqual([]);
    expect(empty.state.discard).toEqual(['spell']);
  });
});
