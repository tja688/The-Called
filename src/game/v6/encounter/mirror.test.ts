import { describe, expect, it } from 'vitest';
import { getCardByName } from '../content';
import { cardAt, createBattle, currentPoints, executeOpcodes, hasLegalPlay, playCard, type CellId } from '../rules';
import { scriptedCard } from '../scripts';
import { mirrorCard, scriptedMirror } from '../scripts/mirror';
import { endTurn, startMatch, type RevealedIntent } from '../turn';
import type { CardDefinition } from '../rules';
import { endEncounterTurn, playEncounterCard, snapshotEncounter, type Encounter } from './index';
import { placeMirrorIntent, startMirrorEncounter } from './mirror';

function openingWith(name: string): Encounter {
  for (let seed = 1; seed < 80; seed += 1) {
    const encounter = startMirrorEncounter(seed);
    if (snapshotEncounter(encounter).hand.some((card) => card.name === name)) return encounter;
  }
  throw new Error(`opening hand never contained ${name}`);
}

function revealed(definition: CardDefinition): RevealedIntent {
  return {
    definitionId: definition.id,
    name: definition.name,
    owner: 'enemy',
    ruleType: definition.ruleType,
    basePoints: definition.basePoints,
    swift: false,
    effects: definition.effects ? structuredClone(definition.effects) : undefined,
  };
}

