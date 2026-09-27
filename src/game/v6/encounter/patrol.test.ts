import { describe, expect, it } from 'vitest';
import { getCardByName } from '../content';
import { createBattle, type CellId } from '../rules';
import { scriptedCard, scriptedPatrol } from '../scripts';
import { endTurn, startMatch } from '../turn';
import {
  endEncounterTurn,
  placePatrolIntent,
  playEncounterCard,
  snapshotEncounter,
  startPatrolEncounter,
  type Encounter,
} from './index';

function openingWith(name: string): Encounter {
  for (let seed = 1; seed < 80; seed += 1) {
    const encounter = startPatrolEncounter(seed);
    if (snapshotEncounter(encounter).hand.some((card) => card.name === name)) return encounter;
  }
  throw new Error(`opening hand never contained ${name}`);
}

describe('patrol swarm encounter', () => {
  it('opens with the hive on cell 5 and 巡检探头 as the first intent', () => {
    const encounter = startPatrolEncounter(1);
    const view = snapshotEncounter(encounter);
    expect(encounter.match.phase).toBe('playerAction');
    expect(encounter.match.over).toBe(false);
    expect(view.cells.find((cell) => cell.cell === 5)).toMatchObject({
      name: '蜂巢',
      owner: 'enemy',
      points: 3,
      analyzed: false,
    });
    expect(view.cells.filter((cell) => cell.instanceId).map((cell) => cell.cell)).toEqual([5]);
    expect(view.intent).toEqual({
      name: '巡检探头',
      effectText: getCardByName('巡检探头')?.effectText,
    });
    expect(view.points).toEqual({ player: 0, enemy: 3 });
    const hive = view.cells.find((cell) => cell.cell === 5);
    const hiveCard = hive?.instanceId ? encounter.match.battle.instances[hive.instanceId] : undefined;
    const hiveDefinition = hiveCard ? encounter.match.battle.definitions[hiveCard.definitionId] : undefined;
    expect(hiveDefinition?.effects).toEqual([]);
    expect(hiveDefinition?.onTurnEnd).toEqual([
      { op: 'spawn', definitionId: scriptedPatrol('工蜂').id, cell: 'randomAdjacentEmpty' },
    ]);
    expect(encounter.match.battle.log.some((line) => line.startsWith('enter:'))).toBe(false);
  });

  it('lets the player play one card and end the turn, then the probe lands and marks that card', () => {
    const encounter = openingWith('斥候');
    const scout = snapshotEncounter(encounter).hand.find((card) => card.name === '斥候');
    if (!scout) throw new Error('missing scout');
    const played = playEncounterCard(encounter, { instanceId: scout.instanceId, cell: 9 });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(snapshotEncounter(played.encounter).points.player).toBe(4);

    const predicted = placePatrolIntent(played.encounter.match.battle, played.encounter.match.revealed!);
    expect(predicted).not.toBe('skip');
    const ended = endEncounterTurn(played.encounter);
    const view = snapshotEncounter(ended);
    expect(ended.match.phase).toBe('playerAction');
    expect(view.intent?.name).toBe('测绘员');
    expect(view.cells.find((cell) => cell.name === '巡检探头')?.cell).toBe(predicted);
    expect(view.cells.find((cell) => cell.cell === 9)).toMatchObject({ name: '斥候', analyzed: true, points: 4 });
    const bee = view.cells.find((cell) => cell.name === '工蜂');
    expect(bee).toMatchObject({ owner: 'enemy', points: 1 });
    expect([2, 4, 6, 8]).toContain(bee?.cell);
    expect(view.cells.find((cell) => cell.name === '蜂巢')?.analyzed).toBe(false);

    const surveyorAt = placePatrolIntent(ended.match.battle, ended.match.revealed!);
    expect(surveyorAt).not.toBe('skip');
    const surveyed = snapshotEncounter(endEncounterTurn(ended));
    expect(surveyed.cells.find((cell) => cell.name === '测绘员')?.cell).toBe(surveyorAt);
    expect(surveyed.intent?.name).toBe('收容钳');
    expect(surveyed.cells.find((cell) => cell.cell === 9)?.analyzed).toBe(true);
    expect(surveyed.cells.find((cell) => cell.name === '蜂巢')?.analyzed).toBe(false);
    const laterBee = surveyed.cells.find((cell) => cell.name === '工蜂');
    expect(laterBee).toMatchObject({ owner: 'enemy', points: 1 });
    expect([2, 4, 6, 8]).toContain(laterBee?.cell);
  });

  it('skips the probe when choosePlacement has no cell', () => {
    const filler = scriptedCard('斥候').definition;
    const battle = createBattle({
      cards: ([1, 2, 3, 4, 5, 6, 7, 8, 9] as CellId[]).map((cell) => ({
        definition: filler,
        owner: 'player' as const,
        zone: 'board' as const,
        cell,
        instanceId: `p${cell}`,
        permanentMod: 6,
      })),
    });
    const probe = scriptedPatrol('巡检探头').definition;
    expect(
      placePatrolIntent(battle, {
        definitionId: probe.id,
        name: probe.name,
        owner: 'enemy',
        ruleType: 'field',
        basePoints: probe.basePoints,
        swift: false,
      }),
    ).toBe('skip');
  });

  it('removes the marked card at 3 or less when the enemy plays 收容钳, not the higher marked card', () => {
    const clamp = scriptedPatrol('收容钳').definition;
    const body = scriptedCard('斥候').definition;
    const tall = scriptedCard('钻心器').definition;
    const started = startMatch(
      {
        seed: 1,
        cards: [
          {
            definition: body,
            owner: 'player',
            zone: 'board',
            cell: 1,
            instanceId: 'low',
            analyzed: true,
            permanentMod: -2,
          },
          { definition: tall, owner: 'player', zone: 'board', cell: 3, instanceId: 'high', analyzed: true },
          ...Array.from({ length: 6 }, () => ({ definition: body, owner: 'player' as const, zone: 'deck' as const })),
        ],
        intents: [{ definition: clamp, owner: 'enemy' as const }],
      },
      { placeIntent: placePatrolIntent },
    );
    const ended = endTurn(started);
    expect(ended.over).toBe(false);
    expect(ended.battle.instances.low.zone).toBe('discard');
    expect(ended.battle.instances.high.zone).toBe('board');
    expect(ended.battle.instances.high.analyzed).toBe(true);
    expect(Object.values(ended.battle.instances).some((card) => ended.battle.definitions[card.definitionId]?.name === '收容钳' && card.zone === 'board')).toBe(true);
  });

  it('only occupies when 收容钳 has no marked card at 3 or less', () => {
    const clamp = scriptedPatrol('收容钳').definition;
    const tall = scriptedCard('钻心器').definition;
    const started = startMatch(
      {
        seed: 2,
        cards: [
          { definition: tall, owner: 'player', zone: 'board', cell: 1, instanceId: 'plain' },
          { definition: tall, owner: 'player', zone: 'board', cell: 3, instanceId: 'marked', analyzed: true },
          ...Array.from({ length: 6 }, () => ({ definition: tall, owner: 'player' as const, zone: 'deck' as const })),
        ],
        intents: [{ definition: clamp, owner: 'enemy' as const }],
      },
      { placeIntent: placePatrolIntent },
    );
    const ended = endTurn(started);
    expect(ended.battle.instances.plain.zone).toBe('board');
    expect(ended.battle.instances.marked.zone).toBe('board');
    expect(Object.values(ended.battle.instances).some((card) => ended.battle.definitions[card.definitionId]?.name === '收容钳' && card.zone === 'board')).toBe(true);
  });
});
