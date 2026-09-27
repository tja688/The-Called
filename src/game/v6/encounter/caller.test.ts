import { describe, expect, it } from 'vitest';
import { getCardByName, getMonster } from '../content';
import { activeCoverThreshold, advanceTurnStart, cardAt, createBattle, currentPoints, executeOpcodes, unseal, type CardDefinition, type CellId } from '../rules';
import { nextInt } from '../rules/rng';
import { CALL_INSTANCE_ID, hugeCardBack, murmur, scriptedCaller, shuffleMurmur } from '../scripts/caller';
import { answerChoice, endTurn, play, startMatch } from '../turn';
import { endEncounterTurn, playEncounterCard, snapshotEncounter, type Encounter } from './index';
import { startCallerEncounter } from './caller';

function openingWith(name: string): Encounter {
  for (let seed = 1; seed < 80; seed += 1) {
    const encounter = startCallerEncounter(seed);
    if (snapshotEncounter(encounter).hand.some((card) => card.name === name)) return encounter;
  }
  throw new Error(`opening hand never contained ${name}`);
}

describe('caller encounter', () => {
  it('opens with 应召之核 on cell 5 at base 8, and 测绘员 as the first intent', () => {
    const encounter = startCallerEncounter(1);
    const view = snapshotEncounter(encounter);
    const monster = getMonster('the-caller');
    expect(encounter.match.phase).toBe('playerAction');
    expect(encounter.match.over).toBe(false);
    expect(view.cells.find((cell) => cell.cell === 5)).toMatchObject({
      name: '应召之核',
      owner: 'enemy',
      points: 8,
    });
    expect(view.cells.filter((cell) => cell.instanceId).map((cell) => cell.cell)).toEqual([5]);
    const id = encounter.match.battle.cells[5];
    expect(id).toBeTruthy();
    if (!id) return;
    const card = encounter.match.battle.instances[id];
    const definition = encounter.match.battle.definitions[card.definitionId];
    expect(card.basePoints).toBe(8);
    expect(definition?.basePoints).toBe(8);
    expect(definition?.name).toBe('应召之核');
    expect(activeCoverThreshold(encounter.match.battle, id)).toBe(14);
    expect(encounter.match.battle.instances[CALL_INSTANCE_ID]?.timer).toBe(2);
    expect(encounter.match.battle.instances[CALL_INSTANCE_ID]?.zone).toBe('exile');
    expect(view.intent).toEqual({
      name: '测绘员',
      effectText: getCardByName('测绘员')?.effectText,
    });
    expect(monster).toMatchObject({
      id: 'the-caller',
      skills: ['呼唤', '呓语'],
      presets: [{ cell: 5, cardName: '应召之核' }],
      intents: ['测绘员', '数据核心', '彼岸花', '圣女'],
      rewardGold: 200,
      rewardCardNames: ['测绘员', '数据核心', '彼岸花', '圣女'],
      rewardHugeCardBack: true,
    });
    expect(scriptedCaller('应召之核').definition.onTurnStart).toEqual([{ op: 'modPermanent', amount: 1, target: { ref: 'self' } }]);
  });

  it('lets the player play one card and end the turn', () => {
    const encounter = openingWith('斥候');
    const scout = snapshotEncounter(encounter).hand.find((card) => card.name === '斥候');
    if (!scout) throw new Error('missing scout');
    const played = playEncounterCard(encounter, { instanceId: scout.instanceId, cell: 9 });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    const ended = endEncounterTurn(played.encounter);
    const view = snapshotEncounter(ended);
    expect(ended.match.phase).toBe('playerAction');
    expect(ended.match.over).toBe(false);
    expect(ended.match.pendingChoice).toBeNull();
    expect(view.intent?.name).toBe('数据核心');
    expect(view.cells.find((cell) => cell.cell === 9)).toMatchObject({ name: '斥候', owner: 'player' });
    expect(view.cells.find((cell) => cell.cell === 5)?.name).toBe('应召之核');
    expect(ended.match.battle.instances[CALL_INSTANCE_ID]?.timer).toBe(1);
    expect(view.cells.some((cell) => cell.name === '测绘员')).toBe(true);
    const core = ended.match.battle.cells[5];
    expect(core).toBeTruthy();
    if (!core) return;
    expect(ended.match.battle.instances[core].permanentMod).toBe(1);
  });

  it('scripts 呓语 and 圣女, keeps the card back out of battle, and scripts 彼岸花', () => {
    const curse = scriptedCaller('呓语');
    expect(curse.definition.ruleType).toBe('spell');
    expect(curse.definition.basePoints).toBeNull();
    expect(curse.definition.effects).toEqual([]);
    expect(curse.definition.onDraw).toEqual([
      { op: 'modPermanent', amount: -2, target: { ref: 'query', owner: 'same', highest: true } },
    ]);
    expect(murmur).toMatchObject({ status: 'script', name: '呓语' });
    const saint = scriptedCaller('圣女');
    expect(saint.blocked).toEqual([]);
    expect(saint.definition.effects).toEqual([
      { op: 'grantAura', amount: 1, target: { ref: 'query', owner: 'same', hasProtect: true } },
    ]);
    expect(saint.definition.onTurnStart).toEqual([{ op: 'giveProtect', target: { ref: 'choice', index: 0 } }]);
    expect(saint.definition.turnStartTarget).toEqual({ owner: 'same' });
    expect(hugeCardBack).toMatchObject({ status: 'blocked', name: '巨大卡背' });
    const lily = scriptedCaller('彼岸花');
    const shadeId = getCardByName('残影')?.id;
    expect(shadeId).toBeTruthy();
    expect(lily.definition.effects).toEqual([]);
    expect(lily.definition.reactions).toEqual([
      {
        event: 'left',
        onBoard: true,
        subject: { ownerRelation: 'same' },
        effects: [{ op: 'spawn', definitionId: shadeId, cell: 'randomEmpty', owner: 'self', basePoints: 3 }],
      },
    ]);
  });

  it('spawns one exhausted 3-point 残影 when another ally leaves, in a cell the seed picks', () => {
    const lily = scriptedCaller('彼岸花').definition;
    const ally = scriptedCaller('应召之核').definition;
    const player = scriptedCaller('测绘员').definition;
    const battle = createBattle({
      seed: 11,
      polluted: [1, 3, 9],
      cards: [
        { definition: lily, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'lily' },
        { definition: ally, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'ally' },
        { definition: player, owner: 'player', zone: 'board', cell: 2, instanceId: 'player' },
        { definition: lily, owner: 'enemy', zone: 'hand', instanceId: 'held' },
        ...([4, 6, 7, 8] as CellId[]).map((cell) => ({
          definition: player,
          owner: 'player' as const,
          zone: 'board' as const,
          cell,
          instanceId: `wall${cell}`,
        })),
      ],
    });
    const ignored = executeOpcodes(battle, [{ op: 'remove', target: { ref: 'instance', id: 'player' } }], {
      selfId: 'lily',
    });
    expect(boardNames(ignored, '残影')).toEqual([]);
    expect(ignored.rng).toBe(battle.rng);

    const heldOnly = createBattle({
      seed: 11,
      cards: [
        { definition: lily, owner: 'enemy', zone: 'hand', instanceId: 'held' },
        { definition: ally, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'ally' },
      ],
    });
    const fromHand = executeOpcodes(heldOnly, [{ op: 'remove', target: { ref: 'instance', id: 'ally' } }], {
      selfId: 'held',
    });
    expect(boardNames(fromHand, '残影')).toEqual([]);

    const open: CellId[] = [1, 3, 9];
    const rolled = nextInt(battle.rng, open.length);
    const spawned = executeOpcodes(battle, [{ op: 'remove', target: { ref: 'instance', id: 'ally' } }], {
      selfId: 'lily',
    });
    expect(spawned.rng).toBe(rolled.rng);
    const shade = cardAt(spawned, open[rolled.n]);
    expect(shade).not.toBeNull();
    if (!shade) return;
    expect(spawned.definitions[shade.definitionId]?.name).toBe('残影');
    expect(spawned.definitions[shade.definitionId]?.effects).toEqual([]);
    expect(shade.owner).toBe('enemy');
    expect(shade.basePoints).toBe(3);
    expect(shade.permanentMod).toBe(0);
    expect(shade.exhaust).toBe(true);
    expect(currentPoints(spawned, shade.instanceId)).toBe(3);
    expect(boardNames(spawned, '残影')).toEqual([open[rolled.n]]);
    expect(spawned.log.some((line) => line === `enter:${shade.instanceId}`)).toBe(true);
  });

  it('spawns one more 残影 when that shade leaves, and still only one for that leave', () => {
    const lily = scriptedCaller('彼岸花').definition;
    const ally = scriptedCaller('应召之核').definition;
    const first = executeOpcodes(
      createBattle({
        seed: 2,
        cards: [
          { definition: lily, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'lily' },
          { definition: ally, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'ally' },
        ],
      }),
      [{ op: 'remove', target: { ref: 'instance', id: 'ally' } }],
      { selfId: 'lily' },
    );
    const born = boardNames(first, '残影');
    expect(born).toHaveLength(1);
    const shadeCell = born[0];
    if (shadeCell === undefined) return;
    const shadeId = first.cells[shadeCell];
    expect(shadeId).toBeTruthy();
    if (!shadeId) return;
    const again = executeOpcodes(first, [{ op: 'remove', target: { ref: 'instance', id: shadeId } }], { selfId: 'lily' });
    expect(again.instances[shadeId]?.zone).toBe('exile');
    const next = boardNames(again, '残影');
    expect(next).toHaveLength(1);
    const replacement = next[0] === undefined ? null : cardAt(again, next[0]);
    expect(replacement?.basePoints).toBe(3);
    expect(replacement?.instanceId).not.toBe(shadeId);
    expect(replacement?.exhaust).toBe(true);
  });

  it('does not spawn when 彼岸花 itself leaves or when the board has no empty cell', () => {
    const lily = scriptedCaller('彼岸花').definition;
    const ally = scriptedCaller('应召之核').definition;
    const selfLeft = executeOpcodes(
      createBattle({
        cards: [
          { definition: lily, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'lily' },
          { definition: ally, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'ally' },
        ],
      }),
      [{ op: 'remove', target: { ref: 'instance', id: 'lily' } }],
      { selfId: 'ally' },
    );
    expect(boardNames(selfLeft, '残影')).toEqual([]);
    expect(cardAt(selfLeft, 1)?.instanceId).toBe('ally');

    const plug: CardDefinition = {
      id: 'plug',
      name: 'plug',
      ruleType: 'field',
      basePoints: 4,
      onLeave: [{ op: 'spawn', definitionId: 'plug', cell: 1 }],
    };
    const filler = scriptedCaller('测绘员').definition;
    const packed = createBattle({
      seed: 8,
      cards: [
        { definition: plug, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'plug' },
        { definition: lily, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'lily' },
        ...([2, 3, 4, 6, 7, 8, 9] as CellId[]).map((cell) => ({
          definition: filler,
          owner: 'player' as const,
          zone: 'board' as const,
          cell,
          instanceId: `f${cell}`,
        })),
      ],
    });
    const stayed = executeOpcodes(packed, [{ op: 'remove', target: { ref: 'instance', id: 'plug' } }], { selfId: 'lily' });
    expect(stayed.rng).toBe(packed.rng);
    expect(boardNames(stayed, '残影')).toEqual([]);
    expect(cardAt(stayed, 1)?.definitionId).toBe('plug');
    expect(cardAt(stayed, 1)?.instanceId).not.toBe('plug');
  });

  it('shuffles one pointless 呓语 into the player deck at the enemy turn end', () => {
    const brick = scriptedCaller('测绘员').definition;
    const seeded = createBattle({
      seed: 4,
      cards: [
        { definition: brick, owner: 'player', zone: 'deck', instanceId: 'brick' },
        { definition: brick, owner: 'player', zone: 'board', cell: 1, instanceId: 'scout' },
      ],
    });
    const shuffled = shuffleMurmur(seeded);
    const added = Object.values(shuffled.instances).filter((card) => shuffled.definitions[card.definitionId]?.name === '呓语');
    expect(added).toHaveLength(1);
    const curse = added[0];
    if (!curse) return;
    expect(curse.basePoints).toBeNull();
    expect(curse.owner).toBe('player');
    expect(curse.zone).toBe('deck');
    expect(shuffled.deck).toContain(curse.instanceId);
    expect(shuffled.hand).not.toContain(curse.instanceId);
    expect(shuffled.deck).toHaveLength(seeded.deck.length + 1);
    expect(shuffled.rng).not.toBe(seeded.rng);

    const encounter = openingWith('斥候');
    const played = playEncounterCard(encounter, {
      instanceId: snapshotEncounter(encounter).hand.find((card) => card.name === '斥候')?.instanceId ?? '',
      cell: 9,
    });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    const ended = endEncounterTurn(played.encounter);
    const curses = Object.values(ended.match.battle.instances).filter(
      (card) => ended.match.battle.definitions[card.definitionId]?.name === '呓语',
    );
    expect(curses).toHaveLength(1);
    const live = curses[0];
    if (!live) return;
    expect(ended.match.battle.hand).not.toContain(live.instanceId);
    expect(live.basePoints).toBeNull();
    const scoutId = ended.match.battle.cells[9];
    expect(scoutId).toBeTruthy();
    if (!scoutId) return;
    if (ended.match.battle.discard.includes(live.instanceId)) {
      expect(ended.match.battle.instances[scoutId].permanentMod).toBe(-2);
      expect(currentPoints(ended.match.battle, scoutId)).toBe(2);
    } else {
      expect(ended.match.battle.deck).toContain(live.instanceId);
      expect(ended.match.battle.instances[scoutId].permanentMod).toBe(0);
    }
  });

  it('applies 呓语 on the opening four and on the one card drawn next turn', () => {
    const curse = scriptedCaller('呓语').definition;
    const brick: CardDefinition = { id: 'brick', name: 'brick', ruleType: 'field', basePoints: 1, effects: [] };
    const foe: CardDefinition = { id: 'foe', name: 'foe', ruleType: 'field', basePoints: 9, effects: [] };
    const opened = startMatch(
      {
        seed: 3,
        cards: [
          { definition: brick, owner: 'player', zone: 'board', cell: 1, instanceId: 'early', permanentMod: 4 },
          { definition: brick, owner: 'player', zone: 'board', cell: 9, instanceId: 'late', permanentMod: 4 },
          { definition: foe, owner: 'enemy', zone: 'board', cell: 4, instanceId: 'foe' },
          { definition: curse, owner: 'player', zone: 'deck', instanceId: 'curse' },
          { definition: brick, owner: 'player', zone: 'deck', instanceId: 'a' },
          { definition: brick, owner: 'player', zone: 'deck', instanceId: 'b' },
          { definition: brick, owner: 'player', zone: 'deck', instanceId: 'c' },
        ],
        intents: [{ definition: foe }],
      },
      { placeIntent: () => 'skip' },
    );
    expect(opened.phase).toBe('playerAction');
    expect(opened.playsRemaining).toBe(1);
    expect(opened.battle.hand).toHaveLength(3);
    expect(opened.battle.hand).not.toContain('curse');
    expect(opened.battle.discard).toContain('curse');
    expect(opened.battle.deck).toEqual([]);
    expect(opened.battle.instances.early.permanentMod).toBe(2);
    expect(currentPoints(opened.battle, 'early')).toBe(3);
    expect(opened.battle.instances.late.permanentMod).toBe(4);
    expect(opened.battle.instances.foe.permanentMod).toBe(0);

    const tall: CardDefinition = { id: 'tall', name: 'tall', ruleType: 'field', basePoints: 6, effects: [] };
    const later = startMatch(
      {
        seed: 5,
        cards: [
          { definition: tall, owner: 'player', zone: 'board', cell: 2, instanceId: 'body' },
          ...[0, 1, 2, 3, 4, 5].map((index) => ({
            definition: brick,
            owner: 'player' as const,
            zone: 'deck' as const,
            instanceId: `d${index}`,
          })),
        ],
        intents: [{ definition: foe }],
      },
      { placeIntent: () => 'skip' },
    );
    const stocked = shuffleMurmur(later.battle);
    const planted = Object.values(stocked.instances).find((card) => stocked.definitions[card.definitionId]?.name === '呓语');
    expect(planted).toBeTruthy();
    if (!planted) return;
    stocked.deck = [planted.instanceId, ...stocked.deck.filter((id) => id !== planted.instanceId)];
    const before = currentPoints(stocked, 'body');
    const ended = endTurn({ ...later, battle: stocked });
    expect(ended.phase).toBe('playerAction');
    expect(ended.playsRemaining).toBe(1);
    expect(ended.battle.hand).not.toContain(planted.instanceId);
    expect(ended.battle.discard).toContain(planted.instanceId);
    expect(ended.battle.instances.body.permanentMod).toBe(-2);
    expect(currentPoints(ended.battle, 'body')).toBe(before - 2);
    expect(ended.battle.deck[0]).not.toBe(planted.instanceId);
  });

  it('lets the player choose who 圣女 protects, and drops both sentences while she is sealed', () => {
    const saint = scriptedCaller('圣女').definition;
    const ally: CardDefinition = { id: 'ally', name: 'ally', ruleType: 'field', basePoints: 2, effects: [] };
    const high: CardDefinition = { id: 'high', name: 'high', ruleType: 'field', basePoints: 8, effects: [] };
    const waiting = startMatch(
      {
        seed: 2,
        cards: [
          { definition: saint, owner: 'player', zone: 'hand', instanceId: 'saint' },
          { definition: ally, owner: 'player', zone: 'board', cell: 1, instanceId: 'low' },
          { definition: high, owner: 'player', zone: 'board', cell: 9, instanceId: 'high' },
          { definition: ally, owner: 'player', zone: 'deck', instanceId: 'spare' },
        ],
        intents: [{ definition: high }],
      },
      { placeIntent: () => 'skip' },
    );
    expect(waiting.phase).toBe('playerTurnStart');
    expect(waiting.pendingChoice).toEqual({ sourceId: 'saint', targets: ['low', 'high'] });
    expect(waiting.battle.instances.low.protected).toBe(false);
    const ignored = answerChoice(waiting, 'missing');
    expect(ignored.pendingChoice?.sourceId).toBe('saint');
    const chosen = answerChoice(waiting, 'low');
    expect(chosen.phase).toBe('playerAction');
    expect(chosen.playsRemaining).toBe(1);
    expect(chosen.pendingChoice).toBeNull();
    expect(chosen.battle.instances.low.protected).toBe(true);
    expect(chosen.battle.instances.high.protected).toBe(false);
    expect(currentPoints(chosen.battle, 'low')).toBe(2);
    const played = play(chosen, { instanceId: 'saint', cell: 5 });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.match.battle.instances.low.protected).toBe(true);
    expect(currentPoints(played.match.battle, 'low')).toBe(3);
    expect(currentPoints(played.match.battle, 'high')).toBe(8);
    expect(currentPoints(played.match.battle, 'saint')).toBe(4);

    const sealed = executeOpcodes(played.match.battle, [{ op: 'seal', target: { ref: 'self' } }], { selfId: 'saint' });
    expect(sealed.instances.saint.sealed).toBe(true);
    expect(currentPoints(sealed, 'low')).toBe(2);
    const skipped = advanceTurnStart(sealed, 'player');
    expect(skipped.pending).toBeNull();
    expect(skipped.state.instances.high.protected).toBe(false);
    expect(skipped.state.instances.low.protected).toBe(true);
    const awake = unseal(sealed, 'player');
    expect(currentPoints(awake, 'low')).toBe(3);

    const nobody = advanceTurnStart(
      createBattle({
        cards: [{ definition: saint, owner: 'player', zone: 'hand', instanceId: 'saint' }],
      }),
      'player',
    );
    expect(nobody.pending).toBeNull();
    expect(nobody.state.instances.saint.protected).toBe(false);
  });

  it('has the enemy 圣女 protect the highest ally, and the lowest cell on a tie', () => {
    const saint = scriptedCaller('圣女').definition;
    const ally: CardDefinition = { id: 'ally', name: 'ally', ruleType: 'field', basePoints: 6, effects: [] };
    const brick: CardDefinition = { id: 'brick', name: 'brick', ruleType: 'field', basePoints: 1, effects: [] };
    const match = startMatch(
      {
        seed: 1,
        cards: [
          { definition: brick, owner: 'player', zone: 'deck', instanceId: 'brick' },
          { definition: ally, owner: 'enemy', zone: 'board', cell: 8, instanceId: 'east' },
          { definition: ally, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'west' },
          { definition: saint, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'saint' },
        ],
        intents: [{ definition: brick }],
      },
      { placeIntent: () => 'skip' },
    );
    const ended = endTurn(match);
    expect(ended.phase).toBe('playerAction');
    expect(ended.pendingChoice).toBeNull();
    expect(ended.battle.instances.west.protected).toBe(true);
    expect(ended.battle.instances.east.protected).toBe(false);
    expect(ended.battle.instances.saint.protected).toBe(false);
    expect(currentPoints(ended.battle, 'west')).toBe(6);
  });
});

function boardNames(state: { cells: Record<CellId, string | null>; instances: Record<string, { definitionId: string }>; definitions: Record<string, { name: string }> }, name: string): CellId[] {
  const found: CellId[] = [];
  for (const cell of [1, 2, 3, 4, 5, 6, 7, 8, 9] as CellId[]) {
    const id = state.cells[cell];
    if (!id) continue;
    const card = state.instances[id];
    if (state.definitions[card.definitionId]?.name === name) found.push(cell);
  }
  return found;
}
