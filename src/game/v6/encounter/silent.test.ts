import { describe, expect, it } from 'vitest';
import { getCardByName, getMonster } from '../content';
import {
  advanceTurnStart,
  createBattle,
  currentPoints,
  executeOpcodes,
  playCard,
  totalPoints,
  type BattleState,
  type CellId,
} from '../rules';
import { scriptedCard } from '../scripts';
import { silentCard } from '../scripts/silent';
import { answerChoice, endTurn, play, startMatch } from '../turn';
import { endEncounterTurn, playEncounterCard, snapshotEncounter, type Encounter } from './index';
import { placeSilentIntent, startSilentEncounter } from './silent';

function openingWith(name: string): Encounter {
  for (let seed = 1; seed < 80; seed += 1) {
    const encounter = startSilentEncounter(seed);
    if (snapshotEncounter(encounter).hand.some((card) => card.name === name)) return encounter;
  }
  throw new Error(`opening hand never contained ${name}`);
}

describe('silent order encounter', () => {
  it('opens with the pillar on cell 5, pollution only on 4 and 6, and 告解神父 first', () => {
    const encounter = startSilentEncounter(1);
    const view = snapshotEncounter(encounter);
    const monster = getMonster('silent-order');
    expect(encounter.match.phase).toBe('playerAction');
    expect(encounter.match.over).toBe(false);
    expect(view.cells.find((cell) => cell.cell === 5)).toMatchObject({
      name: '缄默刑柱',
      owner: 'enemy',
      points: 5,
      analyzed: false,
    });
    expect(view.cells.filter((cell) => cell.instanceId).map((cell) => cell.cell)).toEqual([5]);
    expect(encounter.match.battle.polluted).toEqual([4, 6]);
    expect(view.intent).toEqual({
      name: '告解神父',
      effectText: getCardByName('告解神父')?.effectText,
    });
    expect(view.points).toEqual({ player: 0, enemy: 5 });
    expect(monster).toMatchObject({
      id: 'silent-order',
      skills: ['干扰'],
      intents: ['告解神父', '驱魔人', '大审判长'],
      presets: [{ cell: 5, cardName: '缄默刑柱' }],
      pollutedCells: [4, 6],
      rewardGold: 100,
      rewardCardNames: ['告解神父', '驱魔人', '大审判长', '庇佑祷词'],
    });

    const pillar = silentCard('缄默刑柱');
    expect(pillar.status).toBe('script');
    expect(pillar.definition.effects).toEqual([]);
    expect(pillar.definition.reactions?.[0]?.event).toBe('sealed');
    expect(silentCard('大审判长').status).toBe('script');
    expect(silentCard('大审判长').definition.effects).toEqual([]);
    expect(silentCard('大审判长').definition.onTurnStart).toEqual([{ op: 'seal', target: { ref: 'choice', index: 0 } }]);
    expect(silentCard('庇佑祷词').status).toBe('script');
    expect(silentCard('庇佑祷词').definition.spellNeeds).toBe('ally');
    expect(silentCard('庇佑祷词').definition.effects?.[0]?.op).toBe('ifFaith');
    const confessor = encounter.match.revealed
      ? encounter.match.battle.definitions[encounter.match.revealed.definitionId]
      : undefined;
    expect(confessor?.effects).toEqual([{ op: 'seal', target: { ref: 'choice', index: 0 } }]);
    expect(encounter.match.battle.log.some((line) => line.startsWith('enter:'))).toBe(false);
  });

  it('lets the player play one card and end the turn, then 告解神父 seals that card', () => {
    const encounter = openingWith('斥候');
    const scout = snapshotEncounter(encounter).hand.find((card) => card.name === '斥候');
    if (!scout) throw new Error('missing scout');
    const played = playEncounterCard(encounter, { instanceId: scout.instanceId, cell: 1 });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(snapshotEncounter(played.encounter).points.player).toBe(4);

    const predicted = placeSilentIntent(played.encounter.match.battle, played.encounter.match.revealed!);
    expect(predicted).toBe(2);
    const ended = endEncounterTurn(played.encounter);
    const view = snapshotEncounter(ended);
    expect(ended.match.phase).toBe('playerAction');
    expect(ended.match.over).toBe(false);
    expect(view.intent?.name).toBe('驱魔人');
    expect(view.cells.find((cell) => cell.name === '告解神父')).toMatchObject({ cell: predicted, points: 3 });
    expect(view.cells.find((cell) => cell.cell === 5)).toMatchObject({ name: '缄默刑柱', points: 7 });
    expect(view.cells.find((cell) => cell.cell === 1)).toMatchObject({ name: '斥候', points: 4 });
    expect(view.points).toEqual({ player: 4, enemy: 10 });
    expect(ended.match.battle.polluted).toEqual([4, 6]);
  });

  it('告解神父 seals the highest adjacent player card on entry', () => {
    const scout = scriptedCard('斥候').definition;
    const confessor = silentCard('告解神父').definition;
    const battle = createBattle({
      cards: [
        { definition: scout, owner: 'player', zone: 'board', cell: 1, instanceId: 'scout' },
        { definition: scout, owner: 'player', zone: 'board', cell: 9, instanceId: 'low', permanentMod: -3 },
        { definition: confessor, owner: 'enemy', zone: 'hand', instanceId: 'priest' },
      ],
    });
    const cell = placeSilentIntent(battle, {
      definitionId: confessor.id,
      name: '告解神父',
      owner: 'enemy',
      ruleType: 'field',
      basePoints: confessor.basePoints,
      swift: false,
    });
    expect(cell).toBe(2);
    if (cell === 'skip') return;
    const played = playCard(battle, { instanceId: 'priest', cell });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.instances.scout.sealed).toBe(true);
    expect(played.state.instances.low.sealed).toBe(false);
    expect(played.state.instances.priest).toMatchObject({ zone: 'board', cell: 2 });
  });

  it('places 大审判长 on the least-adjacent empty cell, and skips when nothing is legal', () => {
    const scout = scriptedCard('斥候').definition;
    const inquisitor = silentCard('大审判长').definition;
    const open = createBattle({
      cards: [{ definition: scout, owner: 'player', zone: 'board', cell: 5, instanceId: 'mid' }],
      catalog: [inquisitor],
    });
    expect(
      placeSilentIntent(open, {
        definitionId: inquisitor.id,
        name: '大审判长',
        owner: 'enemy',
        ruleType: 'field',
        basePoints: inquisitor.basePoints,
        swift: false,
      }),
    ).toBe(1);

    const full = createBattle({
      cards: ([1, 2, 3, 4, 5, 6, 7, 8, 9] as CellId[]).map((cell) => ({
        definition: scout,
        owner: 'player' as const,
        zone: 'board' as const,
        cell,
        instanceId: `p${cell}`,
        permanentMod: 6,
      })),
      catalog: [inquisitor],
    });
    expect(
      placeSilentIntent(full, {
        definitionId: inquisitor.id,
        name: '大审判长',
        owner: 'enemy',
        ruleType: 'field',
        basePoints: inquisitor.basePoints,
        swift: false,
      }),
    ).toBe('skip');
  });

  it('驱魔人 removes the highest card at 3 points or below, and enters when none qualify', () => {
    const scout = scriptedCard('斥候').definition;
    const pillar = silentCard('缄默刑柱').definition;
    const exorcist = silentCard('驱魔人').definition;
    let match = startMatch(
      {
        seed: 2,
        cards: [
          { definition: pillar, owner: 'enemy', zone: 'board', cell: 5 },
          { definition: scout, owner: 'player', zone: 'board', cell: 1, instanceId: 'tall', permanentMod: 2 },
          { definition: scout, owner: 'player', zone: 'board', cell: 9, instanceId: 'short', permanentMod: -2 },
          ...Array.from({ length: 8 }, () => ({ definition: scout, owner: 'player' as const, zone: 'deck' as const })),
        ],
        polluted: [4, 6],
        intents: [{ definition: exorcist, owner: 'enemy' }],
      },
      { placeIntent: placeSilentIntent },
    );
    match = endTurn(match);
    expect(match.over).toBe(false);
    expect(match.battle.instances.short.zone).toBe('discard');
    expect(match.battle.instances.tall.zone).toBe('board');
    expect(match.battle.polluted).toEqual([4, 6]);
    expect(
      Object.values(match.battle.instances).some(
        (card) => match.battle.definitions[card.definitionId]?.name === '驱魔人' && card.zone === 'board',
      ),
    ).toBe(true);

    let quiet = startMatch(
      {
        seed: 3,
        cards: [
          { definition: pillar, owner: 'enemy', zone: 'board', cell: 5 },
          { definition: scout, owner: 'player', zone: 'board', cell: 1, instanceId: 'tall', permanentMod: 2 },
          ...Array.from({ length: 8 }, () => ({ definition: scout, owner: 'player' as const, zone: 'deck' as const })),
        ],
        polluted: [4, 6],
        intents: [{ definition: exorcist, owner: 'enemy' }],
      },
      { placeIntent: placeSilentIntent },
    );
    quiet = endTurn(quiet);
    expect(quiet.over).toBe(false);
    expect(quiet.battle.instances.tall).toMatchObject({ zone: 'board', sealed: false });
    expect(
      Object.values(quiet.battle.instances).some(
        (card) => quiet.battle.definitions[card.definitionId]?.name === '驱魔人' && card.zone === 'board',
      ),
    ).toBe(true);
    expect(quiet.battle.polluted).toEqual([4, 6]);
  });

  it('缄默刑柱 gains 2 when an opponent is sealed, and ignores transfer, allies, and a second seal', () => {
    const pillar = silentCard('缄默刑柱').definition;
    const scout = scriptedCard('斥候').definition;
    const state = createBattle({
      cards: [
        { definition: pillar, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'pillar' },
        { definition: scout, owner: 'player', zone: 'board', cell: 1, instanceId: 'scout' },
        { definition: scout, owner: 'enemy', zone: 'board', cell: 9, instanceId: 'mate' },
      ],
      polluted: [4, 6],
    });
    const moved = executeOpcodes(
      state,
      [{ op: 'transferOwner', target: { ref: 'instance', id: 'scout' }, to: 'enemy' }],
      { selfId: 'pillar', controller: 'enemy' },
    );
    expect(moved.instances.scout).toMatchObject({ owner: 'enemy', sealed: false });
    expect(moved.instances.pillar.permanentMod).toBe(0);
    expect(currentPoints(moved, 'pillar')).toBe(5);
    expect(moved.polluted).toEqual([4, 6]);

    const ally = executeOpcodes(state, [{ op: 'seal', target: { ref: 'instance', id: 'mate' } }], { selfId: 'pillar' });
    expect(ally.instances.mate.sealed).toBe(true);
    expect(ally.instances.pillar.permanentMod).toBe(0);

    const sealed = executeOpcodes(state, [{ op: 'seal', target: { ref: 'instance', id: 'scout' } }], { selfId: 'pillar' });
    expect(sealed.instances.scout.sealed).toBe(true);
    expect(sealed.instances.pillar.permanentMod).toBe(2);
    expect(currentPoints(sealed, 'pillar')).toBe(7);
    const again = executeOpcodes(sealed, [{ op: 'seal', target: { ref: 'instance', id: 'scout' } }], { selfId: 'pillar' });
    expect(again.instances.pillar.permanentMod).toBe(2);

    const asleep = createBattle({
      cards: [
        { definition: pillar, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'pillar', sealed: true },
        { definition: scout, owner: 'player', zone: 'board', cell: 1, instanceId: 'scout' },
      ],
    });
    const missed = executeOpcodes(asleep, [{ op: 'seal', target: { ref: 'instance', id: 'scout' } }], {
      selfId: 'pillar',
    });
    expect(missed.instances.scout.sealed).toBe(true);
    expect(missed.instances.pillar.permanentMod).toBe(0);
  });

  it('lets the player choose who 大审判长 seals, and grows 缄默刑柱', () => {
    const judge = silentCard('大审判长').definition;
    const pillar = silentCard('缄默刑柱').definition;
    const scout = scriptedCard('斥候').definition;
    const waiting = startMatch(
      {
        seed: 1,
        cards: [
          { definition: judge, owner: 'player', zone: 'board', cell: 5, instanceId: 'judge' },
          { definition: pillar, owner: 'player', zone: 'board', cell: 3, instanceId: 'pillar' },
          { definition: scout, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'low' },
          { definition: scout, owner: 'enemy', zone: 'board', cell: 9, instanceId: 'high', permanentMod: 2 },
        ],
        intents: [{ definition: scout, owner: 'enemy' }],
      },
      { placeIntent: () => 'skip' },
    );
    expect(waiting.phase).toBe('playerTurnStart');
    expect(waiting.pendingChoice).toEqual({ sourceId: 'judge', targets: ['low', 'high'] });
    const ignored = answerChoice(waiting, 'missing');
    expect(ignored.pendingChoice?.sourceId).toBe('judge');
    expect(ignored.battle.instances.low.sealed).toBe(false);
    const chosen = answerChoice(waiting, 'low');
    expect(chosen.phase).toBe('playerAction');
    expect(chosen.battle.instances.low.sealed).toBe(true);
    expect(chosen.battle.instances.high.sealed).toBe(false);
    expect(chosen.battle.instances.pillar.permanentMod).toBe(2);
    expect(currentPoints(chosen.battle, 'pillar')).toBe(7);
    expect(chosen.battle.polluted).toEqual([]);
  });

  it('has the enemy 大审判长 seal the highest foe, the lowest cell on a tie, and skip when sealed or empty', () => {
    const judge = silentCard('大审判长').definition;
    const pillar = silentCard('缄默刑柱').definition;
    const scout = scriptedCard('斥候').definition;
    const captured: { battle: BattleState | null } = { battle: null };
    const ended = endTurn(
      startMatch(
        {
          seed: 2,
          cards: [
            { definition: judge, owner: 'enemy', zone: 'board', cell: 3, instanceId: 'judge' },
            { definition: pillar, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'pillar' },
            { definition: scout, owner: 'player', zone: 'board', cell: 2, instanceId: 'short' },
            { definition: scout, owner: 'player', zone: 'board', cell: 9, instanceId: 'tall', permanentMod: 2 },
            ...Array.from({ length: 8 }, () => ({ definition: scout, owner: 'player' as const, zone: 'deck' as const })),
          ],
          polluted: [4, 6],
          intents: [{ definition: scout, owner: 'enemy' as const }],
        },
        {
          placeIntent: () => 'skip',
          onSideTurnStart(battle, side) {
            if (side === 'enemy') captured.battle = structuredClone(battle);
            return battle;
          },
        },
      ),
    );
    expect(captured.battle?.instances.tall.sealed).toBe(true);
    expect(captured.battle?.instances.short.sealed).toBe(false);
    expect(captured.battle?.instances.pillar.permanentMod).toBe(2);
    expect(currentPoints(captured.battle ?? ended.battle, 'pillar')).toBe(7);
    expect(captured.battle?.polluted).toEqual([4, 6]);
    expect(ended.battle.polluted).toEqual([4, 6]);
    expect(ended.battle.instances.pillar.permanentMod).toBe(2);

    const tied: { battle: BattleState | null } = { battle: null };
    endTurn(
      startMatch(
        {
          seed: 3,
          cards: [
            { definition: judge, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'judge' },
            { definition: scout, owner: 'player', zone: 'board', cell: 8, instanceId: 'east' },
            { definition: scout, owner: 'player', zone: 'board', cell: 2, instanceId: 'west' },
            ...Array.from({ length: 8 }, () => ({ definition: scout, owner: 'player' as const, zone: 'deck' as const })),
          ],
          polluted: [4, 6],
          intents: [{ definition: scout, owner: 'enemy' as const }],
        },
        {
          placeIntent: () => 'skip',
          onSideTurnStart(battle, side) {
            if (side === 'enemy') tied.battle = structuredClone(battle);
            return battle;
          },
        },
      ),
    );
    expect(tied.battle?.instances.west.sealed).toBe(true);
    expect(tied.battle?.instances.east.sealed).toBe(false);
    expect(tied.battle?.polluted).toEqual([4, 6]);

    const held = advanceTurnStart(
      createBattle({
        cards: [
          { definition: judge, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'judge', sealed: true },
          { definition: scout, owner: 'player', zone: 'board', cell: 1, instanceId: 'prey' },
        ],
      }),
      'enemy',
    );
    expect(held.pending).toBeNull();
    expect(held.state.instances.prey.sealed).toBe(false);

    const nobody = advanceTurnStart(
      createBattle({
        cards: [{ definition: judge, owner: 'player', zone: 'board', cell: 5, instanceId: 'judge' }],
      }),
      'player',
    );
    expect(nobody.pending).toBeNull();
    expect(nobody.state.instances.judge.sealed).toBe(false);
  });

  it('庇佑祷词 protects one ally and clears the negative the player picks', () => {
    const prayer = silentCard('庇佑祷词').definition;
    const scout = scriptedCard('斥候').definition;
    const board = createBattle({
      faith: { player: 2 },
      cards: [
        { definition: prayer, owner: 'player', zone: 'hand', instanceId: 'prayer' },
        {
          definition: scout,
          owner: 'player',
          zone: 'board',
          cell: 1,
          instanceId: 'host',
          sealed: true,
          permanentMod: -2,
          analyzed: true,
        },
        { definition: scout, owner: 'player', zone: 'board', cell: 3, instanceId: 'other', sealed: true },
        { definition: scout, owner: 'enemy', zone: 'board', cell: 9, instanceId: 'foe', sealed: true, permanentMod: -2 },
      ],
    });
    const refused = playCard(board, { instanceId: 'prayer' });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.reason).toBe('no-target');
    expect(refused.state.instances.host.protected).toBe(false);

    const clearedSeal = playCard(board, { instanceId: 'prayer', choice: { targets: ['host'], negative: 'seal' } });
    expect(clearedSeal.ok).toBe(true);
    if (!clearedSeal.ok) return;
    expect(clearedSeal.state.instances.host).toMatchObject({
      sealed: false,
      permanentMod: -2,
      analyzed: true,
      protected: true,
    });
    expect(clearedSeal.state.instances.other.protected).toBe(false);
    expect(clearedSeal.state.instances.foe).toMatchObject({ sealed: true, protected: false, permanentMod: -2 });
    expect(clearedSeal.state.faith.player).toBe(2);
    expect(currentPoints(clearedSeal.state, 'host')).toBe(2);
    expect(totalPoints(clearedSeal.state, 'player')).toBe(2);

    const clearedDebuff = playCard(
      createBattle({
        faith: { player: 2 },
        cards: [
          { definition: prayer, owner: 'player', zone: 'hand', instanceId: 'prayer' },
          {
            definition: scout,
            owner: 'player',
            zone: 'board',
            cell: 1,
            instanceId: 'host',
            sealed: true,
            permanentMod: -2,
            analyzed: true,
          },
        ],
      }),
      { instanceId: 'prayer', choice: { targets: ['host'], negative: 'debuff' } },
    );
    expect(clearedDebuff.ok).toBe(true);
    if (!clearedDebuff.ok) return;
    expect(clearedDebuff.state.instances.host).toMatchObject({
      sealed: true,
      permanentMod: -1,
      analyzed: true,
      protected: true,
    });
    expect(currentPoints(clearedDebuff.state, 'host')).toBe(3);
    expect(totalPoints(clearedDebuff.state, 'player')).toBe(0);
  });

  it('庇佑祷词 at faith 3 covers every ally, and cannot be played with none', () => {
    const prayer = silentCard('庇佑祷词').definition;
    const scout = scriptedCard('斥候').definition;
    const empty = playCard(
      createBattle({
        faith: { player: 5 },
        cards: [
          { definition: prayer, owner: 'player', zone: 'hand', instanceId: 'prayer' },
          { definition: scout, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'foe' },
        ],
      }),
      { instanceId: 'prayer' },
    );
    expect(empty.ok).toBe(false);
    if (empty.ok) return;
    expect(empty.state.instances.prayer.zone).toBe('hand');
    expect(empty.state.faith.player).toBe(5);

    const mass = playCard(
      createBattle({
        faith: { player: 3 },
        cards: [
          { definition: prayer, owner: 'player', zone: 'hand', instanceId: 'prayer' },
          {
            definition: scout,
            owner: 'player',
            zone: 'board',
            cell: 1,
            instanceId: 'both',
            sealed: true,
            permanentMod: -3,
            analyzed: true,
          },
          { definition: scout, owner: 'player', zone: 'board', cell: 3, instanceId: 'only', sealed: true },
          { definition: scout, owner: 'player', zone: 'board', cell: 7, instanceId: 'marked', permanentMod: 1, analyzed: true },
          { definition: scout, owner: 'enemy', zone: 'board', cell: 9, instanceId: 'foe', sealed: true, permanentMod: -2 },
        ],
        polluted: [4, 6],
      }),
      {
        instanceId: 'prayer',
        choice: { negatives: { both: 'debuff', only: 'seal' } },
      },
    );
    expect(mass.ok).toBe(true);
    if (!mass.ok) return;
    expect(mass.state.faith.player).toBe(3);
    expect(mass.state.instances.both).toMatchObject({
      sealed: true,
      permanentMod: -2,
      analyzed: true,
      protected: true,
    });
    expect(currentPoints(mass.state, 'both')).toBe(2);
    expect(mass.state.instances.only).toMatchObject({ sealed: false, protected: true, analyzed: false });
    expect(mass.state.instances.marked).toMatchObject({
      permanentMod: 1,
      analyzed: true,
      protected: true,
      sealed: false,
    });
    expect(currentPoints(mass.state, 'marked')).toBe(5);
    expect(mass.state.instances.foe).toMatchObject({ sealed: true, protected: false, permanentMod: -2 });
    expect(mass.state.polluted).toEqual([4, 6]);
  });
});
