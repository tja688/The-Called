import { describe, expect, it } from 'vitest';
import { getCardByName, getMonster } from '../content';
import { activeCoverThreshold, createBattle, playCard, type CardDefinition, type CardSetup } from '../rules';
import { scriptedCard } from '../scripts';
import { bellCard, scriptedBell } from '../scripts/bell';
import { endTurn, startMatch } from '../turn';
import { endEncounterTurn, playEncounterCard, snapshotEncounter, type Encounter } from './index';
import { bellBlockade, placeBellIntent, startBellEncounter } from './bell';

function openingWith(name: string): Encounter {
  for (let seed = 1; seed < 80; seed += 1) {
    const encounter = startBellEncounter(seed);
    if (snapshotEncounter(encounter).hand.some((card) => card.name === name)) return encounter;
  }
  throw new Error(`opening hand never contained ${name}`);
}

describe('bell warden encounter', () => {
  it('opens with 大钟 on cell 2, 发条卫兵 on cell 8, and 圣殿守卫 first', () => {
    const encounter = startBellEncounter(1);
    const view = snapshotEncounter(encounter);
    const monster = getMonster('bell-warden');
    expect(encounter.match.phase).toBe('playerAction');
    expect(encounter.match.over).toBe(false);
    expect(view.cells.find((cell) => cell.cell === 2)).toMatchObject({
      name: '大钟',
      owner: 'enemy',
      points: 6,
    });
    expect(view.cells.find((cell) => cell.cell === 8)).toMatchObject({
      name: '发条卫兵',
      owner: 'enemy',
      points: 4,
    });
    expect(view.cells.filter((cell) => cell.instanceId).map((cell) => cell.cell)).toEqual([2, 8]);
    expect(view.intent).toEqual({
      name: '圣殿守卫',
      effectText: getCardByName('圣殿守卫')?.effectText,
    });
    expect(view.points).toEqual({ player: 0, enemy: 10 });
    expect(monster).toMatchObject({
      id: 'bell-warden',
      skills: ['封锁'],
      presets: [
        { cell: 2, cardName: '大钟' },
        { cell: 8, cardName: '发条卫兵' },
      ],
      intents: ['圣殿守卫', '计时器', '穿甲钻头'],
      rewardGold: 150,
      rewardCardNames: ['圣殿守卫', '计时器', '穿甲钻头', '圣杯'],
      rewardHugeCardBack: true,
    });

    const bellId = encounter.match.battle.cells[2];
    expect(bellId).toBeTruthy();
    if (!bellId) return;
    expect(encounter.match.battle.instances[bellId]).toMatchObject({ timer: 3, timerMax: 3 });
    expect(activeCoverThreshold(encounter.match.battle, bellId)).toBe(10);
    expect(bellCard('大钟').definition.onTimer).toEqual([{ op: 'forceSettlement' }]);
    expect(bellCard('圣殿守卫').definition.effects).toEqual([
      { op: 'grantCoverThreshold', min: 8, target: { ref: 'self' } },
    ]);
    expect(bellCard('圣杯').definition.effects).toEqual([{ op: 'doubleFaith' }]);
    const drill = bellCard('穿甲钻头');
    expect(drill.status).toBe('script');
    if (drill.status === 'script') {
      expect(drill.blocked).toEqual([]);
      expect(drill.definition.playTarget).toEqual({ owner: 'opponent' });
      expect(drill.definition.playTargetCount).toBe(2);
      expect(drill.definition.effects).toEqual([
        { op: 'addMark', target: { ref: 'choice', index: 0 } },
        { op: 'addMark', target: { ref: 'choice', index: 1 } },
      ]);
    }
    expect(encounter.match.battle.log.some((line) => line.startsWith('enter:'))).toBe(false);
  });

  it('lets the player play one card and end the turn, then 圣殿守卫 lands beside the bell', () => {
    const encounter = openingWith('斥候');
    const scout = snapshotEncounter(encounter).hand.find((card) => card.name === '斥候');
    if (!scout) throw new Error('missing scout');
    const played = playEncounterCard(encounter, { instanceId: scout.instanceId, cell: 1 });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(snapshotEncounter(played.encounter).points.player).toBe(4);

    const predicted = placeBellIntent(played.encounter.match.battle, played.encounter.match.revealed!);
    expect(predicted).toBe(3);
    const ended = endEncounterTurn(played.encounter);
    const view = snapshotEncounter(ended);
    expect(ended.match.phase).toBe('playerAction');
    expect(ended.match.over).toBe(false);
    expect(view.intent?.name).toBe('计时器');
    expect(view.cells.find((cell) => cell.cell === 2)).toMatchObject({ name: '大钟', points: 6 });
    expect(view.cells.find((cell) => cell.cell === 8)).toMatchObject({ name: '发条卫兵', points: 4 });
    expect(view.cells.find((cell) => cell.name === '圣殿守卫')).toMatchObject({ cell: predicted, points: 4 });
    const bellId = ended.match.battle.cells[2];
    expect(bellId).toBeTruthy();
    if (!bellId) return;
    expect(ended.match.battle.instances[bellId].timer).toBe(2);
  });

  it('封锁 seals one player card on the enemy turn, and does nothing when none are out', () => {
    const scout = scriptedCard('斥候').definition;
    const open = createBattle({
      cards: [
        { definition: scout, owner: 'player', zone: 'board', cell: 1, instanceId: 'left' },
        { definition: scout, owner: 'player', zone: 'board', cell: 9, instanceId: 'right' },
        { definition: bellCard('发条卫兵').definition, owner: 'enemy', zone: 'board', cell: 8, instanceId: 'guard' },
      ],
    });
    const sealed = bellBlockade(open, 'enemy');
    const marked = [sealed.instances.left.sealed, sealed.instances.right.sealed].filter(Boolean);
    expect(marked).toHaveLength(1);
    expect(bellBlockade(open, 'player')).toBe(open);

    const empty = createBattle({
      cards: [{ definition: bellCard('大钟').definition, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'bell' }],
    });
    const idle = bellBlockade(empty, 'enemy');
    expect(idle).toBe(empty);
    expect(idle.rng).toBe(empty.rng);
  });

  it('lets the player mark two chosen enemies, and marks the only enemy when the board has one', () => {
    const drill = scriptedBell('穿甲钻头').definition;
    const foe: CardDefinition = { id: 'foe', name: 'foe', ruleType: 'field', basePoints: 3 };
    const played = playCard(
      createBattle({
        cards: [
          { definition: drill, owner: 'player', zone: 'hand', instanceId: 'drill' },
          { definition: foe, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'left', analyzed: true },
          { definition: foe, owner: 'enemy', zone: 'board', cell: 3, instanceId: 'mid' },
          { definition: foe, owner: 'enemy', zone: 'board', cell: 8, instanceId: 'right' },
        ],
      }),
      { instanceId: 'drill', cell: 5, choice: { targets: ['left', 'right'] } },
    );
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.instances.left.analyzed).toBe(true);
    expect(played.state.instances.right.analyzed).toBe(true);
    expect(played.state.instances.mid.analyzed).toBe(false);

    const lone = playCard(
      createBattle({
        cards: [
          { definition: drill, owner: 'player', zone: 'hand', instanceId: 'drill' },
          { definition: foe, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'only' },
        ],
      }),
      { instanceId: 'drill', cell: 9, choice: { targets: ['only'] } },
    );
    expect(lone.ok).toBe(true);
    if (!lone.ok) return;
    expect(lone.state.instances.only.analyzed).toBe(true);
    expect(lone.state.instances.drill.analyzed).toBe(false);
  });

  it('has the enemy mark the two highest foes, the smaller cell on a tie, and still the second card', () => {
    const drill = scriptedBell('穿甲钻头').definition;
    const body = (id: string, points: number): CardDefinition => ({
      id,
      name: id,
      ruleType: 'field',
      basePoints: points,
    });
    const bricks: CardSetup[] = Array.from({ length: 4 }, (_, index) => ({
      definition: body('brick', 1),
      owner: 'player',
      zone: 'deck',
      instanceId: `brick-${index}`,
    }));
    const ranked = endTurn(
      startMatch(
        {
          seed: 1,
          cards: [
            { definition: body('low', 2), owner: 'player', zone: 'board', cell: 1, instanceId: 'low' },
            { definition: body('high', 8), owner: 'player', zone: 'board', cell: 4, instanceId: 'high' },
            { definition: body('mid', 5), owner: 'player', zone: 'board', cell: 9, instanceId: 'mid' },
            ...bricks,
          ],
          intents: [{ definition: drill }],
        },
        { placeIntent: () => 7 },
      ),
    );
    expect(ranked.battle.cells[7]).toBeTruthy();
    expect(ranked.battle.instances.high.analyzed).toBe(true);
    expect(ranked.battle.instances.mid.analyzed).toBe(true);
    expect(ranked.battle.instances.low.analyzed).toBe(false);

    const tied = endTurn(
      startMatch(
        {
          seed: 2,
          cards: [
            { definition: body('early', 5), owner: 'player', zone: 'board', cell: 2, instanceId: 'early' },
            { definition: body('late', 5), owner: 'player', zone: 'board', cell: 9, instanceId: 'late' },
            { definition: body('middle', 5), owner: 'player', zone: 'board', cell: 6, instanceId: 'middle' },
            ...bricks,
          ],
          intents: [{ definition: drill }],
        },
        { placeIntent: () => 8 },
      ),
    );
    expect(tied.battle.instances.early.analyzed).toBe(true);
    expect(tied.battle.instances.middle.analyzed).toBe(true);
    expect(tied.battle.instances.late.analyzed).toBe(false);

    const second = endTurn(
      startMatch(
        {
          seed: 3,
          cards: [
            { definition: body('top', 8), owner: 'player', zone: 'board', cell: 1, instanceId: 'top', analyzed: true },
            { definition: body('next', 4), owner: 'player', zone: 'board', cell: 3, instanceId: 'next' },
            { definition: body('rest', 2), owner: 'player', zone: 'board', cell: 9, instanceId: 'rest' },
            ...bricks,
          ],
          intents: [{ definition: drill }],
        },
        { placeIntent: () => 7 },
      ),
    );
    expect(second.battle.instances.top.analyzed).toBe(true);
    expect(second.battle.instances.next.analyzed).toBe(true);
    expect(second.battle.instances.rest.analyzed).toBe(false);

    const only = endTurn(
      startMatch(
        {
          seed: 4,
          cards: [
            { definition: body('single', 3), owner: 'player', zone: 'board', cell: 1, instanceId: 'single' },
            ...bricks,
          ],
          intents: [{ definition: drill }],
        },
        { placeIntent: () => 9 },
      ),
    );
    expect(only.battle.instances.single.analyzed).toBe(true);
  });
});