describe('mirror person encounter', () => {
  it('opens with 古镜 on cell 5 and 镜匠 as the first intent', () => {
    const encounter = startMirrorEncounter(1);
    const view = snapshotEncounter(encounter);
    expect(encounter.match.phase).toBe('playerAction');
    expect(encounter.match.over).toBe(false);
    expect(view.cells.find((cell) => cell.cell === 5)).toMatchObject({
      name: '古镜',
      owner: 'enemy',
      points: 4,
    });
    expect(view.cells.filter((cell) => cell.instanceId).map((cell) => cell.cell)).toEqual([5]);
    expect(view.intent).toEqual({
      name: '镜匠',
      effectText: getCardByName('镜匠')?.effectText,
    });
    expect(view.points).toEqual({ player: 0, enemy: 4 });
    const ancient = mirrorCard('古镜');
    expect(ancient.status).toBe('script');
    if (ancient.status !== 'script') return;
    expect(ancient.definition.reactions).toEqual([
      {
        event: 'played',
        subject: { ownerRelation: 'same', onMirrorOf: 'opponent' },
        effects: [{ op: 'modPermanent', amount: 2, target: { ref: 'eventSubject' } }],
      },
    ]);
    const seated = view.cells.find((cell) => cell.cell === 5);
    const seatedCard = seated?.instanceId ? encounter.match.battle.instances[seated.instanceId] : undefined;
    const seatedDefinition = seatedCard ? encounter.match.battle.definitions[seatedCard.definitionId] : undefined;
    expect(seatedDefinition?.reactions).toEqual(ancient.definition.reactions);
    expect(encounter.match.battle.log.some((line) => line.startsWith('enter:'))).toBe(false);
  });

  it('lets the player play one card and end the turn, then 镜匠 cuts that mirror by 3', () => {
    const encounter = openingWith('斥候');
    const scout = snapshotEncounter(encounter).hand.find((card) => card.name === '斥候');
    if (!scout) throw new Error('missing scout');
    const played = playEncounterCard(encounter, { instanceId: scout.instanceId, cell: 1 });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(snapshotEncounter(played.encounter).points.player).toBe(4);

    const predicted = placeMirrorIntent(played.encounter.match.battle, played.encounter.match.revealed!);
    expect(predicted).toBe(9);
    const deckBefore = played.encounter.match.battle.deck.length;
    const ended = endEncounterTurn(played.encounter);
    const view = snapshotEncounter(ended);
    expect(ended.match.phase).toBe('playerAction');
    expect(ended.match.over).toBe(false);
    expect(view.intent?.name).toBe('银镜');
    expect(view.cells.find((cell) => cell.name === '镜匠')?.cell).toBe(9);
    expect(view.cells.find((cell) => cell.cell === 1)).toMatchObject({ name: '斥候', points: 1 });
    expect(ended.match.battle.instances[scout.instanceId].permanentMod).toBe(-3);
    expect(ended.match.battle.deck.length).toBe(deckBefore - 1);
    expect(view.cells.find((cell) => cell.cell === 5)).toMatchObject({ name: '古镜', points: 4 });
  });

  it('scripts 古镜, 双生子, and 镜面翻转', () => {
    expect(scriptedMirror('古镜').definition.reactions?.[0]?.effects).toEqual([
      { op: 'modPermanent', amount: 2, target: { ref: 'eventSubject' } },
    ]);
    expect(scriptedMirror('双生子').definition.effects).toEqual([
      {
        op: 'when',
        query: { owner: 'same', mirrorOfSource: true },
        effects: [
          { op: 'modPermanent', amount: 2, target: { ref: 'query', owner: 'same', mirrorOfSource: true } },
          { op: 'modPermanent', amount: 2, target: { ref: 'self' } },
        ],
      },
    ]);
    expect(scriptedMirror('镜面翻转').definition.effects).toEqual([
      { op: 'moveToMirror', target: { ref: 'choice', index: 0 } },
      { op: 'draw', count: 1 },
    ]);
    expect(scriptedMirror('镜面翻转').definition.spellTarget).toEqual({ owner: 'same', emptyMirror: true });
    expect(scriptedMirror('镜匠').definition.effects).toEqual([
      { op: 'sacrifice', count: 1 },
      { op: 'modPermanent', amount: -3, target: { ref: 'choice', index: 0 } },
    ]);
    expect(scriptedMirror('银镜').definition.effects).toEqual([
      { op: 'grantAura', amount: 2, target: { ref: 'query', owner: 'same', mirrorOfSource: true } },
    ]);
  });

  it('gives a friendly card permanent +2 after it is played onto an enemy mirror cell', () => {
    const ancient = scriptedMirror('古镜').definition;
    const scout = scriptedCard('斥候').definition;
    const mover = {
      id: 'mirror-mover',
      name: 'mirror-mover',
      ruleType: 'field' as const,
      basePoints: 4,
      effects: [{ op: 'modPermanent' as const, amount: 1, target: { ref: 'self' as const } }],
    };
    const state = createBattle({
      cards: [
        { definition: ancient, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'ancient' },
        { definition: scout, owner: 'player', zone: 'board', cell: 1, instanceId: 'watched' },
        { definition: mover, owner: 'enemy', zone: 'hand', instanceId: 'friendly' },
      ],
    });
    const hit = playCard(state, { instanceId: 'friendly', cell: 9 });
    expect(hit.ok).toBe(true);
    if (!hit.ok) return;
    expect(hit.state.instances.friendly.permanentMod).toBe(3);
    expect(hit.state.log.indexOf('enter:friendly')).toBeLessThan(hit.state.log.indexOf('react:ancient:played'));

    const missed = playCard(
      createBattle({
        cards: [
          { definition: ancient, owner: 'enemy', zone: 'board', cell: 4, instanceId: 'ancient' },
          { definition: mover, owner: 'enemy', zone: 'hand', instanceId: 'friendly' },
        ],
      }),
      { instanceId: 'friendly', cell: 2 },
    );
    expect(missed.ok).toBe(true);
    if (!missed.ok) return;
    expect(missed.state.instances.friendly.permanentMod).toBe(1);

    const center = playCard(
      createBattle({
        cards: [
          { definition: ancient, owner: 'enemy', zone: 'board', cell: 4, instanceId: 'ancient' },
          { definition: mover, owner: 'enemy', zone: 'hand', instanceId: 'friendly' },
        ],
      }),
      { instanceId: 'friendly', cell: 5 },
    );
    expect(center.ok).toBe(true);
    if (!center.ok) return;
    expect(center.state.instances.friendly.permanentMod).toBe(1);

    const otherSide = playCard(
      createBattle({
        cards: [
          { definition: ancient, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'ancient' },
          { definition: scout, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'watched' },
          { definition: mover, owner: 'player', zone: 'hand', instanceId: 'friendly' },
        ],
      }),
      { instanceId: 'friendly', cell: 9 },
    );
    expect(otherSide.ok).toBe(true);
    if (!otherSide.ok) return;
    expect(otherSide.state.instances.friendly.permanentMod).toBe(1);

    const spawned = executeOpcodes(
      createBattle({
        catalog: [scout],
        cards: [
          { definition: ancient, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'ancient' },
          { definition: scout, owner: 'player', zone: 'board', cell: 1, instanceId: 'watched' },
          { definition: scout, owner: 'enemy', zone: 'board', cell: 3, instanceId: 'source' },
        ],
      }),
      [{ op: 'spawn', definitionId: scout.id, cell: 9, owner: 'self' }],
      { selfId: 'source' },
    );
    expect(cardAt(spawned, 9)?.permanentMod).toBe(0);
    expect(spawned.log.some((line) => line.startsWith('react:'))).toBe(false);
  });

  it('adds 2 to both cards when 双生子 enters opposite an ally, and adds nothing otherwise', () => {
    const twins = scriptedMirror('双生子').definition;
    const scout = scriptedCard('斥候').definition;
    const paired = playCard(
      createBattle({
        cards: [
          { definition: scout, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'ally' },
          { definition: twins, owner: 'enemy', zone: 'hand', instanceId: 'twins' },
        ],
      }),
      { instanceId: 'twins', cell: 8 },
    );
    expect(paired.ok).toBe(true);
    if (!paired.ok) return;
    expect(paired.state.instances.twins.permanentMod).toBe(2);
    expect(paired.state.instances.ally.permanentMod).toBe(2);
    expect(currentPoints(paired.state, 'twins')).toBe(5);
    expect(currentPoints(paired.state, 'ally')).toBe(6);

    const alone = playCard(
      createBattle({
        cards: [{ definition: twins, owner: 'enemy', zone: 'hand', instanceId: 'twins' }],
      }),
      { instanceId: 'twins', cell: 8 },
    );
    expect(alone.ok).toBe(true);
    if (!alone.ok) return;
    expect(alone.state.instances.twins.permanentMod).toBe(0);

    const foe = playCard(
      createBattle({
        cards: [
          { definition: scout, owner: 'player', zone: 'board', cell: 2, instanceId: 'foe' },
          { definition: twins, owner: 'enemy', zone: 'hand', instanceId: 'twins' },
        ],
      }),
      { instanceId: 'twins', cell: 8 },
    );
    expect(foe.ok).toBe(true);
    if (!foe.ok) return;
    expect(foe.state.instances.twins.permanentMod).toBe(0);
    expect(foe.state.instances.foe.permanentMod).toBe(0);

    const center = playCard(
      createBattle({
        cards: [{ definition: twins, owner: 'enemy', zone: 'hand', instanceId: 'twins' }],
      }),
      { instanceId: 'twins', cell: 5 },
    );
    expect(center.ok).toBe(true);
    if (!center.ok) return;
    expect(center.state.instances.twins.permanentMod).toBe(0);
  });

  it('moves a legal ally to its empty mirror and draws, and does not draw when the spell is illegal', () => {
    const flip = scriptedMirror('镜面翻转').definition;
    const scout = scriptedCard('斥候').definition;
    const ready = createBattle({
      polluted: [9],
      cards: [
        { definition: flip, owner: 'player', zone: 'hand', instanceId: 'flip' },
        { definition: scout, owner: 'player', zone: 'board', cell: 1, instanceId: 'ally', permanentMod: 3 },
        { definition: scout, owner: 'player', zone: 'deck', instanceId: 'spare' },
      ],
    });
    expect(hasLegalPlay(ready)).toBe(true);
    const missing = playCard(ready, { instanceId: 'flip' });
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.state).toBe(ready);
    expect(ready.deck).toEqual(['spare']);
    expect(ready.instances.ally.cell).toBe(1);
    const moved = playCard(ready, { instanceId: 'flip', choice: { targets: ['ally'] } });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(cardAt(moved.state, 9)?.instanceId).toBe('ally');
    expect(cardAt(moved.state, 1)).toBeNull();
    expect(moved.state.instances.ally.permanentMod).toBe(3);
    expect(moved.state.hand).toEqual(['spare']);
    expect(moved.state.instances.flip.zone).toBe('discard');
    expect(moved.state.log.some((line) => line === 'enter:ally' || line === 'leave:ally')).toBe(false);
    expect(moved.state.log.indexOf('draw:spare')).toBeGreaterThanOrEqual(0);

    const center = createBattle({
      cards: [
        { definition: flip, owner: 'player', zone: 'hand', instanceId: 'flip' },
        { definition: scout, owner: 'player', zone: 'board', cell: 5, instanceId: 'center' },
        { definition: scout, owner: 'player', zone: 'deck', instanceId: 'spare' },
      ],
    });
    expect(hasLegalPlay(center)).toBe(false);
    const refusedCenter = playCard(center, { instanceId: 'flip', choice: { targets: ['center'] } });
    expect(refusedCenter.ok).toBe(false);
    if (refusedCenter.ok) return;
    expect(refusedCenter.reason).toBe('no-target');
    expect(refusedCenter.state).toBe(center);
    expect(center.deck).toEqual(['spare']);
    expect(center.instances.center.cell).toBe(5);

    const occupied = createBattle({
      cards: [
        { definition: flip, owner: 'player', zone: 'hand', instanceId: 'flip' },
        { definition: scout, owner: 'player', zone: 'board', cell: 1, instanceId: 'ally' },
        { definition: scout, owner: 'enemy', zone: 'board', cell: 9, instanceId: 'block' },
        { definition: scout, owner: 'player', zone: 'deck', instanceId: 'spare' },
      ],
    });
    const refusedMirror = playCard(occupied, { instanceId: 'flip', choice: { targets: ['ally'] } });
    expect(refusedMirror.ok).toBe(false);
    if (refusedMirror.ok) return;
    expect(refusedMirror.state).toBe(occupied);
    expect(occupied.deck).toEqual(['spare']);
    expect(occupied.instances.ally.cell).toBe(1);
    expect(occupied.log.some((line) => line.startsWith('draw:'))).toBe(false);
  });

  it('gives the ally on 银镜 mirror +2 current points', () => {
    const ally = scriptedCard('斥候').definition;
    const silver = scriptedMirror('银镜').definition;
    const started = startMatch(
      {
        seed: 1,
        cards: [
          { definition: ally, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'ally' },
          ...Array.from({ length: 6 }, () => ({ definition: ally, owner: 'player' as const, zone: 'deck' as const })),
        ],
        intents: [{ definition: silver, owner: 'enemy' as const }],
      },
      { placeIntent: placeMirrorIntent },
    );
    expect(placeMirrorIntent(started.battle, started.revealed!)).toBe(8);
    const ended = endTurn(started);
    expect(ended.over).toBe(false);
    expect(ended.battle.cells[8] && ended.battle.definitions[ended.battle.instances[ended.battle.cells[8]!].definitionId]?.name).toBe(
      '银镜',
    );
    expect(currentPoints(ended.battle, 'ally')).toBe(6);
    expect(ended.battle.instances.ally.permanentMod).toBe(0);
  });

  it('uses choosePlacement when the exclusive mirror cell is closed', () => {
    const body = scriptedCard('斥候').definition;
    const battle = createBattle({
      cards: [
        { definition: body, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'tall', permanentMod: 5 },
        { definition: body, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'short' },
        { definition: body, owner: 'player', zone: 'board', cell: 8, instanceId: 'block' },
      ],
    });
    expect(placeMirrorIntent(battle, revealed(scriptedMirror('银镜').definition))).toBe(5);
  });

  it('skips 镜匠 when choosePlacement has no cell', () => {
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
    expect(placeMirrorIntent(battle, revealed(scriptedMirror('镜匠').definition))).toBe('skip');
  });
});
