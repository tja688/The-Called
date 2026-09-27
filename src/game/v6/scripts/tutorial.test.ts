import { describe, expect, it } from 'vitest';
import { getCardByName } from '../content';
import {
  createBattle,
  currentPoints,
  pendingTurnEndTargets,
  playCard,
  resolveTurnEndEffects,
  runTurnEndEffects,
  type Opcode,
} from '../rules';
import { TUTORIAL_CARD_NAMES, scriptedCard, tutorialCard, tutorialCards, type TutorialCardName } from './index';

const EXPECTED_STATUS: Record<TutorialCardName, 'script' | 'blocked'> = {
  斥候: 'script',
  钻心器: 'script',
  弱点采样机: 'script',
  勘验员: 'script',
  解析仪: 'script',
  攻击炮台: 'script',
  科学研究器: 'script',
  弱点攻击器: 'script',
  失控机械: 'script',
};

const UNIMPLEMENTED = new Set<Opcode['op']>([
  'lookTop',
  'search',
  'discardToHand',
  'discardToField',
  'shuffleIntoDeck',
  'shuffleCopy',
  'absorbAlly',
  'onDrawResolve',
]);

function walk(opcodes: Opcode[] | undefined): void {
  for (const opcode of opcodes ?? []) {
    expect(UNIMPLEMENTED.has(opcode.op)).toBe(false);
    if (opcode.op === 'armTimer') walk(opcode.onZero);
    if (opcode.op === 'forEach' || opcode.op === 'when') walk(opcode.effects);
  }
}

describe('tutorial battle scripts', () => {
  it('gives every tutorial card a script or a blocked reason', () => {
    expect(tutorialCards.map((card) => card.name)).toEqual([...TUTORIAL_CARD_NAMES]);
    expect(new Set(tutorialCards.map((card) => card.name)).size).toBe(TUTORIAL_CARD_NAMES.length);

    for (const name of TUTORIAL_CARD_NAMES) {
      const card = tutorialCard(name);
      const content = getCardByName(name);
      expect(card.status).toBe(EXPECTED_STATUS[name]);
      expect(content?.id).toBe(card.id);
      if (card.status === 'script') {
        expect(card.definition.id).toBe(content?.id);
        expect(card.definition.name).toBe(name);
        expect(card.definition.basePoints).toBe(content?.basePower);
        expect(card.definition.ruleType).toBe('field');
        walk(card.definition.effects);
        walk(card.definition.onLeave);
        walk(card.definition.onTurnStart);
        walk(card.definition.onTurnEnd);
        walk(card.definition.onTimer);
        for (const reaction of card.definition.reactions ?? []) walk(reaction.effects);
      } else {
        expect(card.missing.length).toBeGreaterThan(0);
      }
    }
  });

  it('marks the chosen enemy when 弱点采样机 enters', () => {
    const sampler = scriptedCard('弱点采样机');
    const body = scriptedCard('斥候');
    const state = createBattle({
      cards: [
        { definition: sampler.definition, owner: 'player', zone: 'hand', instanceId: 'sampler' },
        { definition: body.definition, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'foe' },
        { definition: body.definition, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'bystander' },
      ],
    });

    const played = playCard(state, {
      instanceId: 'sampler',
      cell: 2,
      choice: { targets: ['foe'] },
    });

    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.instances.foe.analyzed).toBe(true);
    expect(played.state.instances.bystander.analyzed).toBe(false);
    expect(played.state.instances.sampler.analyzed).toBe(false);
    expect(played.state.instances.sampler.cell).toBe(2);
  });

  it('lets the caller pass the target when the enemy plays the same card', () => {
    const sampler = scriptedCard('弱点采样机');
    const body = scriptedCard('斥候');
    const state = createBattle({
      cards: [
        { definition: sampler.definition, owner: 'enemy', zone: 'hand', instanceId: 'sampler' },
        { definition: body.definition, owner: 'player', zone: 'board', cell: 5, instanceId: 'scout' },
      ],
    });

    const played = playCard(state, {
      instanceId: 'sampler',
      cell: 9,
      choice: { targets: ['scout'] },
    });

    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.instances.scout.analyzed).toBe(true);
    expect(played.state.instances.sampler.owner).toBe('enemy');
  });

  it('reduces the chosen card by 2 when 弱点攻击器 enters', () => {
    const striker = scriptedCard('弱点攻击器');
    const foeBody = scriptedCard('钻心器');
    const otherBody = scriptedCard('斥候');
    const state = createBattle({
      cards: [
        { definition: striker.definition, owner: 'player', zone: 'hand', instanceId: 'striker' },
        { definition: foeBody.definition, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'foe' },
        { definition: otherBody.definition, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'other' },
      ],
    });

    const played = playCard(state, {
      instanceId: 'striker',
      cell: 2,
      choice: { targets: ['foe'] },
    });

    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(currentPoints(played.state, 'foe')).toBe(3);
    expect(currentPoints(played.state, 'other')).toBe(4);
  });

  it('plays an empty script without changing points or marks', () => {
    const scout = scriptedCard('斥候');
    const played = playCard(
      createBattle({
        cards: [{ definition: scout.definition, owner: 'player', zone: 'hand', instanceId: 'scout' }],
      }),
      { instanceId: 'scout', cell: 1 },
    );

    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(scout.definition.effects).toEqual([]);
    expect(currentPoints(played.state, 'scout')).toBe(4);
    expect(played.state.instances.scout.analyzed).toBe(false);
  });
});

