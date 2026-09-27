import { describe, expect, it } from 'vitest';
import { getCardByName, getMonster } from '../content';
import { createBattle, currentPoints, executeOpcodes, playCard } from '../rules';
import { scriptedCard } from '../scripts';
import { anatomistCard, scriptedAnatomist } from '../scripts/anatomist';
import { endEncounterTurn, playEncounterCard, snapshotEncounter, type Encounter } from './index';
import { placeAnatomistIntent, startAnatomistEncounter } from './anatomist';

function openingWith(name: string): Encounter {
  for (let seed = 1; seed < 80; seed += 1) {
    const encounter = startAnatomistEncounter(seed);
    if (snapshotEncounter(encounter).hand.some((card) => card.name === name)) return encounter;
  }
  throw new Error(`opening hand never contained ${name}`);
}

describe('anatomist encounter', () => {
  it('opens with 解剖台 on cell 5 and 收容钳 as the first intent', () => {
    const encounter = startAnatomistEncounter(1);
    const view = snapshotEncounter(encounter);
    const monster = getMonster('anatomist');
    expect(encounter.match.phase).toBe('playerAction');
    expect(encounter.match.over).toBe(false);
    expect(view.cells.find((cell) => cell.cell === 5)).toMatchObject({
      name: '解剖台',
      owner: 'enemy',
      points: 5,
      analyzed: false,
    });
    expect(view.cells.filter((cell) => cell.instanceId).map((cell) => cell.cell)).toEqual([5]);
    expect(view.intent).toEqual({
      name: '收容钳',
      effectText: getCardByName('收容钳')?.effectText,
    });
    expect(view.points).toEqual({ player: 0, enemy: 5 });
    expect(monster).toMatchObject({
      id: 'anatomist',
      skills: ['活体解析'],
      presets: [{ cell: 5, cardName: '解剖台' }],
      intents: ['收容钳', '攻击炮台', '标本柜', '激光扫描仪'],
      rewardGold: 100,
      rewardCardNames: ['收容钳', '攻击炮台', '标本柜', '激光扫描仪', '逆向解析'],
    });
    expect(scriptedAnatomist('解剖台').definition.reactions).toEqual([
      {
        event: 'gainedMark',
        subject: { owner: 'player' },
        effects: [{ op: 'modPermanent', amount: 1, target: { ref: 'self' } }],
      },
    ]);
    expect(scriptedAnatomist('收容钳').definition.effects).toEqual([
      {
        op: 'remove',
        target: { ref: 'choice', index: 0 },
        when: [{ kind: 'hasMark' }, { kind: 'pointsAtMost', max: 3 }],
      },
    ]);
    expect(scriptedAnatomist('攻击炮台').definition.onTurnEnd).toEqual([
      { op: 'modPermanent', amount: -2, target: { ref: 'choice', index: 0 } },
    ]);
    expect(scriptedAnatomist('激光扫描仪').definition.onTurnEnd).toEqual([
      {
        op: 'forEach',
        query: { owner: 'opponent', hasMark: true },
        effects: [{ op: 'modPermanent', amount: -1, target: { ref: 'each' } }],
      },
    ]);
    expect(anatomistCard('标本柜').status).toBe('script');
    expect(anatomistCard('标本柜').definition.effects).toEqual([]);
    expect(scriptedAnatomist('标本柜').definition.reactions).toEqual([
      {
        event: 'left',
        onBoard: true,
        subject: { ownerRelation: 'opponent', hasMark: true },
        effects: [{ op: 'modPermanent', amount: 2, target: { ref: 'self' } }],
      },
    ]);
    expect(anatomistCard('逆向解析').status).toBe('script');
    expect(anatomistCard('逆向解析').definition.spellTarget).toEqual({ owner: 'any', hasMark: true });
    expect(anatomistCard('逆向解析').definition.effects).toEqual([
      {
        op: 'ifOwner',
        target: { ref: 'choice', index: 0 },
        same: [
          {
            op: 'modPermanent',
            amount: 4,
            target: { ref: 'choice', index: 0 },
            onStayed: [{ op: 'removeMark', target: { ref: 'choice', index: 0 } }],
          },
        ],
        opponent: [
          {
            op: 'modPermanent',
            amount: -4,
            target: { ref: 'choice', index: 0 },
            onStayed: [{ op: 'removeMark', target: { ref: 'choice', index: 0 } }],
          },
        ],
      },
    ]);
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
    expect(view.intent?.name).toBe('攻击炮台');
    expect(view.cells.some((cell) => cell.name === '收容钳' && cell.owner === 'enemy')).toBe(true);
  });

  it('marks the scout at the enemy turn end and raises 解剖台 by 1', () => {
    const encounter = openingWith('斥候');
    const scout = snapshotEncounter(encounter).hand.find((card) => card.name === '斥候');
    if (!scout) throw new Error('missing scout');
    const played = playEncounterCard(encounter, { instanceId: scout.instanceId, cell: 1 });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    const before = snapshotEncounter(played.encounter);
    expect(before.cells.find((cell) => cell.cell === 5)?.points).toBe(5);
    expect(before.cells.find((cell) => cell.name === '斥候')?.analyzed).toBe(false);

    const ended = endEncounterTurn(played.encounter);
    const view = snapshotEncounter(ended);
    expect(view.cells.find((cell) => cell.cell === 1)).toMatchObject({
      name: '斥候',
      owner: 'player',
      points: 4,
      analyzed: true,
    });
    expect(view.cells.find((cell) => cell.cell === 5)).toMatchObject({
      name: '解剖台',
      owner: 'enemy',
      points: 6,
    });
    expect(view.cells.find((cell) => cell.cell === 2)).toMatchObject({
      name: '收容钳',
      owner: 'enemy',
    });
    const revealed = ended.match.revealed;
    if (!revealed) throw new Error('missing intent');
    expect(placeAnatomistIntent(ended.match.battle, revealed)).toBe(3);
  });

  it('adds 2 to 标本柜 when a marked enemy leaves, after the mark is cleared, and not otherwise', () => {
    const cabinet = scriptedAnatomist('标本柜').definition;
    const scout = scriptedCard('斥候').definition;
    const marked = executeOpcodes(
      createBattle({
        cards: [
          { definition: cabinet, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'cabinet' },
          { definition: scout, owner: 'player', zone: 'board', cell: 1, instanceId: 'marked', analyzed: true },
        ],
      }),
      [{ op: 'remove', target: { ref: 'instance', id: 'marked' } }],
      { selfId: 'cabinet' },
    );
    expect(marked.instances.marked.zone).toBe('discard');
    expect(marked.instances.marked.analyzed).toBe(false);
    expect(marked.instances.cabinet.permanentMod).toBe(2);
    expect(currentPoints(marked, 'cabinet')).toBe(6);

    const plain = executeOpcodes(
      createBattle({
        cards: [
          { definition: cabinet, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'cabinet' },
          { definition: scout, owner: 'player', zone: 'board', cell: 1, instanceId: 'plain' },
        ],
      }),
      [{ op: 'remove', target: { ref: 'instance', id: 'plain' } }],
      { selfId: 'cabinet' },
    );
    expect(plain.instances.plain.analyzed).toBe(false);
    expect(currentPoints(plain, 'cabinet')).toBe(4);
    expect(plain.instances.cabinet.permanentMod).toBe(0);

    const sameSide = executeOpcodes(
      createBattle({
        cards: [
          { definition: cabinet, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'cabinet' },
          { definition: scout, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'marked', analyzed: true },
        ],
      }),
      [{ op: 'remove', target: { ref: 'instance', id: 'marked' } }],
      { selfId: 'cabinet' },
    );
    expect(sameSide.instances.marked.analyzed).toBe(false);
    expect(currentPoints(sameSide, 'cabinet')).toBe(4);
  });

  it('adds 4 to a marked ally and strips the mark, and removes 4 from a marked enemy before the mark comes off', () => {
    const reverse = scriptedAnatomist('逆向解析').definition;
    const cabinet = scriptedAnatomist('标本柜').definition;
    const scout = scriptedCard('斥候').definition;

    const ally = playCard(
      createBattle({
        cards: [
          { definition: reverse, owner: 'player', zone: 'hand', instanceId: 'spell' },
          { definition: scout, owner: 'player', zone: 'board', cell: 1, instanceId: 'ally', analyzed: true },
          { definition: scout, owner: 'enemy', zone: 'board', cell: 9, instanceId: 'foe', analyzed: true },
        ],
      }),
      { instanceId: 'spell', choice: { targets: ['ally'] } },
    );
    expect(ally.ok).toBe(true);
    if (!ally.ok) return;
    expect(ally.state.instances.ally.permanentMod).toBe(4);
    expect(currentPoints(ally.state, 'ally')).toBe(8);
    expect(ally.state.instances.ally.analyzed).toBe(false);
    expect(ally.state.instances.ally.zone).toBe('board');
    expect(ally.state.instances.foe.permanentMod).toBe(0);
    expect(ally.state.instances.foe.analyzed).toBe(true);
    expect(ally.state.discard).toEqual(['spell']);

    const stayed = playCard(
      createBattle({
        cards: [
          { definition: reverse, owner: 'player', zone: 'hand', instanceId: 'spell' },
          { definition: scout, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'foe', analyzed: true, permanentMod: 2 },
        ],
      }),
      { instanceId: 'spell', choice: { targets: ['foe'] } },
    );
    expect(stayed.ok).toBe(true);
    if (!stayed.ok) return;
    expect(stayed.state.instances.foe.permanentMod).toBe(-2);
    expect(currentPoints(stayed.state, 'foe')).toBe(2);
    expect(stayed.state.instances.foe.analyzed).toBe(false);
    expect(stayed.state.instances.foe.zone).toBe('board');

    const left = playCard(
      createBattle({
        cards: [
          { definition: reverse, owner: 'player', zone: 'hand', instanceId: 'spell' },
          { definition: cabinet, owner: 'player', zone: 'board', cell: 5, instanceId: 'cabinet' },
          { definition: scout, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'foe', analyzed: true },
        ],
      }),
      { instanceId: 'spell', choice: { targets: ['foe'] } },
    );
    expect(left.ok).toBe(true);
    if (!left.ok) return;
    expect(left.state.instances.foe.zone).toBe('discard');
    expect(left.state.instances.foe.analyzed).toBe(false);
    expect(left.state.cells[1]).toBeNull();
    expect(left.state.instances.cabinet.permanentMod).toBe(2);
    expect(currentPoints(left.state, 'cabinet')).toBe(6);

    const refused = playCard(
      createBattle({
        cards: [
          { definition: reverse, owner: 'player', zone: 'hand', instanceId: 'spell' },
          { definition: scout, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'foe' },
        ],
      }),
      { instanceId: 'spell', choice: { targets: ['foe'] } },
    );
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.reason).toBe('no-target');
    expect(refused.state.hand).toEqual(['spell']);
    expect(refused.state.instances.foe.analyzed).toBe(false);
    expect(currentPoints(refused.state, 'foe')).toBe(4);
  });
});
