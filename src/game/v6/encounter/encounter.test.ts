import { describe, expect, it } from 'vitest';
import { getCardByName } from '../content';
import { createBattle, type CellId } from '../rules';
import { scriptedCard } from '../scripts';
import {
  answerEncounterChoice,
  endEncounterTurn,
  placeRunawayIntent,
  playEncounterCard,
  snapshotEncounter,
  startRunawayEncounter,
  type Encounter,
} from './index';

function openingWith(name: string): Encounter {
  for (let seed = 1; seed < 80; seed += 1) {
    const encounter = startRunawayEncounter(seed);
    if (snapshotEncounter(encounter).hand.some((card) => card.name === name)) return encounter;
  }
  throw new Error(`opening hand never contained ${name}`);
}

describe('runaway machine encounter', () => {
  it('opens on the science deck, the preset machine, and the sampler intent', () => {
    const encounter = startRunawayEncounter(1);
    const view = snapshotEncounter(encounter);
    expect(encounter.match.phase).toBe('playerAction');
    expect(encounter.match.over).toBe(false);
    expect(view.cells).toHaveLength(9);
    expect(view.cells.map((cell) => cell.cell)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(view.cells.find((cell) => cell.cell === 5)).toMatchObject({
      name: '失控机械',
      owner: 'enemy',
      points: 5,
      analyzed: false,
    });
    expect(view.cells.filter((cell) => cell.instanceId).map((cell) => cell.cell)).toEqual([5]);
    expect(view.hand).toHaveLength(5);
    expect(view.intent).toEqual({
      name: '弱点采样机',
      effectText: getCardByName('弱点采样机')?.effectText,
    });
    expect(view.points).toEqual({ player: 0, enemy: 5 });
    expect(view.waitingForPlayer).toBe(true);
    expect(view.choiceSource).toBeNull();
    expect(view.legalTargets).toBeNull();
    expect(encounter.match.battle.log.some((line) => line.startsWith('enter:'))).toBe(false);
  });

  it('lets the player play 斥候 and end the turn, then the sampler marks that scout', () => {
    const encounter = openingWith('斥候');
    const scout = snapshotEncounter(encounter).hand.find((card) => card.name === '斥候');
    if (!scout) throw new Error('missing scout');
    const played = playEncounterCard(encounter, { instanceId: scout.instanceId, cell: 9 });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(snapshotEncounter(played.encounter).points.player).toBe(4);

    const predicted = placeRunawayIntent(played.encounter.match.battle, played.encounter.match.revealed!);
    expect(predicted).not.toBe('skip');
    const ended = endEncounterTurn(played.encounter);
    const view = snapshotEncounter(ended);
    expect(ended.match.pendingChoice).toBeNull();
    expect(ended.match.phase).toBe('playerAction');
    expect(view.intent?.name).toBe('弱点攻击器');
    expect(view.cells.find((cell) => cell.name === '弱点采样机')?.cell).toBe(predicted);
    expect(view.cells.find((cell) => cell.cell === 9)).toMatchObject({ name: '斥候', analyzed: true, points: 4 });
    expect(view.waitingForPlayer).toBe(true);
    expect(view.legalTargets).toBeNull();
  });

  it('stops at 科学研究器 until the player marks the machine', () => {
    const encounter = openingWith('科学研究器');
    const device = snapshotEncounter(encounter).hand.find((card) => card.name === '科学研究器');
    if (!device) throw new Error('missing device');
    const played = playEncounterCard(encounter, { instanceId: device.instanceId, cell: 2 });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    const waiting = endEncounterTurn(played.encounter);
    const paused = snapshotEncounter(waiting);
    const machine = paused.cells.find((cell) => cell.name === '失控机械');
    expect(machine?.analyzed).toBe(false);
    expect(paused.waitingForPlayer).toBe(true);
    expect(paused.choiceSource?.name).toBe('科学研究器');
    expect(paused.legalTargets?.map((target) => target.instanceId)).toEqual([machine?.instanceId]);

    const answered = answerEncounterChoice(waiting, machine?.instanceId ?? '');
    const done = snapshotEncounter(answered);
    expect(done.cells.find((cell) => cell.name === '失控机械')?.analyzed).toBe(true);
    expect(done.legalTargets).toBeNull();
    expect(answered.match.phase).toBe('playerAction');
  });

  it('skips placement when choosePlacement has no cell', () => {
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
    const sampler = scriptedCard('弱点采样机').definition;
    expect(
      placeRunawayIntent(battle, {
        definitionId: sampler.id,
        name: sampler.name,
        owner: 'enemy',
        ruleType: 'field',
        basePoints: sampler.basePoints,
        swift: false,
      }),
    ).toBe('skip');
  });
});
