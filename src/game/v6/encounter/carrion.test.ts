import { describe, expect, it } from 'vitest';
import { getCardByName, getMonster } from '../content';
import {
  createBattle,
  currentPoints,
  executeOpcodes,
  playCard,
  resolveLeaveChoice,
  cardAt,
  type CardDefinition,
  type CellId,
} from '../rules';
import { nextInt } from '../rules/rng';
import { scriptedCard } from '../scripts';
import { carrionCard, scriptedCarrion } from '../scripts/carrion';
import { endEncounterTurn, playEncounterCard, snapshotEncounter, type Encounter } from './index';
import { placeCarrionIntent, startCarrionEncounter } from './carrion';

function openingWith(name: string): Encounter {
  for (let seed = 1; seed < 80; seed += 1) {
    const encounter = startCarrionEncounter(seed);
    if (snapshotEncounter(encounter).hand.some((card) => card.name === name)) return encounter;
  }
  throw new Error(`opening hand never contained ${name}`);
}

describe('carrion crows encounter', () => {
  it('opens with the nest on cell 1 and 提灯人 as the first intent', () => {
    const encounter = startCarrionEncounter(1);
    const view = snapshotEncounter(encounter);
    const monster = getMonster('carrion-crows');
    expect(encounter.match.phase).toBe('playerAction');
    expect(encounter.match.over).toBe(false);
    expect(view.cells.find((cell) => cell.cell === 1)).toMatchObject({
      name: '鸦巢',
      owner: 'enemy',
      points: 2,
      analyzed: false,
    });
    expect(view.cells.filter((cell) => cell.instanceId).map((cell) => cell.cell)).toEqual([1]);
    expect(view.intent).toEqual({
      name: '提灯人',
      effectText: getCardByName('提灯人')?.effectText,
    });
    expect(view.points).toEqual({ player: 0, enemy: 2 });
    expect(monster).toMatchObject({
      id: 'carrion-crows',
      intents: ['提灯人', '托孤者', '守墓人'],
      rewardGold: 50,
      rewardCardNames: ['提灯人', '托孤者', '守墓人', '引魂铃', '骨匠'],
      presets: [{ cell: 1, cardName: '鸦巢' }],
    });

    const nest = view.cells.find((cell) => cell.cell === 1);
    const nestCard = nest?.instanceId ? encounter.match.battle.instances[nest.instanceId] : undefined;
    const nestDefinition = nestCard ? encounter.match.battle.definitions[nestCard.definitionId] : undefined;
    expect(nestDefinition?.effects).toEqual([]);
    expect(nestDefinition?.reactions).toEqual(scriptedCarrion('鸦巢').definition.reactions);
    const lantern = scriptedCarrion('提灯人');
    const shadeId = getCardByName('残影')?.id;
    expect(shadeId).toBeTruthy();
    expect(lantern.status).toBe('script');
    expect(lantern.definition.effects).toEqual([]);
    expect(lantern.definition.onLeave).toEqual([
      { op: 'spawn', definitionId: shadeId, cell: 'randomEmpty', owner: 'self', basePoints: 2 },
    ]);
    expect(encounter.match.battle.log.some((line) => line.startsWith('enter:'))).toBe(false);
  });

  it('lets the player play one card and end the turn, then 提灯人 occupies and 托孤者 is next', () => {
    const encounter = openingWith('斥候');
    const scout = snapshotEncounter(encounter).hand.find((card) => card.name === '斥候');
    if (!scout) throw new Error('missing scout');
    const played = playEncounterCard(encounter, { instanceId: scout.instanceId, cell: 9 });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(snapshotEncounter(played.encounter).points.player).toBe(4);

    const predicted = placeCarrionIntent(played.encounter.match.battle, played.encounter.match.revealed!);
    expect(predicted).not.toBe('skip');
    const ended = endEncounterTurn(played.encounter);
    const view = snapshotEncounter(ended);
    expect(ended.match.phase).toBe('playerAction');
    expect(ended.match.over).toBe(false);
    expect(view.intent?.name).toBe('托孤者');
    expect(view.cells.find((cell) => cell.name === '提灯人')?.cell).toBe(predicted);
    expect(view.cells.find((cell) => cell.name === '残影')).toBeUndefined();
    expect(view.cells.find((cell) => cell.cell === 9)).toMatchObject({ name: '斥候', points: 4 });
    expect(view.cells.find((cell) => cell.cell === 1)).toMatchObject({ name: '鸦巢', points: 2 });
  });

  it('skips 提灯人 when choosePlacement has no cell', () => {
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
    const lantern = carrionCard('提灯人').definition;
    expect(
      placeCarrionIntent(battle, {
        definitionId: lantern.id,
        name: lantern.name,
        owner: 'enemy',
        ruleType: 'field',
        basePoints: lantern.basePoints,
        swift: false,
      }),
    ).toBe('skip');
  });

  it('marks the clauses the kernel cannot run', () => {
    const entrusted = scriptedCarrion('托孤者');
    const bell = scriptedCarrion('引魂铃');
    expect(entrusted.status).toBe('script');
    expect(entrusted.definition.effects).toEqual([]);
    expect(entrusted.definition.onLeave).toEqual([
      { op: 'modPermanent', amount: 3, target: { ref: 'choice', index: 0 } },
    ]);
    expect(entrusted.definition.leaveTarget).toEqual({ owner: 'same' });
    expect(bell.status).toBe('script');
    expect(bell.definition.effects).toEqual([]);
    expect(bell.definition.reactions).toEqual([
      {
        event: 'left',
        onBoard: true,
        subject: { ownerRelation: 'same', field: true },
        effects: [{ op: 'draw', count: 1 }],
      },
    ]);
    expect(scriptedCarrion('骨匠').definition.effects).toEqual([
      { op: 'sacrifice', count: 2 },
      { op: 'draw', count: 1 },
    ]);
  });

  it('adds 2 to 鸦巢 and 守墓人 when a field card leaves, and 骨匠 sacrifices 2 then draws 1', () => {
    const nest = scriptedCarrion('鸦巢').definition;
    const keeper = scriptedCarrion('守墓人').definition;
    const scout = scriptedCard('斥候').definition;
    const drill = scriptedCard('钻心器').definition;
    const covered = playCard(
      createBattle({
        cards: [
          { definition: nest, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'nest' },
          { definition: keeper, owner: 'enemy', zone: 'board', cell: 4, instanceId: 'keeper' },
          { definition: scout, owner: 'player', zone: 'board', cell: 9, instanceId: 'scout' },
          { definition: drill, owner: 'enemy', zone: 'hand', instanceId: 'drill' },
        ],
      }),
      { instanceId: 'drill', cell: 9 },
    );
    expect(covered.ok).toBe(true);
    if (!covered.ok) return;
    expect(covered.state.instances.scout.zone).toBe('discard');
    expect(currentPoints(covered.state, 'nest')).toBe(4);
    expect(currentPoints(covered.state, 'keeper')).toBe(7);

    const bone = scriptedCarrion('骨匠').definition;
    const paid = playCard(
      createBattle({
        cards: [
          { definition: bone, owner: 'player', zone: 'hand', instanceId: 'bone' },
          { definition: scout, owner: 'player', zone: 'deck', instanceId: 'a' },
          { definition: scout, owner: 'player', zone: 'deck', instanceId: 'b' },
          { definition: scout, owner: 'player', zone: 'deck', instanceId: 'c' },
        ],
      }),
      { instanceId: 'bone', cell: 5 },
    );
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    expect(paid.state.cells[5]).toBe('bone');
    expect(currentPoints(paid.state, 'bone')).toBe(3);
    expect(paid.state.deck).toEqual([]);
    expect(paid.state.hand).toHaveLength(1);
    expect(paid.state.discard).toHaveLength(2);
    expect([...paid.state.hand, ...paid.state.discard].sort()).toEqual(['a', 'b', 'c']);
  });

  it('spawns one exhausted 2-point 残影 on the vacated cell and does not eat pollution', () => {
    const lantern = scriptedCarrion('提灯人').definition;
    const filler = scriptedCard('斥候').definition;
    const battle = createBattle({
      seed: 3,
      polluted: [1],
      cards: [
        { definition: lantern, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'lantern' },
        ...([2, 3, 4, 5, 6, 7, 8, 9] as CellId[]).map((cell) => ({
          definition: filler,
          owner: 'player' as const,
          zone: 'board' as const,
          cell,
          instanceId: `p${cell}`,
        })),
      ],
    });
    const rolled = nextInt(battle.rng, 1);
    const removed = executeOpcodes(battle, [{ op: 'remove', target: { ref: 'instance', id: 'lantern' } }], {
      selfId: 'lantern',
    });
    const shade = cardAt(removed, 1);
    expect(shade).not.toBeNull();
    if (!shade) return;
    expect(removed.definitions[shade.definitionId]?.name).toBe('残影');
    expect(removed.definitions[shade.definitionId]?.effects).toEqual([]);
    expect(shade.owner).toBe('enemy');
    expect(shade.basePoints).toBe(2);
    expect(shade.permanentMod).toBe(0);
    expect(shade.exhaust).toBe(true);
    expect(currentPoints(removed, shade.instanceId)).toBe(2);
    expect(removed.instances.lantern.zone).toBe('discard');
    expect(removed.log.some((line) => line === `enter:${shade.instanceId}`)).toBe(true);
    expect(removed.rng).toBe(rolled.rng);
    expect(cardAt(removed, 2)?.instanceId).toBe('p2');
  });

  it('gives another ally +3 when 托孤者 leaves, and skips the bonus when none remain', () => {
    const orphan = scriptedCarrion('托孤者').definition;
    const scout = scriptedCard('斥候').definition;
    const enemy = executeOpcodes(
      createBattle({
        cards: [
          { definition: orphan, owner: 'enemy', zone: 'board', cell: 9, instanceId: 'orphan' },
          { definition: scout, owner: 'enemy', zone: 'board', cell: 7, instanceId: 'high', permanentMod: 4 },
          { definition: scout, owner: 'enemy', zone: 'board', cell: 3, instanceId: 'low' },
        ],
      }),
      [{ op: 'remove', target: { ref: 'instance', id: 'orphan' } }],
      { selfId: 'orphan', leaveChoices: { orphan: 'low' } },
    );
    expect(enemy.instances.orphan.zone).toBe('discard');
    expect(enemy.instances.orphan.permanentMod).toBe(0);
    expect(currentPoints(enemy, 'high')).toBe(11);
    expect(currentPoints(enemy, 'low')).toBe(4);
    expect(enemy.leavePrompts).toEqual([]);

    const tied = executeOpcodes(
      createBattle({
        cards: [
          { definition: orphan, owner: 'enemy', zone: 'board', cell: 9, instanceId: 'orphan' },
          { definition: scout, owner: 'enemy', zone: 'board', cell: 7, instanceId: 'late' },
          { definition: scout, owner: 'enemy', zone: 'board', cell: 3, instanceId: 'early' },
        ],
      }),
      [{ op: 'remove', target: { ref: 'instance', id: 'orphan' } }],
      { selfId: 'orphan' },
    );
    expect(currentPoints(tied, 'early')).toBe(7);
    expect(currentPoints(tied, 'late')).toBe(4);

    const alone = executeOpcodes(
      createBattle({
        cards: [
          { definition: orphan, owner: 'enemy', zone: 'board', cell: 9, instanceId: 'orphan' },
          { definition: scout, owner: 'player', zone: 'board', cell: 1, instanceId: 'scout' },
        ],
      }),
      [{ op: 'remove', target: { ref: 'instance', id: 'orphan' } }],
      { selfId: 'orphan' },
    );
    expect(currentPoints(alone, 'scout')).toBe(4);
    expect(alone.instances.scout.permanentMod).toBe(0);
    expect(alone.leavePrompts).toEqual([]);

    const waiting = executeOpcodes(
      createBattle({
        cards: [
          { definition: orphan, owner: 'player', zone: 'board', cell: 5, instanceId: 'orphan' },
          { definition: scout, owner: 'player', zone: 'board', cell: 2, instanceId: 'low' },
          { definition: scout, owner: 'player', zone: 'board', cell: 8, instanceId: 'high', permanentMod: 5 },
        ],
      }),
      [{ op: 'remove', target: { ref: 'instance', id: 'orphan' } }],
      { selfId: 'orphan' },
    );
    expect(currentPoints(waiting, 'low')).toBe(4);
    expect(currentPoints(waiting, 'high')).toBe(9);
    expect(waiting.leavePrompts).toEqual([{ sourceId: 'orphan', targets: ['low', 'high'] }]);
    const chosen = resolveLeaveChoice(waiting, 'low');
    expect(currentPoints(chosen, 'low')).toBe(7);
    expect(currentPoints(chosen, 'high')).toBe(9);
    expect(chosen.leavePrompts).toEqual([]);
  });

  it('draws 1 when another allied field card leaves, and not for itself, a spell, or an enemy', () => {
    const bell = scriptedCarrion('引魂铃').definition;
    const scout = scriptedCard('斥候').definition;
    const top: CardDefinition = { id: 'top', name: 'top', ruleType: 'field', basePoints: 1, effects: [] };
    const rite: CardDefinition = { id: 'rite', name: 'rite', ruleType: 'spell', basePoints: null, effects: [] };
    const allyLeft = executeOpcodes(
      createBattle({
        cards: [
          { definition: bell, owner: 'player', zone: 'board', cell: 5, instanceId: 'bell' },
          { definition: scout, owner: 'player', zone: 'board', cell: 1, instanceId: 'ally' },
          { definition: top, owner: 'player', zone: 'deck', instanceId: 'top' },
        ],
      }),
      [{ op: 'remove', target: { ref: 'instance', id: 'ally' } }],
      { selfId: 'bell' },
    );
    expect(allyLeft.hand).toEqual(['top']);
    expect(allyLeft.deck).toEqual([]);
    expect(allyLeft.instances.ally.zone).toBe('discard');

    const selfLeft = executeOpcodes(
      createBattle({
        cards: [
          { definition: bell, owner: 'player', zone: 'board', cell: 5, instanceId: 'bell' },
          { definition: top, owner: 'player', zone: 'deck', instanceId: 'top' },
        ],
      }),
      [{ op: 'remove', target: { ref: 'instance', id: 'bell' } }],
      { selfId: 'bell' },
    );
    expect(selfLeft.hand).toEqual([]);
    expect(selfLeft.deck).toEqual(['top']);
    expect(selfLeft.instances.bell.zone).toBe('discard');

    const fromHand = executeOpcodes(
      createBattle({
        cards: [
          { definition: bell, owner: 'player', zone: 'hand', instanceId: 'bell' },
          { definition: scout, owner: 'player', zone: 'board', cell: 1, instanceId: 'ally' },
          { definition: top, owner: 'player', zone: 'deck', instanceId: 'top' },
        ],
      }),
      [{ op: 'remove', target: { ref: 'instance', id: 'ally' } }],
      { selfId: 'bell' },
    );
    expect(fromHand.hand).toEqual(['bell']);
    expect(fromHand.deck).toEqual(['top']);

    const spell = playCard(
      createBattle({
        cards: [
          { definition: bell, owner: 'player', zone: 'board', cell: 5, instanceId: 'bell' },
          { definition: rite, owner: 'player', zone: 'hand', instanceId: 'rite' },
          { definition: top, owner: 'player', zone: 'deck', instanceId: 'top' },
        ],
      }),
      { instanceId: 'rite' },
    );
    expect(spell.ok).toBe(true);
    if (!spell.ok) return;
    expect(spell.state.discard).toEqual(['rite']);
    expect(spell.state.hand).toEqual([]);
    expect(spell.state.deck).toEqual(['top']);

    const foeLeft = executeOpcodes(
      createBattle({
        cards: [
          { definition: bell, owner: 'player', zone: 'board', cell: 5, instanceId: 'bell' },
          { definition: scout, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'foe' },
          { definition: top, owner: 'player', zone: 'deck', instanceId: 'top' },
        ],
      }),
      [{ op: 'remove', target: { ref: 'instance', id: 'foe' } }],
      { selfId: 'bell' },
    );
    expect(foeLeft.hand).toEqual([]);
    expect(foeLeft.deck).toEqual(['top']);
  });
});
