import { describe, expect, it } from 'vitest';
import { getCardByName } from '../content';
import { createBattle, currentPoints, playCard, runEnemyTurnEndEffects, runTurnEndEffects, type Opcode } from '../rules';
import { scriptedCard } from './index';
import { PATROL_CARD_NAMES, patrolCard, patrolCards, scriptedPatrol } from './patrol';
import { endTurn, startMatch } from '../turn';

const UNIMPLEMENTED = new Set<Opcode['op']>([
  'lookTop',
  'search',
  'discardToHand',
  'discardToField',
  'shuffleIntoDeck',
  'shuffleCopy',
  'absorbAlly',
  'followUpPlay',
  'onDrawResolve',
]);

function walk(opcodes: Opcode[] | undefined): void {
  for (const opcode of opcodes ?? []) {
    expect(UNIMPLEMENTED.has(opcode.op)).toBe(false);
    if (opcode.op === 'armTimer') walk(opcode.onZero);
    if (opcode.op === 'forEach' || opcode.op === 'when') walk(opcode.effects);
    if (opcode.op === 'modPermanent') walk(opcode.onLeft);
  }
}

describe('patrol swarm scripts', () => {
  it('scripts a clause only when an opcode can run it', () => {
    expect(patrolCards.map((card) => card.name)).toEqual([...PATROL_CARD_NAMES]);
    for (const name of PATROL_CARD_NAMES) {
      const card = patrolCard(name);
      const content = getCardByName(name);
      expect(content?.id).toBe(card.id);
      expect(card.definition.id).toBe(content?.id);
      expect(card.definition.name).toBe(name);
      expect(card.definition.basePoints).toBe(content?.basePower);
      expect(card.definition.ruleType).toBe(content?.ruleKind === 'spell' ? 'spell' : 'field');
      walk(card.definition.effects);
      walk(card.definition.onTurnEnd);
      walk(card.definition.onEnemyTurnEnd);
      if (name === '蜂巢') expect(card.definition.onTurnEnd?.map((opcode) => opcode.op)).toEqual(['spawn']);
      else expect(card.definition.onTurnEnd).toBeUndefined();
      if (card.status === 'blocked') {
        expect(card.missing.length).toBeGreaterThan(0);
        expect(card.definition.effects).toEqual([]);
      }
    }

    expect(patrolCard('蜂巢').status).toBe('script');
    expect(patrolCard('测绘员').status).toBe('script');
    const probe = scriptedPatrol('巡检探头');
    const purge = scriptedPatrol('定点清除');
    expect(probe.blocked).toEqual([]);
    expect(purge.blocked).toEqual([]);
    expect(probe.definition.onEnemyTurnEnd?.some((opcode) => opcode.op === 'addMark' && opcode.pick === 'random')).toBe(true);
    expect(purge.definition.effects?.some((opcode) => opcode.op === 'draw')).toBe(false);
    expect(scriptedPatrol('工蜂').definition.exhaust).toBe(true);
    expect(scriptedPatrol('收容钳').blocked).toEqual([]);
  });

  it('marks only the chosen enemy when 巡检探头 enters', () => {
    const probe = scriptedPatrol('巡检探头');
    const foe = scriptedCard('斥候');
    const played = playCard(
      createBattle({
        cards: [
          { definition: probe.definition, owner: 'player', zone: 'hand', instanceId: 'probe' },
          { definition: foe.definition, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'picked' },
          { definition: foe.definition, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'other' },
        ],
      }),
      { instanceId: 'probe', cell: 9, choice: { targets: ['picked'] } },
    );
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.instances.picked.analyzed).toBe(true);
    expect(played.state.instances.other.analyzed).toBe(false);
    expect(played.state.instances.probe.analyzed).toBe(false);
  });

  it('removes a marked card at 3 or less when 收容钳 enters, and leaves anyone else', () => {
    const clamp = scriptedPatrol('收容钳');
    const foe = scriptedCard('斥候');
    const played = playCard(
      createBattle({
        cards: [
          { definition: clamp.definition, owner: 'player', zone: 'hand', instanceId: 'clamp' },
          {
            definition: foe.definition,
            owner: 'enemy',
            zone: 'board',
            cell: 1,
            instanceId: 'legal',
            analyzed: true,
            permanentMod: -2,
          },
          {
            definition: foe.definition,
            owner: 'enemy',
            zone: 'board',
            cell: 3,
            instanceId: 'tooHigh',
            analyzed: true,
          },
          { definition: foe.definition, owner: 'enemy', zone: 'board', cell: 9, instanceId: 'plain', permanentMod: -3 },
        ],
      }),
      { instanceId: 'clamp', cell: 2, choice: { targets: ['legal'] } },
    );
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.instances.legal.zone).toBe('discard');
    expect(played.state.cells[1]).toBeNull();
    expect(played.state.instances.tooHigh.zone).toBe('board');
    expect(played.state.instances.plain.zone).toBe('board');
    expect(played.state.instances.clamp.cell).toBe(2);

    const refused = playCard(
      createBattle({
        cards: [
          { definition: clamp.definition, owner: 'player', zone: 'hand', instanceId: 'clamp' },
          { definition: foe.definition, owner: 'enemy', zone: 'board', cell: 3, instanceId: 'tooHigh', analyzed: true },
        ],
      }),
      { instanceId: 'clamp', cell: 2, choice: { targets: ['tooHigh'] } },
    );
    expect(refused.ok).toBe(true);
    if (!refused.ok) return;
    expect(refused.state.instances.tooHigh.zone).toBe('board');
    expect(refused.state.instances.clamp.cell).toBe(2);
  });

  it('draws one after 定点清除 sends the marked card off, and does not draw when it stays', () => {
    const purge = scriptedPatrol('定点清除');
    const foe = scriptedCard('斥候');
    const deck = scriptedCard('钻心器');
    const played = playCard(
      createBattle({
        cards: [
          { definition: purge.definition, owner: 'player', zone: 'hand', instanceId: 'purge' },
          { definition: foe.definition, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'marked', analyzed: true },
          { definition: deck.definition, owner: 'player', zone: 'deck', instanceId: 'spare' },
        ],
      }),
      { instanceId: 'purge', choice: { targets: ['marked'] } },
    );
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.instances.marked.zone).toBe('discard');
    expect(played.state.cells[5]).toBeNull();
    expect(played.state.deck).toEqual([]);
    expect(played.state.hand).toEqual(['spare']);
    expect(played.state.log.indexOf('leave:marked')).toBeLessThan(played.state.log.indexOf('draw:spare'));

    const stayed = playCard(
      createBattle({
        cards: [
          { definition: purge.definition, owner: 'player', zone: 'hand', instanceId: 'purge' },
          {
            definition: foe.definition,
            owner: 'enemy',
            zone: 'board',
            cell: 5,
            instanceId: 'marked',
            analyzed: true,
            permanentMod: 4,
          },
          { definition: deck.definition, owner: 'player', zone: 'deck', instanceId: 'spare' },
        ],
      }),
      { instanceId: 'purge', choice: { targets: ['marked'] } },
    );
    expect(stayed.ok).toBe(true);
    if (!stayed.ok) return;
    expect(currentPoints(stayed.state, 'marked')).toBe(4);
    expect(stayed.state.instances.marked.zone).toBe('board');
    expect(stayed.state.deck).toEqual(['spare']);
    expect(stayed.state.hand).toEqual([]);
    expect(stayed.state.log.some((line) => line.startsWith('draw:'))).toBe(false);
  });

  it('exiles 工蜂 when it leaves, because it is exhaust and has no effect', () => {
    const bee = scriptedPatrol('工蜂');
    const drill = scriptedCard('钻心器');
    const played = playCard(
      createBattle({
        cards: [
          { definition: bee.definition, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'bee' },
          { definition: drill.definition, owner: 'player', zone: 'hand', instanceId: 'drill' },
        ],
      }),
      { instanceId: 'drill', cell: 1 },
    );
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(bee.definition.effects).toEqual([]);
    expect(played.state.instances.bee.zone).toBe('exile');
    expect(played.state.instances.drill.cell).toBe(1);
  });

  it('spawns one exhaust worker in a random adjacent empty cell when the hive owner ends the turn', () => {
    const hive = scriptedPatrol('蜂巢');
    const bee = scriptedPatrol('工蜂');
    const foe = scriptedCard('斥候');
    const neighbors = [2, 4, 6, 8] as const;

    const bornAt = (seed: number, owner: 'player' | 'enemy') => {
      const state = createBattle({
        seed,
        catalog: [bee.definition],
        polluted: [4],
        cards: [
          { definition: hive.definition, owner, zone: 'board', cell: 5, instanceId: 'hive' },
          { definition: foe.definition, owner: 'player', zone: 'board', cell: 2, instanceId: 'block2' },
          { definition: foe.definition, owner: 'player', zone: 'board', cell: 6, instanceId: 'block6' },
          { definition: foe.definition, owner: 'player', zone: 'board', cell: 8, instanceId: 'block8' },
        ],
      });
      return runTurnEndEffects(state, owner);
    };

    const quiet = runTurnEndEffects(
      createBattle({
        seed: 1,
        catalog: [bee.definition],
        cards: [{ definition: hive.definition, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'hive' }],
      }),
      'player',
    );
    expect(Object.values(quiet.instances).some((card) => quiet.definitions[card.definitionId]?.name === '工蜂')).toBe(false);

    const first = bornAt(1, 'enemy');
    const again = bornAt(1, 'enemy');
    const spawned = Object.values(first.instances).filter((card) => first.definitions[card.definitionId]?.name === '工蜂');
    expect(spawned).toHaveLength(1);
    expect(spawned[0]?.zone).toBe('board');
    expect(spawned[0]?.cell).toBe(4);
    expect(spawned[0]?.owner).toBe('enemy');
    expect(spawned[0]?.exhaust).toBe(true);
    expect(spawned[0]?.permanentMod).toBe(0);
    expect(spawned[0]?.basePoints).toBe(1);
    expect(again.instances[spawned[0]?.instanceId ?? '']?.cell).toBe(4);
    expect(first.log.some((line) => line.startsWith('enter:'))).toBe(true);
    expect(first.polluted).toContain(4);

    const cells = new Set<number>();
    for (let seed = 1; seed <= 16; seed += 1) {
      const open = runTurnEndEffects(
        createBattle({
          seed,
          catalog: [bee.definition],
          cards: [{ definition: hive.definition, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'hive' }],
        }),
        'enemy',
      );
      const worker = Object.values(open.instances).find((card) => open.definitions[card.definitionId]?.name === '工蜂');
      expect(neighbors).toContain(worker?.cell);
      if (worker?.cell) cells.add(worker.cell);
    }
    expect(cells.size).toBeGreaterThan(1);

    const full = runTurnEndEffects(
      createBattle({
        seed: 1,
        catalog: [bee.definition],
        cards: [
          { definition: hive.definition, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'hive' },
          ...neighbors.map((cell) => ({
            definition: foe.definition,
            owner: 'player' as const,
            zone: 'board' as const,
            cell,
            instanceId: `wall${cell}`,
          })),
        ],
      }),
      'enemy',
    );
    expect(Object.values(full.instances).some((card) => full.definitions[card.definitionId]?.name === '工蜂')).toBe(false);
    expect(full.rng).toBe(1);
  });

  it('marks one random unmarked enemy only from the enemy turn-end pipeline', () => {
    const probe = scriptedPatrol('巡检探头');
    const foe = scriptedCard('斥候');
    const field = (instanceId: string, cell: 1 | 3 | 7, analyzed = false) => ({
      definition: foe.definition,
      owner: 'enemy' as const,
      zone: 'board' as const,
      cell,
      instanceId,
      analyzed,
    });
    const battle = (seed: number, analyzed = false) =>
      createBattle({
        seed,
        cards: [
          { definition: probe.definition, owner: 'player', zone: 'board', cell: 5, instanceId: 'probe' },
          field('a', 1, analyzed),
          field('b', 3, analyzed),
          field('marked', 7, true),
        ],
      });

    const playerEnd = runTurnEndEffects(battle(4), 'player');
    const enemyOwnedEnd = runTurnEndEffects(battle(4), 'enemy');
    expect(playerEnd.instances.a.analyzed).toBe(false);
    expect(playerEnd.instances.b.analyzed).toBe(false);
    expect(enemyOwnedEnd.instances.a.analyzed).toBe(false);
    expect(enemyOwnedEnd.instances.b.analyzed).toBe(false);

    const markedIds = (seed: number) => {
      const next = runEnemyTurnEndEffects(battle(seed));
      return ['a', 'b'].filter((id) => next.instances[id].analyzed);
    };
    expect(markedIds(4)).toEqual(markedIds(4));
    expect(markedIds(4)).toHaveLength(1);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 24; seed += 1) {
      const picked = markedIds(seed);
      expect(picked).toHaveLength(1);
      seen.add(picked[0] ?? '');
    }
    expect(seen).toEqual(new Set(['a', 'b']));

    const done = runEnemyTurnEndEffects(battle(4, true));
    expect(done.instances.a.analyzed).toBe(true);
    expect(done.instances.b.analyzed).toBe(true);
    expect(done.rng).toBe(battle(4, true).rng);
    expect(done.log.some((line) => line.startsWith('enemy-turn-end:'))).toBe(true);

    const empty = createBattle({
      seed: 2,
      cards: [{ definition: probe.definition, owner: 'player', zone: 'board', cell: 5, instanceId: 'probe' }],
    });
    const idle = runEnemyTurnEndEffects(empty);
    expect(idle.instances.probe.analyzed).toBe(false);
    expect(idle.rng).toBe(empty.rng);

    const brick = scriptedCard('钻心器');
    const opened = () =>
      startMatch(
        {
          seed: 6,
          cards: [
            { definition: probe.definition, owner: 'player', zone: 'board', cell: 5, instanceId: 'probe' },
            field('a', 1),
            field('b', 3),
            ...Array.from({ length: 6 }, (_, index) => ({
              definition: brick.definition,
              owner: 'player' as const,
              zone: 'deck' as const,
              instanceId: `deck${index}`,
            })),
          ],
          intents: [{ definition: brick.definition, owner: 'enemy' as const }],
        },
        { placeIntent: () => 'skip' },
      );
    const ended = endTurn(opened());
    const again = endTurn(opened());
    const chosen = ['a', 'b'].filter((id) => ended.battle.instances[id].analyzed);
    expect(chosen).toHaveLength(1);
    expect(chosen).toEqual(['a', 'b'].filter((id) => again.battle.instances[id].analyzed));
    expect(ended.battle.instances.probe.analyzed).toBe(false);
  });

  it('marks the chosen enemy and the enemies orthogonal to that card', () => {
    const surveyor = scriptedPatrol('测绘员');
    const foe = scriptedCard('斥候');
    const played = playCard(
      createBattle({
        cards: [
          { definition: surveyor.definition, owner: 'player', zone: 'hand', instanceId: 'surveyor' },
          { definition: foe.definition, owner: 'enemy', zone: 'board', cell: 9, instanceId: 'chosen' },
          { definition: foe.definition, owner: 'enemy', zone: 'board', cell: 6, instanceId: 'besideChosen' },
          { definition: foe.definition, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'besideSurveyor' },
          { definition: foe.definition, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'apart' },
        ],
      }),
      { instanceId: 'surveyor', cell: 1, choice: { targets: ['chosen'] } },
    );
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.instances.chosen.analyzed).toBe(true);
    expect(played.state.instances.besideChosen.analyzed).toBe(true);
    expect(played.state.instances.besideSurveyor.analyzed).toBe(false);
    expect(played.state.instances.apart.analyzed).toBe(false);
    expect(played.state.instances.surveyor.analyzed).toBe(false);
    expect(played.state.instances.surveyor.cell).toBe(1);
  });
});
