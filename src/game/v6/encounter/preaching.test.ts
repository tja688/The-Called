import { describe, expect, it } from 'vitest';
import { getCardByName, getMonster } from '../content';
import { createBattle, currentPoints, playCard, type CellId } from '../rules';
import { preachingCard, scriptedPreaching } from '../scripts/preaching';
import { scriptedCard } from '../scripts';
import { endTurn, startMatch } from '../turn';
import { endEncounterTurn, playEncounterCard, snapshotEncounter, type Encounter } from './index';
import { placePreachingIntent, startPreachingEncounter } from './preaching';

function openingWith(name: string): Encounter {
  for (let seed = 1; seed < 80; seed += 1) {
    const encounter = startPreachingEncounter(seed);
    if (snapshotEncounter(encounter).hand.some((card) => card.name === name)) return encounter;
  }
  throw new Error(`opening hand never contained ${name}`);
}

describe('preaching band encounter', () => {
  it('opens with the lectern on cell 2 and 辅祭 as the first intent', () => {
    const encounter = startPreachingEncounter(1);
    const view = snapshotEncounter(encounter);
    const monster = getMonster('preaching-band');
    expect(encounter.match.phase).toBe('playerAction');
    expect(encounter.match.over).toBe(false);
    expect(view.cells.find((cell) => cell.cell === 2)).toMatchObject({
      name: '讲经台',
      owner: 'enemy',
      points: 3,
      analyzed: false,
    });
    expect(view.cells.filter((cell) => cell.instanceId).map((cell) => cell.cell)).toEqual([2]);
    expect(view.intent).toEqual({
      name: '辅祭',
      effectText: getCardByName('辅祭')?.effectText,
    });
    expect(view.points).toEqual({ player: 0, enemy: 3 });
    expect(encounter.match.battle.faith).toEqual({ player: 0, enemy: 0 });
    expect(monster).toMatchObject({
      id: 'preaching-band',
      intents: ['辅祭', '神圣骑士', '审判官'],
      rewardGold: 50,
      rewardCardNames: ['辅祭', '神圣骑士', '审判官', '祷告灯'],
      presets: [{ cell: 2, cardName: '讲经台' }],
    });

    const lectern = view.cells.find((cell) => cell.cell === 2);
    const lecternCard = lectern?.instanceId ? encounter.match.battle.instances[lectern.instanceId] : undefined;
    const lecternDefinition = lecternCard ? encounter.match.battle.definitions[lecternCard.definitionId] : undefined;
    expect(lecternDefinition?.effects).toEqual([]);
    expect(lecternDefinition?.onTurnStart).toEqual([{ op: 'gainFaith', amount: 2 }]);
    const acolyte = encounter.match.revealed
      ? encounter.match.battle.definitions[encounter.match.revealed.definitionId]
      : undefined;
    expect(acolyte?.effects).toEqual([{ op: 'gainFaith', amount: 3 }]);
    expect(encounter.match.battle.log.some((line) => line.startsWith('enter:'))).toBe(false);
    const knight = preachingCard('神圣骑士');
    expect(knight.status).toBe('script');
    if (knight.status !== 'script') return;
    expect(knight.blocked).toEqual([]);
    expect(knight.definition.effects).toEqual([
      {
        op: 'ifFaith',
        atLeast: 4,
        then: [
          { op: 'giveProtect', target: { ref: 'self' } },
          { op: 'modPermanent', amount: 3, target: { ref: 'self' } },
        ],
        else: [{ op: 'gainFaith', amount: 1 }],
      },
    ]);
  });

  it('lets the player play one card and end the turn, then 辅祭 lands and faith rises', () => {
    const encounter = openingWith('斥候');
    const scout = snapshotEncounter(encounter).hand.find((card) => card.name === '斥候');
    if (!scout) throw new Error('missing scout');
    const played = playEncounterCard(encounter, { instanceId: scout.instanceId, cell: 9 });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(snapshotEncounter(played.encounter).points.player).toBe(4);

    const predicted = placePreachingIntent(played.encounter.match.battle, played.encounter.match.revealed!);
    expect(predicted).not.toBe('skip');
    const ended = endEncounterTurn(played.encounter);
    const view = snapshotEncounter(ended);
    expect(ended.match.phase).toBe('playerAction');
    expect(ended.match.over).toBe(false);
    expect(view.intent?.name).toBe('神圣骑士');
    expect(view.cells.find((cell) => cell.name === '辅祭')?.cell).toBe(predicted);
    expect(view.cells.find((cell) => cell.cell === 9)).toMatchObject({ name: '斥候', points: 4 });
    expect(view.cells.find((cell) => cell.name === '讲经台')).toMatchObject({ cell: 2, points: 3 });
    expect(ended.match.battle.faith).toEqual({ player: 0, enemy: 5 });
  });

  it('skips 辅祭 when choosePlacement has no cell', () => {
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
    const acolyte = scriptedPreaching('辅祭').definition;
    expect(
      placePreachingIntent(battle, {
        definitionId: acolyte.id,
        name: acolyte.name,
        owner: 'enemy',
        ruleType: 'field',
        basePoints: acolyte.basePoints,
        swift: false,
      }),
    ).toBe('skip');
  });

  it('gives 神圣骑士 protection and +3 when enemy faith is already at least 4, then 审判官 removes the highest unprotected card', () => {
    const knight = preachingCard('神圣骑士');
    expect(knight.status).toBe('script');
    if (knight.status !== 'script') return;
    expect(knight.blocked).toEqual([]);
    expect(knight.definition.effects).toEqual([
      {
        op: 'ifFaith',
        atLeast: 4,
        then: [
          { op: 'giveProtect', target: { ref: 'self' } },
          { op: 'modPermanent', amount: 3, target: { ref: 'self' } },
        ],
        else: [{ op: 'gainFaith', amount: 1 }],
      },
    ]);

    const scout = scriptedCard('斥候').definition;
    const drill = scriptedCard('钻心器').definition;
    const lectern = preachingCard('讲经台').definition;
    let match = startMatch(
      {
        seed: 3,
        cards: [
          { definition: lectern, owner: 'enemy', zone: 'board', cell: 2 },
          {
            definition: drill,
            owner: 'player',
            zone: 'board',
            cell: 1,
            instanceId: 'ward',
            permanentMod: 6,
            protected: true,
          },
          { definition: drill, owner: 'player', zone: 'board', cell: 3, instanceId: 'tall' },
          { definition: scout, owner: 'player', zone: 'board', cell: 9, instanceId: 'short' },
          ...Array.from({ length: 8 }, () => ({ definition: scout, owner: 'player' as const, zone: 'deck' as const })),
        ],
        intents: (['辅祭', '神圣骑士', '审判官'] as const).map((name) => ({
          definition: preachingCard(name).definition,
          owner: 'enemy' as const,
        })),
      },
      { placeIntent: placePreachingIntent },
    );

    match = endTurn(match);
    expect(match.over).toBe(false);
    expect(match.battle.faith.enemy).toBe(5);

    match = endTurn(match);
    expect(match.over).toBe(false);
    expect(match.battle.faith.enemy).toBe(7);
    const knightCard = Object.values(match.battle.instances).find(
      (card) => match.battle.definitions[card.definitionId]?.name === '神圣骑士',
    );
    expect(knightCard?.zone).toBe('board');
    expect(knightCard?.protected).toBe(true);
    expect(knightCard ? currentPoints(match.battle, knightCard.instanceId) : 0).toBe(8);
    expect(match.battle.faith.player).toBe(0);

    match = endTurn(match);
    expect(match.over).toBe(false);
    expect(match.battle.faith.enemy).toBe(5);
    expect(match.battle.instances.tall.zone).toBe('discard');
    expect(match.battle.instances.short.zone).toBe('board');
    expect(match.battle.instances.ward).toMatchObject({ zone: 'board', protected: true });
    expect(match.revealed?.name).toBe('辅祭');
  });

  it('does not spend faith when 审判官 has no unprotected player card', () => {
    const scout = scriptedCard('斥候').definition;
    const lectern = preachingCard('讲经台').definition;
    let match = startMatch(
      {
        seed: 4,
        cards: [
          { definition: lectern, owner: 'enemy', zone: 'board', cell: 2 },
          { definition: scout, owner: 'player', zone: 'board', cell: 1, instanceId: 'ward', protected: true },
          ...Array.from({ length: 8 }, () => ({ definition: scout, owner: 'player' as const, zone: 'deck' as const })),
        ],
        intents: (['辅祭', '审判官'] as const).map((name) => ({
          definition: preachingCard(name).definition,
          owner: 'enemy' as const,
        })),
      },
      { placeIntent: placePreachingIntent },
    );
    match = endTurn(match);
    match = endTurn(match);
    expect(match.over).toBe(false);
    expect(match.battle.faith.enemy).toBe(7);
    expect(match.battle.instances.ward).toMatchObject({ zone: 'board', protected: true });
    expect(
      Object.values(match.battle.instances).some(
        (card) => match.battle.definitions[card.definitionId]?.name === '审判官' && card.zone === 'board',
      ),
    ).toBe(true);
  });

  it('gives protection and 1 faith when 祷告灯 enters', () => {
    const lamp = preachingCard('祷告灯');
    expect(lamp.status).toBe('script');
    if (lamp.status !== 'script') return;
    expect(lamp.blocked).toEqual([]);
    const played = playCard(
      createBattle({
        cards: [
          { definition: lamp.definition, owner: 'player', zone: 'hand', instanceId: 'lamp' },
          { definition: scriptedCard('斥候').definition, owner: 'player', zone: 'board', cell: 1, instanceId: 'ally' },
        ],
      }),
      { instanceId: 'lamp', cell: 5, choice: { targets: ['ally'] } },
    );
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.instances.ally.protected).toBe(true);
    expect(played.state.instances.lamp.protected).toBe(false);
    expect(played.state.faith.player).toBe(1);
    expect(currentPoints(played.state, 'ally')).toBe(4);
  });

  it('protects 神圣骑士 and adds 3 points at faith 4 without spending it', () => {
    const knight = preachingCard('神圣骑士');
    expect(knight.status).toBe('script');
    if (knight.status !== 'script') return;
    const played = playCard(
      createBattle({
        faith: { player: 4, enemy: 0 },
        cards: [{ definition: knight.definition, owner: 'player', zone: 'hand', instanceId: 'knight' }],
      }),
      { instanceId: 'knight', cell: 5 },
    );
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.instances.knight.protected).toBe(true);
    expect(currentPoints(played.state, 'knight')).toBe(8);
    expect(played.state.faith).toEqual({ player: 4, enemy: 0 });
  });

  it('gives 神圣骑士 only 1 faith when the owner is below 4', () => {
    const knight = preachingCard('神圣骑士');
    expect(knight.status).toBe('script');
    if (knight.status !== 'script') return;
    const played = playCard(
      createBattle({
        faith: { player: 3, enemy: 9 },
        cards: [{ definition: knight.definition, owner: 'player', zone: 'hand', instanceId: 'knight' }],
      }),
      { instanceId: 'knight', cell: 5 },
    );
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.instances.knight.protected).toBe(false);
    expect(currentPoints(played.state, 'knight')).toBe(5);
    expect(played.state.faith).toEqual({ player: 4, enemy: 9 });
  });

  it('uses the enemy faith pool when the enemy plays 神圣骑士', () => {
    const knight = preachingCard('神圣骑士');
    expect(knight.status).toBe('script');
    if (knight.status !== 'script') return;

    const high = playCard(
      createBattle({
        faith: { player: 0, enemy: 4 },
        cards: [{ definition: knight.definition, owner: 'enemy', zone: 'hand', instanceId: 'knight' }],
      }),
      { instanceId: 'knight', cell: 5 },
    );
    expect(high.ok).toBe(true);
    if (!high.ok) return;
    expect(high.state.instances.knight.protected).toBe(true);
    expect(currentPoints(high.state, 'knight')).toBe(8);
    expect(high.state.faith).toEqual({ player: 0, enemy: 4 });

    const low = playCard(
      createBattle({
        faith: { player: 9, enemy: 3 },
        cards: [{ definition: knight.definition, owner: 'enemy', zone: 'hand', instanceId: 'foe' }],
      }),
      { instanceId: 'foe', cell: 6 },
    );
    expect(low.ok).toBe(true);
    if (!low.ok) return;
    expect(low.state.instances.foe.protected).toBe(false);
    expect(currentPoints(low.state, 'foe')).toBe(5);
    expect(low.state.faith).toEqual({ player: 9, enemy: 4 });
  });
});