describe('tutorial scripts settle on the board', () => {
  it('marks only orthogonal enemies when 勘验员 enters', () => {
    const examiner = scriptedCard('勘验员');
    const foe = scriptedCard('斥候');
    const played = playCard(
      createBattle({
        cards: [
          { definition: examiner.definition, owner: 'player', zone: 'hand', instanceId: 'examiner' },
          { definition: foe.definition, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'near' },
          { definition: foe.definition, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'diagonal' },
          { definition: foe.definition, owner: 'enemy', zone: 'board', cell: 6, instanceId: 'side' },
          { definition: foe.definition, owner: 'player', zone: 'board', cell: 4, instanceId: 'ally' },
        ],
      }),
      { instanceId: 'examiner', cell: 5 },
    );
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.instances.near.analyzed).toBe(true);
    expect(played.state.instances.side.analyzed).toBe(true);
    expect(played.state.instances.diagonal.analyzed).toBe(false);
    expect(played.state.instances.ally.analyzed).toBe(false);
    expect(played.state.instances.examiner.analyzed).toBe(false);
  });

  it('adds +2 to 解析仪 only beside a marked enemy', () => {
    const analyzer = scriptedCard('解析仪');
    const foe = scriptedCard('斥候');
    const boosted = playCard(
      createBattle({
        cards: [
          { definition: analyzer.definition, owner: 'player', zone: 'hand', instanceId: 'analyzer' },
          { definition: foe.definition, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'marked', analyzed: true },
          { definition: foe.definition, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'diagonal', analyzed: true },
        ],
      }),
      { instanceId: 'analyzer', cell: 5 },
    );
    expect(boosted.ok).toBe(true);
    if (!boosted.ok) return;
    expect(boosted.state.instances.analyzer.permanentMod).toBe(2);
    expect(currentPoints(boosted.state, 'analyzer')).toBe(6);

    const quiet = playCard(
      createBattle({
        cards: [
          { definition: analyzer.definition, owner: 'player', zone: 'hand', instanceId: 'analyzer' },
          { definition: foe.definition, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'plain' },
        ],
      }),
      { instanceId: 'analyzer', cell: 5 },
    );
    expect(quiet.ok).toBe(true);
    if (!quiet.ok) return;
    expect(quiet.state.instances.analyzer.permanentMod).toBe(0);
  });

  it('marks the chosen adjacent enemy at the end of 科学研究器, and skips a bad pick', () => {
    const device = scriptedCard('科学研究器');
    const foe = scriptedCard('斥候');
    const state = createBattle({
      cards: [
        { definition: device.definition, owner: 'player', zone: 'board', cell: 5, instanceId: 'device' },
        { definition: foe.definition, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'near' },
        { definition: foe.definition, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'diagonal' },
        { definition: foe.definition, owner: 'enemy', zone: 'board', cell: 8, instanceId: 'also' },
      ],
    });
    expect(pendingTurnEndTargets(state, 'player')).toEqual([{ sourceId: 'device', targets: ['near', 'also'] }]);
    const chosen = resolveTurnEndEffects(state, 'player', { targets: ['near'] });
    expect(chosen.instances.near.analyzed).toBe(true);
    expect(chosen.instances.also.analyzed).toBe(false);
    expect(chosen.instances.diagonal.analyzed).toBe(false);
    const rejected = resolveTurnEndEffects(state, 'player', { targets: ['diagonal'] });
    expect(rejected.instances.near.analyzed).toBe(false);
    expect(runTurnEndEffects(state, 'player').instances.near.analyzed).toBe(false);
  });

  it('reduces only the chosen marked enemy when 攻击炮台 ends the turn', () => {
    const turret = scriptedCard('攻击炮台');
    const foe = scriptedCard('钻心器');
    const state = createBattle({
      cards: [
        { definition: turret.definition, owner: 'player', zone: 'board', cell: 5, instanceId: 'turret' },
        { definition: foe.definition, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'marked', analyzed: true },
        { definition: foe.definition, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'plain' },
        { definition: foe.definition, owner: 'enemy', zone: 'board', cell: 9, instanceId: 'other', analyzed: true },
      ],
    });
    expect(pendingTurnEndTargets(state, 'player')[0]?.targets).toEqual(['marked', 'other']);
    const chosen = resolveTurnEndEffects(state, 'player', { targets: ['other'] });
    expect(currentPoints(chosen, 'other')).toBe(3);
    expect(currentPoints(chosen, 'marked')).toBe(5);
    expect(currentPoints(chosen, 'plain')).toBe(5);
    expect(runTurnEndEffects(state, 'player').instances.other.permanentMod).toBe(0);
  });

  it('marks a player card with 失控机械 only after that card enters an orthogonal cell', () => {
    const machine = scriptedCard('失控机械');
    const scout = scriptedCard('斥候');
    const entered = playCard(
      createBattle({
        cards: [
          { definition: machine.definition, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'machine' },
          {
            definition: { ...scout.definition, effects: [{ op: 'modPermanent', amount: 2, target: { ref: 'self' } }] },
            owner: 'player',
            zone: 'hand',
            instanceId: 'scout',
          },
        ],
      }),
      { instanceId: 'scout', cell: 2 },
    );
    expect(entered.ok).toBe(true);
    if (!entered.ok) return;
    expect(entered.state.instances.scout.permanentMod).toBe(2);
    expect(entered.state.instances.scout.analyzed).toBe(true);
    expect(entered.state.log.indexOf('react:machine:played')).toBeGreaterThan(entered.state.log.indexOf('enter:scout'));

    const diagonal = playCard(
      createBattle({
        cards: [
          { definition: machine.definition, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'machine' },
          { definition: scout.definition, owner: 'player', zone: 'hand', instanceId: 'scout' },
        ],
      }),
      { instanceId: 'scout', cell: 1 },
    );
    expect(diagonal.ok).toBe(true);
    if (!diagonal.ok) return;
    expect(diagonal.state.instances.scout.analyzed).toBe(false);

    const enemyPlay = playCard(
      createBattle({
        cards: [
          { definition: machine.definition, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'machine' },
          { definition: scout.definition, owner: 'enemy', zone: 'hand', instanceId: 'raider' },
        ],
      }),
      { instanceId: 'raider', cell: 6 },
    );
    expect(enemyPlay.ok).toBe(true);
    if (!enemyPlay.ok) return;
    expect(enemyPlay.state.instances.raider.analyzed).toBe(false);
  });
});
