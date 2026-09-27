import { describe, expect, it } from 'vitest';
import { getCardByName, getMonster } from '../content';
import {
  cardAt,
  createBattle,
  currentPoints,
  executeOpcodes,
  playCard,
  runTurnStartEffects,
  unseal,
  type CardDefinition,
  type CellId,
} from '../rules';
import { mirrorReflection, scriptedWitch, witchCard } from '../scripts/witch';
import { endEncounterTurn, playEncounterCard, snapshotEncounter, type Encounter } from './index';
import { placeWitchIntent, startWitchEncounter } from './witch';

function openingWith(name: string): Encounter {
  for (let seed = 1; seed < 80; seed += 1) {
    const encounter = startWitchEncounter(seed);
    if (snapshotEncounter(encounter).hand.some((card) => card.name === name)) return encounter;
  }
  throw new Error(`opening hand never contained ${name}`);
}

describe('mirror witch encounter', () => {
  it('opens with 双生镜 on cells 2 and 8 at base 3, and 黑镜 as the first intent', () => {
    const encounter = startWitchEncounter(1);
    const view = snapshotEncounter(encounter);
    const monster = getMonster('mirror-witch');
    expect(encounter.match.phase).toBe('playerAction');
    expect(encounter.match.over).toBe(false);
    expect(view.cells.find((cell) => cell.cell === 2)).toMatchObject({
      name: '双生镜',
      owner: 'enemy',
      points: 5,
    });
    expect(view.cells.find((cell) => cell.cell === 8)).toMatchObject({
      name: '双生镜',
      owner: 'enemy',
      points: 5,
    });
    expect(view.cells.filter((cell) => cell.instanceId).map((cell) => cell.cell)).toEqual([2, 8]);
    for (const cell of [2, 8] as const) {
      const id = encounter.match.battle.cells[cell];
      expect(id).toBeTruthy();
      if (!id) return;
      const card = encounter.match.battle.instances[id];
      const definition = encounter.match.battle.definitions[card.definitionId];
      expect(card.basePoints).toBe(3);
      expect(card.permanentMod).toBe(0);
      expect(definition?.basePoints).toBe(3);
      expect(definition?.name).toBe('双生镜');
      expect(definition?.effects).toEqual([]);
    }
    expect(view.intent).toEqual({
      name: '黑镜',
      effectText: getCardByName('黑镜')?.effectText,
    });
    expect(view.points).toEqual({ player: 0, enemy: 10 });
    expect(monster).toMatchObject({
      id: 'mirror-witch',
      skills: ['镜像反射'],
      presets: [
        { cell: 2, cardName: '双生镜' },
        { cell: 8, cardName: '双生镜' },
      ],
      intents: ['黑镜', '夺舍者', '星盘'],
      rewardGold: 100,
      rewardCardNames: ['黑镜', '夺舍者', '星盘', '亡者低语', '冥河摆渡人'],
    });
    expect(witchCard('双生镜').status).toBe('script');
    expect(witchCard('双生镜').definition.basePoints).toBe(3);
    expect(mirrorReflection.status).toBe('script');
    expect(encounter.match.battle.log.some((line) => line.startsWith('enter:'))).toBe(false);
  });

  it('lets the player play one card and end the turn, then 黑镜 occupies and 夺舍者 is next', () => {
    const encounter = openingWith('斥候');
    const scout = snapshotEncounter(encounter).hand.find((card) => card.name === '斥候');
    if (!scout) throw new Error('missing scout');
    const played = playEncounterCard(encounter, { instanceId: scout.instanceId, cell: 9 });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(snapshotEncounter(played.encounter).points.player).toBe(4);
    expect(snapshotEncounter(played.encounter).cells.find((cell) => cell.name === '镜影')).toMatchObject({
      cell: 1,
      owner: 'enemy',
      points: 2,
    });

    const predicted = placeWitchIntent(played.encounter.match.battle, played.encounter.match.revealed!);
    expect(predicted).not.toBe('skip');
    const ended = endEncounterTurn(played.encounter);
    const view = snapshotEncounter(ended);
    expect(ended.match.phase).toBe('playerAction');
    expect(ended.match.over).toBe(false);
    expect(view.intent?.name).toBe('夺舍者');
    expect(view.cells.find((cell) => cell.name === '黑镜')?.cell).toBe(predicted);
    expect(view.cells.find((cell) => cell.name === '镜影')).toMatchObject({
      cell: 1,
      owner: 'enemy',
      points: 2,
    });
    expect(view.cells.find((cell) => cell.cell === 9)).toMatchObject({ name: '斥候', points: 4 });
    expect(view.cells.find((cell) => cell.cell === 2)).toMatchObject({ name: '双生镜', points: 5 });
    expect(view.cells.find((cell) => cell.cell === 8)).toMatchObject({ name: '双生镜', points: 5 });

    const again = endEncounterTurn(ended);
    const after = snapshotEncounter(again);
    const possessor = after.cells.find((cell) => cell.name === '夺舍者');
    expect(possessor).toMatchObject({ cell: 1, owner: 'enemy', points: 6 });
    expect(after.cells.some((cell) => cell.name === '镜影')).toBe(false);
    const possessorId = possessor?.instanceId;
    expect(possessorId).toBeTruthy();
    if (!possessorId) return;
    expect(again.match.battle.instances[possessorId]).toMatchObject({ basePoints: 4, permanentMod: 2 });
    expect(after.intent?.name).toBe('星盘');
    expect(after.cells.find((cell) => cell.cell === 9)).toMatchObject({ name: '斥候', points: 4 });
  });

  it('scripts the witch signatures, including 亡者低语 and 冥河摆渡人, and scripts 镜像反射', () => {
    expect(scriptedWitch('亡者低语').definition.ruleType).toBe('spell');
    expect(scriptedWitch('亡者低语').definition.effects).toEqual([
      {
        op: 'modPermanent',
        amount: { perOwnDiscard: -1, cap: 5 },
        target: { ref: 'choice', index: 0 },
      },
    ]);
    expect(scriptedWitch('亡者低语').definition.spellTarget).toEqual({ owner: 'opponent' });
    expect(scriptedWitch('亡者低语').blocked).toEqual([]);
    expect(witchCard('双生镜').definition.basePoints).toBe(3);
    expect(scriptedWitch('双生镜').definition.effects).toEqual([]);
    expect(scriptedWitch('双生镜').definition.presence).toEqual([
      { amount: 2, target: { owner: 'same', selfWhileAllyMirror: true } },
    ]);
    expect(scriptedWitch('黑镜').definition.effects).toEqual([]);
    expect(scriptedWitch('黑镜').definition.reactions).toEqual([
      {
        event: 'played',
        onBoard: true,
        subject: { ownerRelation: 'opponent', mirrorOfSelf: true },
        effects: [{ op: 'modPermanent', amount: -2, target: { ref: 'eventSubject' } }],
      },
    ]);
    expect(scriptedWitch('夺舍者').definition.effects).toEqual([{ op: 'absorbAlly' }]);
    expect(scriptedWitch('星盘').definition.effects).toEqual([]);
    expect(scriptedWitch('星盘').definition.presence).toEqual([
      { amount: 2, target: { owner: 'same', mirroredAlly: true } },
    ]);
    expect(scriptedWitch('冥河摆渡人').definition.onTurnStart).toEqual([{ op: 'sacrifice', count: 1 }]);
    expect(scriptedWitch('冥河摆渡人').definition.effects).toEqual([]);
    expect(scriptedWitch('冥河摆渡人').definition.presence).toEqual([
      { amount: 1, perOwnDiscard: true, target: { owner: 'same', self: true } },
    ]);
    expect(scriptedWitch('冥河摆渡人').blocked).toEqual([]);
    expect(mirrorReflection).toMatchObject({ status: 'script', name: '镜像反射' });
    expect(mirrorReflection.reactions).toEqual([
      {
        event: 'entered',
        subject: { owner: 'player' },
        effects: [
          {
            op: 'spawn',
            definitionId: getCardByName('镜影')?.id,
            cell: 'mirrorOfSubject',
            owner: 'enemy',
            basePoints: 'halfSubjectBase',
          },
        ],
      },
    ]);
  });

  it('shows 5 on paired 双生镜 while the printed base stays 3, and drops the aura when a source is sealed or a mirror ally leaves', () => {
    const twin = scriptedWitch('双生镜').definition;
    const pawn: CardDefinition = { id: 'pawn', name: 'pawn', ruleType: 'field', basePoints: 4 };
    const paired = createBattle({
      cards: [
        { definition: twin, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'a' },
        { definition: twin, owner: 'enemy', zone: 'board', cell: 8, instanceId: 'b' },
      ],
    });
    expect(currentPoints(paired, 'a')).toBe(5);
    expect(currentPoints(paired, 'b')).toBe(5);
    expect(paired.instances.a).toMatchObject({ basePoints: 3, permanentMod: 0 });
    expect(paired.instances.b).toMatchObject({ basePoints: 3, permanentMod: 0 });
    expect(paired.log.some((line) => line.startsWith('enter:'))).toBe(false);

    const crossed = createBattle({
      cards: [
        { definition: twin, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'a' },
        { definition: pawn, owner: 'player', zone: 'board', cell: 8, instanceId: 'pawn' },
      ],
    });
    expect(currentPoints(crossed, 'a')).toBe(3);

    const sealed = executeOpcodes(paired, [{ op: 'seal', target: { ref: 'self' } }], { selfId: 'a' });
    expect(currentPoints(sealed, 'a')).toBe(3);
    expect(currentPoints(sealed, 'b')).toBe(5);
    const awake = unseal(sealed, 'enemy');
    expect(currentPoints(awake, 'a')).toBe(5);
    expect(currentPoints(awake, 'b')).toBe(5);

    const left = executeOpcodes(awake, [{ op: 'remove', target: { ref: 'instance', id: 'a' } }], { selfId: 'b' });
    expect(left.instances.a.zone).not.toBe('board');
    expect(currentPoints(left, 'b')).toBe(3);
    expect(left.instances.b).toMatchObject({ basePoints: 3, permanentMod: 0 });
  });

  it('cuts the card played onto 黑镜 mirror by 2 after that card enters', () => {
    const black = scriptedWitch('黑镜').definition;
    const plain: CardDefinition = { id: 'plain', name: 'plain', ruleType: 'field', basePoints: 4 };
    const grower: CardDefinition = {
      id: 'grower',
      name: 'grower',
      ruleType: 'field',
      basePoints: 3,
      effects: [{ op: 'doubleBasePermanent', target: { ref: 'self' } }],
    };
    const ally: CardDefinition = { id: 'ally', name: 'ally', ruleType: 'field', basePoints: 2 };

    const grown = playCard(
      createBattle({
        cards: [
          { definition: black, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'black' },
          { definition: grower, owner: 'player', zone: 'hand', instanceId: 'grower' },
        ],
      }),
      { instanceId: 'grower', cell: 8 },
    );
    expect(grown.ok).toBe(true);
    if (!grown.ok) return;
    expect(grown.state.instances.grower.permanentMod).toBe(1);
    expect(currentPoints(grown.state, 'grower')).toBe(4);

    const cut = playCard(
      createBattle({
        cards: [
          { definition: black, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'black' },
          { definition: plain, owner: 'player', zone: 'hand', instanceId: 'plain' },
        ],
      }),
      { instanceId: 'plain', cell: 8 },
    );
    expect(cut.ok).toBe(true);
    if (!cut.ok) return;
    expect(cut.state.instances.plain.permanentMod).toBe(-2);
    expect(currentPoints(cut.state, 'plain')).toBe(2);

    const otherMirror = playCard(
      createBattle({
        cards: [
          { definition: black, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'black' },
          { definition: ally, owner: 'enemy', zone: 'board', cell: 4, instanceId: 'ally' },
          { definition: plain, owner: 'player', zone: 'hand', instanceId: 'plain' },
        ],
      }),
      { instanceId: 'plain', cell: 6 },
    );
    expect(otherMirror.ok).toBe(true);
    if (!otherMirror.ok) return;
    expect(otherMirror.state.instances.plain.permanentMod).toBe(0);

    const friendly = playCard(
      createBattle({
        cards: [
          { definition: black, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'black' },
          { definition: plain, owner: 'enemy', zone: 'hand', instanceId: 'plain' },
        ],
      }),
      { instanceId: 'plain', cell: 8 },
    );
    expect(friendly.ok).toBe(true);
    if (!friendly.ok) return;
    expect(friendly.state.instances.plain.permanentMod).toBe(0);

    const quiet = playCard(
      createBattle({
        cards: [
          { definition: black, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'black', sealed: true },
          { definition: plain, owner: 'player', zone: 'hand', instanceId: 'plain' },
        ],
      }),
      { instanceId: 'plain', cell: 8 },
    );
    expect(quiet.ok).toBe(true);
    if (!quiet.ok) return;
    expect(quiet.state.instances.plain.permanentMod).toBe(0);
  });

  it('replaces an allied card with 夺舍者 and keeps that card current points', () => {
    const twin = scriptedWitch('双生镜').definition;
    const host = scriptedWitch('夺舍者').definition;
    const foe: CardDefinition = { id: 'foe', name: 'foe', ruleType: 'field', basePoints: 2 };
    const taken = playCard(
      createBattle({
        cards: [
          { definition: host, owner: 'enemy', zone: 'hand', instanceId: 'host' },
          { definition: twin, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'a' },
          { definition: twin, owner: 'enemy', zone: 'board', cell: 8, instanceId: 'b' },
        ],
      }),
      { instanceId: 'host', cell: 2 },
    );
    expect(taken.ok).toBe(true);
    if (!taken.ok) return;
    expect(cardAt(taken.state, 2)?.instanceId).toBe('host');
    expect(taken.state.instances.a.zone).toBe('discard');
    expect(taken.state.instances.host).toMatchObject({ basePoints: 4, permanentMod: 5 });
    expect(currentPoints(taken.state, 'host')).toBe(9);
    expect(currentPoints(taken.state, 'b')).toBe(5);
    expect(taken.state.instances.b).toMatchObject({ basePoints: 3, permanentMod: 0 });
    const cleared = executeOpcodes(taken.state, [{ op: 'remove', target: { ref: 'instance', id: 'host' } }], { selfId: 'b' });
    expect(cardAt(cleared, 2)).toBeNull();
    expect(currentPoints(cleared, 'b')).toBe(3);

    const polluted = playCard(
      createBattle({
        polluted: [2],
        cards: [
          { definition: host, owner: 'enemy', zone: 'hand', instanceId: 'host' },
          { definition: twin, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'a' },
          { definition: twin, owner: 'enemy', zone: 'board', cell: 8, instanceId: 'b' },
        ],
      }),
      { instanceId: 'host', cell: 2 },
    );
    expect(polluted.ok).toBe(true);
    if (!polluted.ok) return;
    expect(polluted.state.instances.host.permanentMod).toBe(4);
    expect(currentPoints(polluted.state, 'host')).toBe(8);
    expect(polluted.state.polluted).toEqual([2]);

    const guarded = playCard(
      createBattle({
        cards: [
          { definition: host, owner: 'enemy', zone: 'hand', instanceId: 'host' },
          { definition: twin, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'a', protected: true },
          { definition: twin, owner: 'enemy', zone: 'board', cell: 8, instanceId: 'b' },
        ],
      }),
      { instanceId: 'host', cell: 2 },
    );
    expect(guarded.ok).toBe(true);
    if (!guarded.ok) return;
    expect(cardAt(guarded.state, 2)?.instanceId).toBe('a');
    expect(guarded.state.instances.a.protected).toBe(false);
    expect(guarded.state.instances.host.zone).toBe('discard');
    expect(guarded.state.instances.host.permanentMod).toBe(0);
    expect(currentPoints(guarded.state, 'a')).toBe(5);
    expect(guarded.state.log.some((line) => line === 'enter:host')).toBe(false);

    const empty = playCard(
      createBattle({
        cards: [{ definition: host, owner: 'enemy', zone: 'hand', instanceId: 'host' }],
      }),
      { instanceId: 'host', cell: 1 },
    );
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(cardAt(empty.state, 1)?.instanceId).toBe('host');
    expect(empty.state.instances.host).toMatchObject({ basePoints: 4, permanentMod: 0 });

    const covered = playCard(
      createBattle({
        cards: [
          { definition: host, owner: 'player', zone: 'hand', instanceId: 'host' },
          { definition: foe, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'foe' },
        ],
      }),
      { instanceId: 'host', cell: 1 },
    );
    expect(covered.ok).toBe(true);
    if (!covered.ok) return;
    expect(cardAt(covered.state, 1)?.instanceId).toBe('host');
    expect(covered.state.instances.host.permanentMod).toBe(-2);
    expect(covered.state.instances.foe.zone).not.toBe('board');
  });

  it('gives +2 to every allied mirror pair while 星盘 is active, and skips cell 5', () => {
    const twin = scriptedWitch('双生镜').definition;
    const star = scriptedWitch('星盘').definition;
    const body: CardDefinition = { id: 'body', name: 'body', ruleType: 'field', basePoints: 4 };
    const center: CardDefinition = { id: 'center', name: 'center', ruleType: 'field', basePoints: 6 };
    const board = createBattle({
      cards: [
        { definition: star, owner: 'enemy', zone: 'board', cell: 3, instanceId: 'star' },
        { definition: twin, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'a' },
        { definition: twin, owner: 'enemy', zone: 'board', cell: 8, instanceId: 'b' },
        { definition: body, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'p' },
        { definition: body, owner: 'enemy', zone: 'board', cell: 9, instanceId: 'q' },
        { definition: center, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'mid' },
        { definition: body, owner: 'player', zone: 'board', cell: 4, instanceId: 'playerA' },
        { definition: body, owner: 'player', zone: 'board', cell: 6, instanceId: 'playerB' },
      ],
    });
    expect(currentPoints(board, 'a')).toBe(7);
    expect(currentPoints(board, 'b')).toBe(7);
    expect(board.instances.a.permanentMod).toBe(0);
    expect(currentPoints(board, 'p')).toBe(6);
    expect(currentPoints(board, 'q')).toBe(6);
    expect(currentPoints(board, 'star')).toBe(4);
    expect(currentPoints(board, 'mid')).toBe(6);
    expect(currentPoints(board, 'playerA')).toBe(4);
    expect(currentPoints(board, 'playerB')).toBe(4);

    const sealed = executeOpcodes(board, [{ op: 'seal', target: { ref: 'self' } }], { selfId: 'star' });
    expect(currentPoints(sealed, 'a')).toBe(5);
    expect(currentPoints(sealed, 'p')).toBe(4);
    expect(currentPoints(sealed, 'mid')).toBe(6);
    const awake = unseal(sealed, 'enemy');
    expect(currentPoints(awake, 'a')).toBe(7);
    expect(currentPoints(awake, 'p')).toBe(6);

    const split = executeOpcodes(awake, [{ op: 'remove', target: { ref: 'instance', id: 'q' } }], { selfId: 'star' });
    expect(currentPoints(split, 'p')).toBe(4);
    expect(currentPoints(split, 'a')).toBe(7);
    expect(split.instances.p.permanentMod).toBe(0);
  });

  it('spawns an enemy 镜影 from the printed base, not the current points, and ignores pollution', () => {
    const carrier = witchCard('双生镜').definition;
    const odd: CardDefinition = { id: 'odd', name: 'odd', ruleType: 'field', basePoints: 5 };
    const entered = playCard(
      createBattle({
        polluted: [4, 6],
        catalog: [carrier],
        cards: [{ definition: odd, owner: 'player', zone: 'hand', instanceId: 'odd', permanentMod: 6 }],
      }),
      { instanceId: 'odd', cell: 4 },
    );
    expect(entered.ok).toBe(true);
    if (!entered.ok) return;
    const shade = cardAt(entered.state, 6);
    expect(shade).not.toBeNull();
    if (!shade) return;
    expect(entered.state.definitions[shade.definitionId]?.name).toBe('镜影');
    expect(entered.state.definitions[shade.definitionId]?.effects).toEqual([]);
    expect(shade.owner).toBe('enemy');
    expect(shade.basePoints).toBe(2);
    expect(shade.permanentMod).toBe(0);
    expect(shade.exhaust).toBe(true);
    expect(currentPoints(entered.state, 'odd')).toBe(10);
    expect(shadeNames(entered.state)).toEqual([6]);
    expect(entered.state.log.some((line) => line === `enter:${shade.instanceId}`)).toBe(true);
  });

  it('does not mirror cell 5, an occupied mirror, an enemy enter, or the shade itself', () => {
    const carrier = witchCard('双生镜').definition;
    const pawn: CardDefinition = { id: 'pawn', name: 'pawn', ruleType: 'field', basePoints: 4 };
    const eater: CardDefinition = {
      id: 'eater',
      name: 'eater',
      ruleType: 'field',
      basePoints: 1,
      reactions: [
        {
          event: 'entered',
          subject: { owner: 'player' },
          effects: [{ op: 'remove', target: { ref: 'eventSubject' } }],
        },
      ],
    };
    const center = playCard(
      createBattle({
        catalog: [carrier],
        cards: [{ definition: pawn, owner: 'player', zone: 'hand', instanceId: 'pawn' }],
      }),
      { instanceId: 'pawn', cell: 5 },
    );
    expect(center.ok).toBe(true);
    if (!center.ok) return;
    expect(shadeNames(center.state)).toEqual([]);
    expect(cardAt(center.state, 5)?.instanceId).toBe('pawn');

    const blockedMirror = playCard(
      createBattle({
        catalog: [carrier],
        cards: [
          { definition: pawn, owner: 'player', zone: 'hand', instanceId: 'pawn' },
          { definition: pawn, owner: 'enemy', zone: 'board', cell: 9, instanceId: 'wall' },
        ],
      }),
      { instanceId: 'pawn', cell: 1 },
    );
    expect(blockedMirror.ok).toBe(true);
    if (!blockedMirror.ok) return;
    expect(shadeNames(blockedMirror.state)).toEqual([]);
    expect(cardAt(blockedMirror.state, 9)?.instanceId).toBe('wall');

    const enemyEnter = playCard(
      createBattle({
        catalog: [carrier],
        cards: [{ definition: pawn, owner: 'enemy', zone: 'hand', instanceId: 'pawn' }],
      }),
      { instanceId: 'pawn', cell: 1 },
    );
    expect(enemyEnter.ok).toBe(true);
    if (!enemyEnter.ok) return;
    expect(shadeNames(enemyEnter.state)).toEqual([]);
    expect(cardAt(enemyEnter.state, 1)?.owner).toBe('enemy');

    const retracted = playCard(
      createBattle({
        catalog: [carrier],
        cards: [
          { definition: eater, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'eater' },
          { definition: pawn, owner: 'player', zone: 'hand', instanceId: 'pawn' },
        ],
      }),
      { instanceId: 'pawn', cell: 4 },
    );
    expect(retracted.ok).toBe(true);
    if (!retracted.ok) return;
    expect(cardAt(retracted.state, 4)).toBeNull();
    const shade = cardAt(retracted.state, 6);
    expect(shade?.owner).toBe('enemy');
    expect(shade?.basePoints).toBe(2);
    expect(shade?.exhaust).toBe(true);
    expect(shadeNames(retracted.state)).toEqual([6]);
  });

  it('cuts the chosen enemy by one per own discard card, capped at 5, and refuses a board with no enemy', () => {
    const whisper = scriptedWitch('亡者低语').definition;
    const foe: CardDefinition = { id: 'foe', name: 'foe', ruleType: 'field', basePoints: 8 };
    const scrap: CardDefinition = { id: 'scrap', name: 'scrap', ruleType: 'field', basePoints: 1 };

    const refused = playCard(
      createBattle({
        cards: [{ definition: whisper, owner: 'player', zone: 'hand', instanceId: 'whisper' }],
      }),
      { instanceId: 'whisper' },
    );
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.reason).toBe('no-target');
      expect(refused.state.hand).toEqual(['whisper']);
      expect(refused.state.discard).toEqual([]);
    }

    const empty = playCard(
      createBattle({
        cards: [
          { definition: whisper, owner: 'player', zone: 'hand', instanceId: 'whisper' },
          { definition: foe, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'foe' },
          { definition: foe, owner: 'enemy', zone: 'board', cell: 8, instanceId: 'other' },
        ],
      }),
      { instanceId: 'whisper', choice: { targets: ['foe'] } },
    );
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    expect(empty.state.instances.foe.permanentMod).toBe(0);
    expect(currentPoints(empty.state, 'foe')).toBe(8);
    expect(empty.state.instances.other.permanentMod).toBe(0);
    expect(empty.state.hand).not.toContain('whisper');
    expect(empty.state.discard).toEqual(['whisper']);

    const counted = playCard(
      createBattle({
        cards: [
          { definition: whisper, owner: 'player', zone: 'hand', instanceId: 'whisper' },
          { definition: foe, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'foe' },
          { definition: foe, owner: 'enemy', zone: 'board', cell: 8, instanceId: 'other' },
          { definition: scrap, owner: 'player', zone: 'discard', instanceId: 'own-1' },
          { definition: scrap, owner: 'player', zone: 'discard', instanceId: 'own-2' },
          { definition: scrap, owner: 'player', zone: 'discard', instanceId: 'own-3' },
          { definition: scrap, owner: 'enemy', zone: 'discard', instanceId: 'theirs' },
        ],
      }),
      { instanceId: 'whisper', choice: { targets: ['foe'] } },
    );
    expect(counted.ok).toBe(true);
    if (!counted.ok) return;
    expect(counted.state.instances.foe.permanentMod).toBe(-3);
    expect(currentPoints(counted.state, 'foe')).toBe(5);
    expect(counted.state.instances.other.permanentMod).toBe(0);

    const capped = playCard(
      createBattle({
        cards: [
          { definition: whisper, owner: 'player', zone: 'hand', instanceId: 'whisper' },
          { definition: foe, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'foe' },
          ...Array.from({ length: 6 }, (_, index) => ({
            definition: scrap,
            owner: 'player' as const,
            zone: 'discard' as const,
            instanceId: `pile-${index}`,
          })),
        ],
      }),
      { instanceId: 'whisper', choice: { targets: ['foe'] } },
    );
    expect(capped.ok).toBe(true);
    if (!capped.ok) return;
    expect(capped.state.instances.foe.permanentMod).toBe(-5);
    expect(currentPoints(capped.state, 'foe')).toBe(3);
  });

  it('adds one point per own discard card to 冥河摆渡人, keeps that aura when sacrifice fails, and drops it when sealed or gone', () => {
    const ferry = scriptedWitch('冥河摆渡人').definition;
    const scrap: CardDefinition = { id: 'scrap', name: 'scrap', ruleType: 'field', basePoints: 1 };
    const quiet: CardDefinition = { id: 'quiet', name: 'quiet', ruleType: 'spell', basePoints: null };

    const bare = createBattle({
      cards: [
        { definition: ferry, owner: 'player', zone: 'board', cell: 5, instanceId: 'ferry' },
        { definition: scrap, owner: 'player', zone: 'board', cell: 1, instanceId: 'ally' },
        { definition: quiet, owner: 'player', zone: 'hand', instanceId: 'quiet' },
      ],
    });
    expect(currentPoints(bare, 'ferry')).toBe(4);
    expect(bare.instances.ferry.permanentMod).toBe(0);
    expect(currentPoints(bare, 'ally')).toBe(1);
    const grown = playCard(bare, { instanceId: 'quiet' });
    expect(grown.ok).toBe(true);
    if (!grown.ok) return;
    expect(grown.state.discard).toEqual(['quiet']);
    expect(currentPoints(grown.state, 'ferry')).toBe(5);
    expect(grown.state.instances.ferry.permanentMod).toBe(0);
    expect(currentPoints(grown.state, 'ally')).toBe(1);

    const stocked = createBattle({
      cards: [
        { definition: ferry, owner: 'player', zone: 'board', cell: 5, instanceId: 'ferry' },
        { definition: scrap, owner: 'player', zone: 'discard', instanceId: 'own-1' },
        { definition: scrap, owner: 'player', zone: 'discard', instanceId: 'own-2' },
        { definition: scrap, owner: 'enemy', zone: 'discard', instanceId: 'theirs' },
        { definition: scrap, owner: 'player', zone: 'deck', instanceId: 'offering' },
      ],
    });
    expect(currentPoints(stocked, 'ferry')).toBe(6);
    const offered = runTurnStartEffects(stocked, 'player');
    expect(offered.deck).toEqual([]);
    expect(offered.discard).toEqual(['own-1', 'own-2', 'theirs', 'offering']);
    expect(currentPoints(offered, 'ferry')).toBe(7);
    expect(offered.instances.ferry.permanentMod).toBe(0);
    expect(offered.instances.ferry.sealed).toBe(false);

    const broke = createBattle({
      cards: [
        { definition: ferry, owner: 'player', zone: 'board', cell: 5, instanceId: 'ferry' },
        { definition: scrap, owner: 'player', zone: 'discard', instanceId: 'own-1' },
        { definition: scrap, owner: 'player', zone: 'discard', instanceId: 'own-2' },
      ],
    });
    const failed = runTurnStartEffects(broke, 'player');
    expect(failed.deck).toEqual([]);
    expect(failed.discard).toEqual(['own-1', 'own-2']);
    expect(failed.rng).toBe(broke.rng);
    expect(currentPoints(failed, 'ferry')).toBe(6);

    const sealed = executeOpcodes(failed, [{ op: 'seal', target: { ref: 'self' } }], { selfId: 'ferry' });
    expect(sealed.instances.ferry.zone).toBe('board');
    expect(currentPoints(sealed, 'ferry')).toBe(4);
    const awake = unseal(sealed, 'player');
    expect(currentPoints(awake, 'ferry')).toBe(6);

    const left = executeOpcodes(awake, [{ op: 'remove', target: { ref: 'self' } }], { selfId: 'ferry' });
    expect(left.instances.ferry.zone).toBe('discard');
    expect(left.instances.ferry.permanentMod).toBe(0);
    expect(currentPoints(left, 'ferry')).toBe(4);
  });
});

function shadeNames(state: { cells: Record<CellId, string | null>; instances: Record<string, { definitionId: string }>; definitions: Record<string, { name: string }> }): CellId[] {
  const found: CellId[] = [];
  for (const cell of [1, 2, 3, 4, 5, 6, 7, 8, 9] as CellId[]) {
    const id = state.cells[cell];
    if (!id) continue;
    const card = state.instances[id];
    if (state.definitions[card.definitionId]?.name === '镜影') found.push(cell);
  }
  return found;
}
