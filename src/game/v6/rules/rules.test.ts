import { describe, expect, it } from 'vitest';
import {
  adjacentFieldCards,
  cardAt,
  checkZero,
  createBattle,
  currentPoints,
  evaluateForceSettlement,
  executeOpcodes,
  appraiseBoard,
  judgeWinner,
  mirrorCell,
  occupiedCount,
  orthogonalNeighbors,
  pendingTurnEndTargets,
  playCard,
  raiseForceSettlement,
  resolveTurnEndEffects,
  runTurnEndEffects,
  runTurnStartEffects,
  tickTimers,
  totalPoints,
  unseal,
  type BattleState,
  type CardDefinition,
  type CardSetup,
  type CellId,
  type Opcode,
  type PlayRequest,
} from './index';
import { nextInt } from './rng';

function field(id: string, points: number, extra: Partial<CardDefinition> = {}): CardDefinition {
  return { id, name: id, ruleType: 'field', basePoints: points, ...extra };
}

function spell(id: string, extra: Partial<CardDefinition> = {}): CardDefinition {
  return { id, name: id, ruleType: 'spell', basePoints: null, ...extra };
}

function at(
  definition: CardDefinition,
  zone: CardSetup['zone'],
  extra: Partial<CardSetup> = {},
): CardSetup {
  return { definition, owner: 'player', zone, instanceId: definition.id, ...extra };
}

function played(state: BattleState, request: PlayRequest): BattleState {
  const result = playCard(state, request);
  if (!result.ok) throw new Error(result.reason);
  return result.state;
}

function fillers(count: number, zone: 'hand' | 'board', owner: CardSetup['owner'] = 'player', points = 1): CardSetup[] {
  return Array.from({ length: count }, (_, index) => ({
    definition: field('filler', points),
    owner,
    zone,
    instanceId: `${zone}-${owner}-${index}`,
    cell: zone === 'board' ? ((index + 1) as CellId) : undefined,
  }));
}

describe('board geometry', () => {
  it('numbers cells in row-major order and mirrors across cell 5', () => {
    expect(orthogonalNeighbors(5)).toEqual([2, 4, 6, 8]);
    expect(orthogonalNeighbors(1)).toEqual([2, 4]);
    expect(orthogonalNeighbors(5).some((cell) => [1, 3, 7, 9].includes(cell))).toBe(false);
    expect(mirrorCell(1)).toBe(9);
    expect(mirrorCell(9)).toBe(1);
    expect(mirrorCell(2)).toBe(8);
    expect(mirrorCell(8)).toBe(2);
    expect(mirrorCell(3)).toBe(7);
    expect(mirrorCell(7)).toBe(3);
    expect(mirrorCell(4)).toBe(6);
    expect(mirrorCell(6)).toBe(4);
    expect(mirrorCell(5)).toBeNull();
  });
});

describe('playing a field card', () => {
  it('enters an empty cell, takes one pollution, resolves enter, then removes zeros', () => {
    const actor = field('actor', 4, {
      effects: [{ op: 'modPermanent', amount: 3, target: { ref: 'self' } }],
    });
    const zero = field('zero', 0);
    const state = createBattle({
      polluted: [2],
      cards: [
        at(actor, 'hand'),
        at(zero, 'board', { cell: 5, instanceId: 'zero' }),
      ],
    });

    const next = played(state, { instanceId: 'actor', cell: 2 });
    const landed = cardAt(next, 2);
    expect(landed?.instanceId).toBe('actor');
    expect(landed?.permanentMod).toBe(2);
    expect(currentPoints(next, 'actor')).toBe(6);
    expect(cardAt(next, 5)).toBeNull();
    expect(next.instances.zero.zone).toBe('discard');
    expect(next.log).toContain('enter:actor');
    expect(next.hand).not.toContain('actor');
  });

  it('covers when A > V, ignores protection, subtracts V, then pollution and enter', () => {
    const attacker = field('attacker', 8, {
      effects: [{ op: 'gainFaith', amount: 1 }],
    });
    const defender = field('defender', 3);
    const state = createBattle({
      faith: { player: 0 },
      polluted: [4],
      cards: [
        at(attacker, 'hand', { permanentMod: 1 }),
        at(defender, 'board', { owner: 'enemy', cell: 4, instanceId: 'defender', protected: true, permanentMod: 4, analyzed: true }),
      ],
    });

    const next = played(state, { instanceId: 'attacker', cell: 4 });
    expect(cardAt(next, 4)?.instanceId).toBe('attacker');
    expect(next.instances.attacker.permanentMod).toBe(1 - 7 - 1);
    expect(currentPoints(next, 'attacker')).toBe(1);
    expect(next.instances.defender.zone).toBe('discard');
    expect(next.instances.defender.permanentMod).toBe(0);
    expect(next.instances.defender.analyzed).toBe(false);
    expect(next.instances.defender.protected).toBe(false);
    expect(next.faith.player).toBe(1);
    expect(next.log).toContain('leave:defender');
    expect(next.log.indexOf('leave:defender')).toBeLessThan(next.log.indexOf('enter:attacker'));
  });

  it('removes an attacker that pollution and the cover debt reduce to zero, unless enter saves it', () => {
    const poor = field('poor', 4);
    const saved = field('saved', 4, {
      effects: [{ op: 'modPermanent', amount: 2, target: { ref: 'self' } }],
    });
    const wall = field('wall', 3);
    const broke = played(
      createBattle({
        polluted: [1],
        cards: [at(poor, 'hand'), at(wall, 'board', { owner: 'enemy', cell: 1, instanceId: 'wall' })],
      }),
      { instanceId: 'poor', cell: 1 },
    );
    expect(cardAt(broke, 1)).toBeNull();
    expect(broke.instances.poor.zone).toBe('discard');

    const lived = played(
      createBattle({
        polluted: [1],
        cards: [at(saved, 'hand'), at(wall, 'board', { owner: 'enemy', cell: 1, instanceId: 'wall' })],
      }),
      { instanceId: 'saved', cell: 1 },
    );
    expect(cardAt(lived, 1)?.instanceId).toBe('saved');
    expect(lived.instances.saved.permanentMod).toBe(-3 - 1 + 2);
  });

  it('sinks both cards on equal points without enter, leave, pollution, or the cover debt', () => {
    const attacker = field('attacker', 4, {
      effects: [{ op: 'gainFaith', amount: 5 }],
    });
    const defender = field('defender', 4, {
      onLeave: [{ op: 'gainFaith', amount: 1 }],
    });
    const state = createBattle({
      polluted: [6],
      cards: [
        at(attacker, 'hand'),
        at(defender, 'board', { owner: 'enemy', cell: 6, instanceId: 'defender' }),
      ],
    });
    const next = played(state, { instanceId: 'attacker', cell: 6 });
    expect(cardAt(next, 6)).toBeNull();
    expect(next.instances.attacker.zone).toBe('discard');
    expect(next.instances.attacker.permanentMod).toBe(0);
    expect(next.instances.defender.zone).toBe('discard');
    expect(next.faith.enemy).toBe(1);
    expect(next.faith.player).toBe(0);
    expect(next.log.some((line) => line.startsWith('enter:attacker'))).toBe(false);
    expect(next.log).toContain('leave:defender');
  });

  it('sends an equal-sink attacker with revive back to hand and keeps its hand bonus', () => {
    const attacker = field('attacker', 4);
    const next = played(
      createBattle({
        cards: [
          at(attacker, 'hand', { permanentMod: 2, revive: true }),
          at(field('defender', 6), 'board', { owner: 'enemy', cell: 8, instanceId: 'defender' }),
        ],
      }),
      { instanceId: 'attacker', cell: 8 },
    );
    expect(next.instances.attacker.zone).toBe('hand');
    expect(next.instances.attacker.permanentMod).toBe(2);
    expect(next.instances.attacker.revive).toBe(false);
    expect(cardAt(next, 8)).toBeNull();
    expect(next.log.some((line) => line.startsWith('enter:'))).toBe(false);
  });

  it('rejects a higher enemy and an ally cover without changing state', () => {
    const small = field('small', 3);
    const big = field('big', 5);
    const ally = field('ally', 1);
    const higher = createBattle({
      cards: [
        at(small, 'hand'),
        at(big, 'board', { owner: 'enemy', cell: 1, instanceId: 'big' }),
      ],
    });
    const denied = playCard(higher, { instanceId: 'small', cell: 1 });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.reason).toBe('occupied-by-higher');
    expect(denied.state).toBe(higher);

    const friendly = createBattle({
      cards: [at(small, 'hand'), at(ally, 'board', { cell: 2, instanceId: 'ally' })],
    });
    const own = playCard(friendly, { instanceId: 'small', cell: 2 });
    expect(own.ok).toBe(false);
    if (!own.ok) expect(own.reason).toBe('occupied-by-ally');
    expect(own.state).toBe(friendly);
  });
});

describe('protection, revive, and exhaust', () => {
  it('spends protection against a non-cover removal and removes again when points stay zero', () => {
    const sturdy = field('sturdy', 4);
    const held = executeOpcodes(
      createBattle({ cards: [at(sturdy, 'board', { cell: 3, protected: true })] }),
      [{ op: 'remove', target: { ref: 'instance', id: 'sturdy' } }],
      { selfId: 'sturdy' },
    );
    expect(cardAt(held, 3)?.instanceId).toBe('sturdy');
    expect(held.instances.sturdy.protected).toBe(false);
    expect(currentPoints(held, 'sturdy')).toBe(4);

    const doomed = field('doomed', 0);
    const gone = checkZero(createBattle({ cards: [at(doomed, 'board', { cell: 3, protected: true })] }));
    expect(cardAt(gone, 3)).toBeNull();
    expect(gone.instances.doomed.zone).toBe('discard');
    expect(gone.log.filter((line) => line === 'protect:doomed')).toHaveLength(1);
  });

  it('returns revive cards to hand, discards them when hand is full, and lets exhaust win', () => {
    const soul = field('soul', 2);
    const returned = executeOpcodes(
      createBattle({ cards: [at(soul, 'board', { cell: 1, revive: true })] }),
      [{ op: 'remove', target: { ref: 'self' } }],
      { selfId: 'soul' },
    );
    expect(returned.instances.soul.zone).toBe('hand');
    expect(returned.instances.soul.revive).toBe(false);

    const full = checkZero(
      createBattle({
        cards: [
          at(field('zeroed', 0), 'board', { cell: 9, instanceId: 'zeroed', revive: true }),
          ...fillers(10, 'hand'),
        ],
      }),
    );
    expect(full.instances.zeroed.zone).toBe('discard');
    expect(full.hand).toHaveLength(10);

    const both = field('both', 2);
    const burned = executeOpcodes(
      createBattle({ cards: [at(both, 'board', { cell: 1, revive: true, exhaust: true })] }),
      [{ op: 'remove', target: { ref: 'self' } }],
      { selfId: 'both' },
    );
    expect(burned.instances.both.zone).toBe('exile');
    expect(burned.hand).not.toContain('both');
  });

  it('equal-sink exhaust leaves the game and beats revive', () => {
    const attacker = field('attacker', 3, { exhaust: true });
    const next = played(
      createBattle({
        cards: [
          at(attacker, 'hand', { revive: true }),
          at(field('defender', 3), 'board', { owner: 'enemy', cell: 2, instanceId: 'defender' }),
        ],
      }),
      { instanceId: 'attacker', cell: 2 },
    );
    expect(next.instances.attacker.zone).toBe('exile');
    expect(next.log.some((line) => line.startsWith('enter:attacker') || line.startsWith('leave:attacker'))).toBe(false);
  });
});

describe('points, auras, marks, and reset', () => {
  it('counts sealed cards as occupying and worth zero, while cover still uses aura-inclusive current points', () => {
    const support = field('support', 1);
    const defender = field('defender', 2);
    const small = field('small', 4);
    const state = executeOpcodes(
      createBattle({
        cards: [
          at(support, 'board', { cell: 1 }),
          at(defender, 'board', { owner: 'enemy', cell: 2, instanceId: 'defender', sealed: true }),
          at(small, 'hand'),
        ],
      }),
      [{ op: 'grantAura', amount: 3, target: { ref: 'instance', id: 'defender' } }],
      { selfId: 'support' },
    );
    expect(currentPoints(state, 'defender')).toBe(5);
    expect(totalPoints(state, 'enemy')).toBe(0);
    expect(occupiedCount(state, 'enemy')).toBe(1);
    const denied = playCard(state, { instanceId: 'small', cell: 2 });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.reason).toBe('occupied-by-higher');

    const big = played(
      executeOpcodes(
        createBattle({
          cards: [
            at(support, 'board', { cell: 1 }),
            at(defender, 'board', { owner: 'enemy', cell: 2, instanceId: 'defender', sealed: true }),
            at(field('big', 6), 'hand', { instanceId: 'big' }),
          ],
        }),
        [{ op: 'grantAura', amount: 3, target: { ref: 'instance', id: 'defender' } }],
        { selfId: 'support' },
      ),
      { instanceId: 'big', cell: 2 },
    );
    expect(big.instances.big.permanentMod).toBe(-5);
  });

  it('drops auras when the source leaves or is sealed, and keeps permanent mods', () => {
    const source = field('source', 3);
    const target = field('target', 4);
    const granted = executeOpcodes(
      createBattle({
        cards: [at(source, 'board', { cell: 1 }), at(target, 'board', { cell: 2, instanceId: 'target' })],
      }),
      [
        { op: 'modPermanent', amount: 2, target: { ref: 'instance', id: 'target' } },
        { op: 'grantAura', amount: 3, target: { ref: 'instance', id: 'target' } },
      ],
      { selfId: 'source' },
    );
    expect(currentPoints(granted, 'target')).toBe(9);

    const sealed = executeOpcodes(granted, [{ op: 'seal', target: { ref: 'self' } }], { selfId: 'source' });
    expect(currentPoints(sealed, 'target')).toBe(6);
    expect(sealed.instances.target.permanentMod).toBe(2);
    const awake = unseal(sealed, 'player');
    expect(currentPoints(awake, 'target')).toBe(9);

    const removed = executeOpcodes(awake, [{ op: 'remove', target: { ref: 'instance', id: 'source' } }], { selfId: 'target' });
    expect(removed.instances.source.zone).toBe('discard');
    expect(removed.auras).toHaveLength(0);
    expect(currentPoints(removed, 'target')).toBe(6);
    expect(removed.instances.target.permanentMod).toBe(2);
  });

  it('doubles base plus permanent without baking aura, and reset clears only the permanent mod', () => {
    const source = field('source', 1);
    const body = field('body', 4);
    const state = executeOpcodes(
      createBattle({
        cards: [
          at(source, 'board', { cell: 8 }),
          at(body, 'board', {
            cell: 9,
            instanceId: 'body',
            permanentMod: 1,
            analyzed: true,
            sealed: true,
            protected: true,
            revive: true,
          }),
        ],
      }),
      [{ op: 'grantAura', amount: 3, target: { ref: 'instance', id: 'body' } }],
      { selfId: 'source' },
    );
    expect(currentPoints(state, 'body')).toBe(8);
    const doubled = executeOpcodes(
      state,
      [{ op: 'doubleBasePermanent', target: { ref: 'instance', id: 'body' } }],
      { selfId: 'body' },
    );
    expect(doubled.instances.body.permanentMod).toBe(6);
    expect(currentPoints(doubled, 'body')).toBe(13);
    expect(doubled.auras).toHaveLength(1);

    const reset = executeOpcodes(doubled, [{ op: 'resetToBase', target: { ref: 'instance', id: 'body' } }], { selfId: 'body' });
    expect(reset.instances.body.permanentMod).toBe(0);
    expect(currentPoints(reset, 'body')).toBe(7);
    expect(reset.instances.body.analyzed).toBe(true);
    expect(reset.instances.body.sealed).toBe(true);
    expect(reset.instances.body.protected).toBe(true);
    expect(reset.instances.body.revive).toBe(true);
    expect(totalPoints(reset, 'player')).toBe(currentPoints(reset, 'source'));
  });

  it('treats a repeated analysis mark as a no-op', () => {
    const watcher = field('watcher', 2, {
      reactions: [{ event: 'gainedMark', effects: [{ op: 'modPermanent', amount: 1, target: { ref: 'self' } }] }],
    });
    const body = field('body', 2);
    const once = executeOpcodes(
      createBattle({
        cards: [at(watcher, 'board', { cell: 1 }), at(body, 'board', { cell: 2, instanceId: 'body' })],
      }),
      [
        { op: 'addMark', target: { ref: 'instance', id: 'body' } },
        { op: 'addMark', target: { ref: 'instance', id: 'body' } },
      ],
      { selfId: 'body' },
    );
    expect(once.instances.body.analyzed).toBe(true);
    expect(once.instances.watcher.permanentMod).toBe(1);
    expect(once.log.filter((line) => line === 'react:watcher:gainedMark')).toHaveLength(1);

    const twice = executeOpcodes(once, [{ op: 'addMark', target: { ref: 'instance', id: 'body' } }], { selfId: 'body' });
    expect(twice.instances.watcher.permanentMod).toBe(1);
    expect(twice.log.filter((line) => line === 'react:watcher:gainedMark')).toHaveLength(1);
  });

  it('keeps a direct hand bonus until the card is discarded back to its printed state', () => {
    const card = field('card', 4);
    const state = createBattle({ cards: [at(card, 'hand', { permanentMod: 1 })] });
    const buffed = executeOpcodes(
      state,
      [{ op: 'modPermanent', amount: 3, target: { ref: 'instance', id: 'card' } }],
      { selfId: 'card' },
    );
    expect(buffed.instances.card.zone).toBe('hand');
    expect(buffed.instances.card.permanentMod).toBe(4);

    const discarded = played(
      createBattle({
        cards: [
          at(card, 'hand', { permanentMod: 4 }),
          at(field('wall', 8), 'board', { owner: 'enemy', cell: 3, instanceId: 'wall' }),
        ],
      }),
      { instanceId: 'card', cell: 3 },
    );
    expect(discarded.instances.card.zone).toBe('discard');
    expect(discarded.instances.card.permanentMod).toBe(0);
    expect(discarded.instances.card.analyzed).toBe(false);
  });
});

describe('pollution, thresholds, and movement', () => {
  it('applies pollution only to a card played from hand', () => {
    const token = field('token', 4);
    const mover = field('mover', 4);
    const state = createBattle({
      polluted: [1, 9],
      catalog: [token],
      cards: [at(field('played', 4), 'hand', { instanceId: 'played' }), at(mover, 'board', { cell: 1, instanceId: 'mover' })],
    });
    const entered = played(state, { instanceId: 'played', cell: 9 });
    expect(entered.instances.played.permanentMod).toBe(-1);

    const clean = createBattle({
      polluted: [9],
      catalog: [token],
      cards: [at(mover, 'board', { cell: 1, instanceId: 'mover', permanentMod: 4 })],
    });
    const spawned = executeOpcodes(
      clean,
      [{ op: 'spawn', definitionId: 'token', cell: 'choice' }],
      { selfId: 'mover', choice: { cells: [9] } },
    );
    const tokenCard = cardAt(spawned, 9);
    expect(tokenCard?.definitionId).toBe('token');
    expect(tokenCard?.permanentMod).toBe(0);
    expect(spawned.log.some((line) => line.startsWith('enter:'))).toBe(true);

    const moved = executeOpcodes(clean, [{ op: 'moveToMirror', target: { ref: 'self' } }], { selfId: 'mover' });
    expect(cardAt(moved, 9)?.instanceId).toBe('mover');
    expect(cardAt(moved, 1)).toBeNull();
    expect(moved.instances.mover.permanentMod).toBe(4);
    expect(moved.log.some((line) => line.includes('mover') && (line.startsWith('enter:') || line.startsWith('leave:')))).toBe(false);
  });

  it('refuses a cover below the threshold, including an equal sink, until the source is gone', () => {
    const gate = field('gate', 2);
    const defender = field('defender', 3);
    const attacker = field('attacker', 5);
    const armed = executeOpcodes(
      createBattle({
        cards: [
          at(gate, 'board', { cell: 8 }),
          at(defender, 'board', { owner: 'enemy', cell: 4, instanceId: 'defender' }),
          at(attacker, 'hand'),
        ],
      }),
      [{ op: 'grantCoverThreshold', min: 8, target: { ref: 'instance', id: 'defender' } }],
      { selfId: 'gate' },
    );
    const blocked = playCard(armed, { instanceId: 'attacker', cell: 4 });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.reason).toBe('below-threshold');
    expect(blocked.state).toBe(armed);

    const equalCards = createBattle({
      cards: [
        at(gate, 'board', { cell: 8 }),
        at(field('defender', 4), 'board', { owner: 'enemy', cell: 4, instanceId: 'defender' }),
        at(field('attacker', 4), 'hand', { instanceId: 'attacker' }),
      ],
    });
    const equalArmed = executeOpcodes(
      equalCards,
      [{ op: 'grantCoverThreshold', min: 6, target: { ref: 'instance', id: 'defender' } }],
      { selfId: 'gate' },
    );
    const equalBlocked = playCard(equalArmed, { instanceId: 'attacker', cell: 4 });
    expect(equalBlocked.ok).toBe(false);
    expect(equalBlocked.state).toBe(equalArmed);
    expect(cardAt(equalBlocked.state, 4)?.instanceId).toBe('defender');

    const opened = executeOpcodes(armed, [{ op: 'seal', target: { ref: 'self' } }], { selfId: 'gate' });
    const covered = played(opened, { instanceId: 'attacker', cell: 4 });
    expect(cardAt(covered, 4)?.instanceId).toBe('attacker');
    expect(covered.instances.attacker.permanentMod).toBe(-3);
  });

  it('drops the threshold when its source leaves', () => {
    const gate = field('gate', 2);
    const state = executeOpcodes(
      createBattle({
        cards: [
          at(gate, 'board', { cell: 8 }),
          at(field('defender', 4), 'board', { owner: 'enemy', cell: 4, instanceId: 'defender' }),
          at(field('attacker', 4), 'hand', { instanceId: 'attacker' }),
        ],
      }),
      [{ op: 'grantCoverThreshold', min: 9, target: { ref: 'instance', id: 'defender' } }],
      { selfId: 'gate' },
    );
    const cleared = executeOpcodes(state, [{ op: 'remove', target: { ref: 'instance', id: 'gate' } }], { selfId: 'defender' });
    const next = played(cleared, { instanceId: 'attacker', cell: 4 });
    expect(cardAt(next, 4)).toBeNull();
    expect(next.instances.attacker.zone).toBe('discard');
    expect(next.instances.defender.zone).toBe('discard');
  });
});

describe('faith and sacrifice', () => {
  it('floors faith at zero and cancels the whole paid segment when the fixed cost is short', () => {
    expect(createBattle({ faith: { player: -5, enemy: 1 } }).faith).toEqual({ player: 0, enemy: 1 });

    const saint = field('saint', 3, {
      effects: [
        { op: 'spendFaith', amount: 2 },
        { op: 'giveProtect', target: { ref: 'self' } },
      ],
    });
    const short = played(createBattle({ faith: { player: 1 }, cards: [at(saint, 'hand')] }), { instanceId: 'saint', cell: 5 });
    expect(cardAt(short, 5)?.instanceId).toBe('saint');
    expect(short.instances.saint.protected).toBe(false);
    expect(short.faith.player).toBe(1);

    const paid = played(createBattle({ faith: { player: 2 }, cards: [at(saint, 'hand')] }), { instanceId: 'saint', cell: 5 });
    expect(paid.instances.saint.protected).toBe(true);
    expect(paid.faith.player).toBe(0);

    const prayer = spell('prayer', {
      effects: [
        { op: 'spendFaith', amount: 2 },
        { op: 'giveProtect', target: { ref: 'choice', index: 0 } },
      ],
    });
    const host = field('host', 3);
    const missed = played(
      createBattle({
        faith: { player: 1 },
        cards: [at(prayer, 'hand', { instanceId: 'prayer' }), at(host, 'board', { cell: 1, instanceId: 'host' })],
      }),
      { instanceId: 'prayer', choice: { targets: ['host'] } },
    );
    expect(missed.instances.host.protected).toBe(false);
    expect(cardAt(missed, 1)?.instanceId).toBe('host');
    expect(missed.instances.prayer.zone).toBe('discard');
    expect(missed.faith.player).toBe(1);

    const free = field('free', 2, {
      effects: [
        { op: 'spendFaith', amount: 'all' },
        { op: 'modPermanent', amount: 'lastFaithSpent', target: { ref: 'self' } },
        { op: 'giveProtect', target: { ref: 'self' } },
      ],
    });
    const zeroPaid = played(createBattle({ cards: [at(free, 'hand')] }), { instanceId: 'free', cell: 1 });
    expect(zeroPaid.instances.free.protected).toBe(true);
    expect(zeroPaid.instances.free.permanentMod).toBe(0);
    expect(zeroPaid.faith.player).toBe(0);

    const doubled = executeOpcodes(
      createBattle({ faith: { player: 3 }, cards: [at(field('cup', 1), 'board', { cell: 1, instanceId: 'cup' })] }),
      [{ op: 'doubleFaith' }],
      { selfId: 'cup' },
    );
    expect(doubled.faith.player).toBe(6);
    const stillZero = executeOpcodes(
      createBattle({ cards: [at(field('cup', 1), 'board', { cell: 1, instanceId: 'cup' })] }),
      [{ op: 'doubleFaith' }],
      { selfId: 'cup' },
    );
    expect(stillZero.faith.player).toBe(0);
  });

  it('runs one faith branch for the controller and leaves the other branch untouched', () => {
    const knight = field('knight', 5, {
      effects: [
        {
          op: 'ifFaith',
          atLeast: 4,
          then: [
            { op: 'giveProtect', target: { ref: 'self' } },
            { op: 'modPermanent', amount: 3, target: { ref: 'self' } },
          ],
          else: [{ op: 'gainFaith', amount: 1 }],
        },
      ],
    });
    const armed = played(
      createBattle({ faith: { player: 4, enemy: 0 }, cards: [at(knight, 'hand')] }),
      { instanceId: 'knight', cell: 5 },
    );
    expect(armed.instances.knight.protected).toBe(true);
    expect(currentPoints(armed, 'knight')).toBe(8);
    expect(armed.faith).toEqual({ player: 4, enemy: 0 });

    const short = played(
      createBattle({ faith: { player: 3, enemy: 9 }, cards: [at(knight, 'hand')] }),
      { instanceId: 'knight', cell: 1 },
    );
    expect(short.instances.knight.protected).toBe(false);
    expect(currentPoints(short, 'knight')).toBe(5);
    expect(short.faith).toEqual({ player: 4, enemy: 9 });

    const enemy = played(
      createBattle({
        faith: { player: 9, enemy: 4 },
        cards: [at(knight, 'hand', { owner: 'enemy' })],
      }),
      { instanceId: 'knight', cell: 6 },
    );
    expect(enemy.instances.knight.owner).toBe('enemy');
    expect(enemy.instances.knight.protected).toBe(true);
    expect(currentPoints(enemy, 'knight')).toBe(8);
    expect(enemy.faith).toEqual({ player: 9, enemy: 4 });
  });

  it('cancels a player sacrifice when the deck is short, and skips only that clause for the enemy', () => {
    const rite = field('rite', 2, {
      effects: [
        { op: 'sacrifice', count: 2 },
        { op: 'giveProtect', target: { ref: 'self' } },
      ],
    });
    const short = createBattle({
      cards: [at(rite, 'hand'), at(field('only', 1), 'deck', { instanceId: 'only' })],
    });
    const failed = played(short, { instanceId: 'rite', cell: 1 });
    expect(failed).not.toBe(short);
    expect(cardAt(failed, 1)?.instanceId).toBe('rite');
    expect(failed.instances.rite.protected).toBe(false);
    expect(failed.deck).toEqual(['only']);

    const enemy = played(
      createBattle({
        cards: [
          at(rite, 'hand', { owner: 'enemy' }),
          at(field('kept', 1), 'deck', { instanceId: 'kept' }),
        ],
      }),
      { instanceId: 'rite', cell: 1 },
    );
    expect(enemy.instances.rite.protected).toBe(true);
    expect(enemy.instances.rite.owner).toBe('enemy');
    expect(enemy.deck).toEqual(['kept']);

    const first = createBattle({
      seed: 42,
      cards: [
        at(field('altar', 2, { effects: [{ op: 'sacrifice', count: 1 }] }), 'hand', { instanceId: 'altar' }),
        at(field('a', 1), 'deck', { instanceId: 'a' }),
        at(field('b', 1), 'deck', { instanceId: 'b' }),
        at(field('c', 1), 'deck', { instanceId: 'c' }),
      ],
    });
    const secondSeed = createBattle({
      seed: 42,
      cards: [
        at(field('altar', 2, { effects: [{ op: 'sacrifice', count: 1 }] }), 'hand', { instanceId: 'altar' }),
        at(field('a', 1), 'deck', { instanceId: 'a' }),
        at(field('b', 1), 'deck', { instanceId: 'b' }),
        at(field('c', 1), 'deck', { instanceId: 'c' }),
      ],
    });
    const left = played(first, { instanceId: 'altar', cell: 1 });
    const right = played(secondSeed, { instanceId: 'altar', cell: 1 });
    expect(left.deck).toEqual(right.deck);
    expect(left.discard.map((id) => left.instances[id].definitionId)).toEqual(
      right.discard.map((id) => right.instances[id].definitionId),
    );
    expect(left.deck).toHaveLength(2);
  });

  it('redirects a sacrificed return-to-hand card into hand, or discard when hand is full', () => {
    const soul = field('soul', 1, { toHandWhenSacrificed: true });
    const gained = played(
      createBattle({
        cards: [at(field('altar', 1, { effects: [{ op: 'sacrifice', count: 1 }] }), 'hand', { instanceId: 'altar' }), at(soul, 'deck')],
      }),
      { instanceId: 'altar', cell: 1 },
    );
    expect(gained.instances.soul.zone).toBe('hand');
    expect(gained.discard).not.toContain('soul');

    const sacrificed = executeOpcodes(
      createBattle({
        cards: [at(field('altar', 1), 'board', { cell: 1, instanceId: 'altar' }), at(soul, 'deck'), ...fillers(10, 'hand')],
      }),
      [{ op: 'sacrifice', count: 1 }],
      { selfId: 'altar' },
    );
    expect(sacrificed.instances.soul.zone).toBe('discard');
    expect(sacrificed.hand).toHaveLength(10);
  });
});

describe('pipelines that the turn driver will call', () => {
  it('stops a zero-check chain at depth 32 and records the error', () => {
    const loop = field('loop', 0, {
      onLeave: [{ op: 'spawn', definitionId: 'loop', cell: 5 }],
    });
    const next = checkZero(
      createBattle({ cards: [at(loop, 'board', { cell: 5, instanceId: 'origin' })] }),
    );
    expect(next.log).toContain('error:zero-check depth limit 32');
  });

  it('hears enter before later reactions, and hears one event in ascending cell order', () => {
    const react = (event: 'entered' | 'gainedMark'): CardDefinition['reactions'] => [
      { event, effects: [{ op: 'gainFaith', amount: 0 }] },
    ];
    const low = field('low', 1, { reactions: react('entered') });
    const high = field('high', 1, { reactions: react('entered') });
    const mark = field('mark', 1, { reactions: react('gainedMark') });
    const hand = field('hand', 1, { reactions: react('entered') });
    const actor = field('actor', 3, {
      effects: [{ op: 'addMark', target: { ref: 'self' } }],
    });
    const next = played(
      createBattle({
        cards: [
          at(low, 'board', { cell: 2 }),
          at(high, 'board', { cell: 7 }),
          at(mark, 'board', { cell: 3 }),
          at(hand, 'hand'),
          at(actor, 'hand'),
        ],
      }),
      { instanceId: 'actor', cell: 5 },
    );
    expect(next.log.filter((line) => line.startsWith('enter:') || line.startsWith('react:'))).toEqual([
      'enter:actor',
      'react:low:entered',
      'react:high:entered',
      'react:hand:entered',
      'react:mark:gainedMark',
    ]);
  });

  it('ticks timers after unseal, in cell order, and skips sealed cards', () => {
    const clock = (id: string): CardDefinition =>
      field(id, 1, { timer: 2, onTimer: [{ op: 'gainFaith', amount: 1 }] });
    const state = createBattle({
      cards: [
        at(clock('early'), 'board', { cell: 2, timer: 1 }),
        at(clock('late'), 'board', { cell: 8, timer: 1 }),
        at(clock('held'), 'board', { cell: 1, timer: 1, sealed: true }),
        at(clock('foe'), 'board', { owner: 'enemy', cell: 4, timer: 1, instanceId: 'foe' }),
      ],
    });
    const skipped = tickTimers(state, 'player');
    expect(skipped.instances.held.timer).toBe(1);
    expect(skipped.instances.foe.timer).toBe(1);
    expect(skipped.faith.player).toBe(2);
    expect(skipped.instances.early.timer).toBe(2);
    expect(skipped.log.filter((line) => line.startsWith('timer:'))).toEqual(['timer:early', 'timer:late']);

    const opened = tickTimers(unseal(state, 'player'), 'player');
    expect(opened.instances.held.sealed).toBe(false);
    expect(opened.faith.player).toBe(3);
    expect(opened.log.filter((line) => line.startsWith('timer:'))).toEqual(['timer:held', 'timer:early', 'timer:late']);
  });

  it('runs turn-start effects by cell, then hand, skipping sealed cards', () => {
    const start = (id: string): CardDefinition =>
      field(id, 1, { onTurnStart: [{ op: 'gainFaith', amount: 1 }] });
    const next = runTurnStartEffects(
      createBattle({
        cards: [
          at(start('high'), 'board', { cell: 6 }),
          at(start('low'), 'board', { cell: 1 }),
          at(start('quiet'), 'board', { cell: 4, sealed: true }),
          at(start('held'), 'hand'),
        ],
      }),
      'player',
    );
    expect(next.faith.player).toBe(3);
    expect(next.log.filter((line) => line.startsWith('turn-start:'))).toEqual([
      'turn-start:low',
      'turn-start:high',
      'turn-start:held',
    ]);
  });

  it('sets settlement flags without deciding a winner, then compares points, cells, and the side about to move', () => {
    const ring = field('bell', 6, { effects: [{ op: 'forceSettlement' }] });
    const flagged = played(createBattle({ cards: [at(ring, 'hand')] }), { instanceId: 'bell', cell: 2 });
    expect(flagged.forceSettlement).toBe(true);
    expect(flagged.forceReasons).toContain('special');
    expect(judgeWinner(flagged, 'player')).toBe('player');

    const raised = raiseForceSettlement(createBattle(), 'special');
    expect(raised.forceSettlement).toBe(true);

    const full = evaluateForceSettlement(
      createBattle({
        cards: fillers(9, 'board', 'player', 2).map((card, index) =>
          index === 0 ? { ...card, owner: 'enemy' as const, definition: field('filler', 1) } : card,
        ),
      }),
    );
    expect(full.forceReasons).toContain('board');

    const stuck = evaluateForceSettlement(
      createBattle({
        cards: [
          ...fillers(9, 'board', 'enemy', 5),
          at(field('weak', 1), 'hand', { instanceId: 'weak' }),
        ],
      }),
    );
    expect(stuck.forceReasons).toContain('board');
    expect(stuck.forceReasons).toContain('resource');

    const waiting = createBattle({
      cards: [...fillers(9, 'board', 'enemy', 5), at(field('weak', 1), 'hand', { instanceId: 'weak' }), at(field('next', 1), 'deck', { instanceId: 'next' })],
    });
    expect(evaluateForceSettlement(waiting).forceReasons).not.toContain('resource');
    const packed = evaluateForceSettlement(
      createBattle({
        cards: [
          ...fillers(9, 'board', 'enemy', 5),
          ...fillers(10, 'hand', 'player', 1),
          at(field('next', 1), 'deck', { instanceId: 'next' }),
        ],
      }),
    );
    expect(packed.forceReasons).toContain('resource');

    const open = createBattle({ cards: [at(field('ready', 2), 'hand')] });
    expect(evaluateForceSettlement(open, { voluntaryPass: true }).forceSettlement).toBe(false);

    const ahead = createBattle({
      cards: [
        at(field('us', 3), 'board', { cell: 1, instanceId: 'us' }),
        at(field('them', 5), 'board', { owner: 'enemy', cell: 2, instanceId: 'them' }),
      ],
    });
    expect(judgeWinner(ahead, 'player')).toBe('enemy');
    expect(judgeWinner(
      createBattle({
        cards: [
          at(field('us', 4), 'board', { cell: 1 }),
          at(field('also', 4), 'board', { cell: 2 }),
          at(field('them', 8), 'board', { owner: 'enemy', cell: 3, sealed: true, instanceId: 'them' }),
        ],
      }),
      'enemy',
    )).toBe('player');
    const tied = createBattle({
      cards: [
        at(field('us', 2), 'board', { cell: 1 }),
        at(field('them', 2), 'board', { owner: 'enemy', cell: 9, instanceId: 'them' }),
      ],
    });
    expect(totalPoints(tied, 'player')).toBe(totalPoints(tied, 'enemy'));
    expect(occupiedCount(tied, 'player')).toBe(occupiedCount(tied, 'enemy'));
    expect(judgeWinner(tied, 'player')).toBe('enemy');
    expect(judgeWinner(tied, 'enemy')).toBe('player');
    expect(judgeWinner(createBattle(), 'player')).toBe('enemy');
  });

  it('appraises only the side about to move, and only when they are strictly ahead', () => {
    const ahead = createBattle({
      cards: [
        at(field('us', 19), 'board', { cell: 1, instanceId: 'us' }),
        at(field('them', 18), 'board', { owner: 'enemy', cell: 2, instanceId: 'them' }),
      ],
    });
    expect(appraiseBoard(ahead, 'player')).toBe('player');
    expect(appraiseBoard(ahead, 'enemy')).toBeNull();

    const behind = createBattle({
      cards: [
        at(field('us', 19), 'board', { cell: 1, instanceId: 'us' }),
        at(field('them', 21), 'board', { owner: 'enemy', cell: 2, instanceId: 'them' }),
      ],
    });
    expect(appraiseBoard(behind, 'player')).toBeNull();
    expect(appraiseBoard(behind, 'enemy')).toBe('enemy');

    const tied = createBattle({
      cards: [
        at(field('us', 21), 'board', { cell: 1, instanceId: 'us' }),
        at(field('them', 21), 'board', { owner: 'enemy', cell: 2, instanceId: 'them' }),
      ],
    });
    expect(appraiseBoard(tied, 'player')).toBeNull();
    expect(appraiseBoard(tied, 'enemy')).toBeNull();
  });
});

describe('operations with an explicit choice, and placeholders', () => {
  it('draws from the top, stops at hand size 10, and can remove by condition', () => {
    const drawn = executeOpcodes(
      createBattle({
        cards: [
          at(field('body', 1), 'board', { cell: 1, instanceId: 'body' }),
          at(field('a', 1), 'deck', { instanceId: 'a' }),
          at(field('b', 1), 'deck', { instanceId: 'b' }),
          at(field('c', 1), 'deck', { instanceId: 'c' }),
        ],
      }),
      [{ op: 'draw', count: 2 }],
      { selfId: 'body' },
    );
    expect(drawn.hand).toEqual(['a', 'b']);
    expect(drawn.deck).toEqual(['c']);

    const capped = executeOpcodes(
      createBattle({
        cards: [at(field('body', 1), 'board', { cell: 1, instanceId: 'body' }), ...fillers(9, 'hand'), at(field('extra', 1), 'deck', { instanceId: 'extra' }), at(field('more', 1), 'deck', { instanceId: 'more' })],
      }),
      [{ op: 'draw', count: 2 }],
      { selfId: 'body' },
    );
    expect(capped.hand).toHaveLength(10);
    expect(capped.deck).toEqual(['more']);

    const board = createBattle({
      cards: [
        at(field('self', 1), 'board', { cell: 5, instanceId: 'self' }),
        at(field('low', 2), 'board', { owner: 'enemy', cell: 1, instanceId: 'low' }),
        at(field('high', 6), 'board', { owner: 'enemy', cell: 2, instanceId: 'high', analyzed: true }),
        at(field('locked', 4), 'board', { owner: 'enemy', cell: 3, instanceId: 'locked', sealed: true }),
      ],
    });
    const trimmed = executeOpcodes(
      board,
      [{ op: 'remove', target: { ref: 'query', owner: 'opponent' }, when: [{ kind: 'pointsAtMost', max: 3 }] }],
      { selfId: 'self' },
    );
    expect(trimmed.instances.low.zone).toBe('discard');
    expect(trimmed.instances.high.zone).toBe('board');
    const marked = executeOpcodes(
      board,
      [{ op: 'remove', target: { ref: 'query', owner: 'opponent' }, when: [{ kind: 'hasMark' }] }],
      { selfId: 'self' },
    );
    expect(marked.instances.high.zone).toBe('discard');
    expect(marked.instances.low.zone).toBe('board');
    const sealed = executeOpcodes(
      board,
      [{ op: 'remove', target: { ref: 'query', owner: 'opponent' }, when: [{ kind: 'sealed' }] }],
      { selfId: 'self' },
    );
    expect(sealed.instances.locked.zone).toBe('discard');
    expect(sealed.instances.low.zone).toBe('board');
  });

  it('transfers ownership without removal, enter, or leave, then retargets auras', () => {
    const source = field('source', 3, { timer: 3 });
    const ally = field('ally', 4, {
      reactions: [{ event: 'left', effects: [{ op: 'gainFaith', amount: 1 }] }],
    });
    const enemy = field('enemy', 4);
    const moved = executeOpcodes(
      createBattle({
        cards: [
          at(source, 'board', {
            cell: 1,
            permanentMod: 1,
            analyzed: true,
            sealed: true,
            protected: true,
            revive: true,
            timer: 1,
          }),
          at(ally, 'board', { cell: 2, instanceId: 'ally' }),
          at(enemy, 'board', { owner: 'enemy', cell: 3, instanceId: 'enemy' }),
        ],
      }),
      [
        { op: 'grantAura', amount: 5, target: { ref: 'query', owner: 'same' } },
        { op: 'transferOwner', target: { ref: 'self' }, to: 'enemy' },
      ],
      { selfId: 'source' },
    );
    const card = moved.instances.source;
    expect(card.owner).toBe('enemy');
    expect(card.cell).toBe(1);
    expect(card.zone).toBe('board');
    expect(card.sealed).toBe(true);
    expect(card.protected).toBe(true);
    expect(card.revive).toBe(true);
    expect(card.analyzed).toBe(true);
    expect(card.permanentMod).toBe(1);
    expect(card.timer).toBe(1);
    expect(card.timerMax).toBe(3);
    expect(moved.faith.player).toBe(0);
    expect(moved.log.some((line) => line.startsWith('leave:') || line.startsWith('enter:'))).toBe(false);
    expect(currentPoints(moved, 'ally')).toBe(4);

    const awake = unseal(moved, 'enemy');
    expect(awake.instances.source.sealed).toBe(false);
    expect(currentPoints(awake, 'enemy')).toBe(9);
    expect(currentPoints(awake, 'ally')).toBe(4);
    expect(currentPoints(awake, 'source')).toBe(9);
  });

  it('resolves a drawn curse in that draw slot, then discards it', () => {
    const curse = spell('babble', {
      onDraw: [{ op: 'modPermanent', amount: -2, target: { ref: 'query', owner: 'same', highest: true } }],
    });
    const opened = executeOpcodes(
      createBattle({
        cards: [
          at(field('tied-late', 5), 'board', { cell: 9, instanceId: 'late' }),
          at(field('tied-early', 5), 'board', { cell: 3, instanceId: 'early' }),
          at(field('foe', 9), 'board', { owner: 'enemy', cell: 4, instanceId: 'foe' }),
          at(curse, 'deck', { instanceId: 'curse' }),
          at(field('a', 1), 'deck', { instanceId: 'a' }),
          at(field('b', 1), 'deck', { instanceId: 'b' }),
          at(field('c', 1), 'deck', { instanceId: 'c' }),
          at(field('extra', 1), 'deck', { instanceId: 'extra' }),
        ],
      }),
      [{ op: 'draw', count: 4 }],
      { selfId: 'early' },
    );
    expect(opened.hand).toEqual(['a', 'b', 'c']);
    expect(opened.deck).toEqual(['extra']);
    expect(opened.discard).toEqual(['curse']);
    expect(opened.instances.curse.basePoints).toBeNull();
    expect(opened.instances.early.permanentMod).toBe(-2);
    expect(currentPoints(opened, 'early')).toBe(3);
    expect(opened.instances.late.permanentMod).toBe(0);
    expect(opened.instances.foe.permanentMod).toBe(0);

    const alone = executeOpcodes(
      createBattle({
        cards: [
          at(field('foe', 9), 'board', { owner: 'enemy', cell: 4, instanceId: 'foe' }),
          at(curse, 'deck', { instanceId: 'curse' }),
          at(field('kept', 1), 'deck', { instanceId: 'kept' }),
        ],
      }),
      [{ op: 'draw', count: 1 }],
      { selfId: 'foe', controller: 'player' },
    );
    expect(alone.hand).toEqual([]);
    expect(alone.deck).toEqual(['kept']);
    expect(alone.discard).toEqual(['curse']);
    expect(alone.instances.foe.permanentMod).toBe(0);

    const full = executeOpcodes(
      createBattle({
        cards: [
          at(field('body', 4), 'board', { cell: 1, instanceId: 'body' }),
          ...fillers(10, 'hand'),
          at(curse, 'deck', { instanceId: 'curse' }),
        ],
      }),
      [{ op: 'draw', count: 1 }],
      { selfId: 'body' },
    );
    expect(full.deck).toEqual(['curse']);
    expect(full.discard).toEqual([]);
    expect(full.instances.body.permanentMod).toBe(0);
  });

  it('marks swift, pollutes a chosen cell once, and throws for placeholder opcodes', () => {
    const body = field('body', 2, { swift: true });
    const result = playCard(createBattle({ cards: [at(body, 'hand')] }), { instanceId: 'body', cell: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.consumedPlay).toBe(false);

    const swift = executeOpcodes(
      createBattle({ cards: [at(field('slow', 2), 'board', { cell: 1, instanceId: 'slow' })] }),
      [{ op: 'grantSwift', target: { ref: 'self' } }, { op: 'pollute', cell: 'choice' }, { op: 'pollute', cell: 4 }],
      { selfId: 'slow', choice: { cells: [4] } },
    );
    expect(swift.instances.slow.swift).toBe(true);
    expect(swift.polluted).toEqual([4]);

    const state = createBattle({ cards: [at(field('body', 1), 'board', { cell: 1, instanceId: 'body' })] });
    const placeholders: Opcode[] = [
      { op: 'lookTop' },
      { op: 'search' },
      { op: 'discardToHand' },
      { op: 'discardToField' },
      { op: 'shuffleIntoDeck' },
      { op: 'shuffleCopy' },
      { op: 'onDrawResolve' },
    ];
    for (const opcode of placeholders) {
      expect(() => executeOpcodes(state, [opcode], { selfId: 'body' })).toThrow(`Unimplemented opcode: ${opcode.op}`);
    }
    expect(state.instances.body.zone).toBe('board');
  });

  it('grants one player follow-up and ignores the same opcode from the enemy', () => {
    const poet = field('poet', 3, { effects: [{ op: 'followUpPlay' }] });
    const result = playCard(createBattle({ cards: [at(poet, 'hand')] }), { instanceId: 'poet', cell: 1 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.followUps).toBe(1);
    expect(result.consumedPlay).toBe(true);
    expect(result.state.log).toContain('follow-up');

    const quiet = executeOpcodes(
      createBattle({ cards: [at(field('body', 2), 'board', { cell: 1, instanceId: 'body' })] }),
      [{ op: 'followUpPlay' }],
      { selfId: 'body', controller: 'enemy' },
    );
    expect(quiet.log).not.toContain('follow-up');
  });

  it('adds an ally current points before pollution, so a 1-point absorber on a polluted cell stays', () => {
    const host = field('host', 1, { effects: [{ op: 'absorbAlly' }] });
    const taken = played(
      createBattle({
        polluted: [4],
        cards: [
          at(host, 'hand', { instanceId: 'host' }),
          at(field('victim', 1), 'board', { cell: 4, instanceId: 'victim', permanentMod: 2 }),
        ],
      }),
      { instanceId: 'host', cell: 4 },
    );
    expect(cardAt(taken, 4)?.instanceId).toBe('host');
    expect(taken.instances.victim.zone).toBe('discard');
    expect(taken.instances.host.permanentMod).toBe(2);
    expect(currentPoints(taken, 'host')).toBe(3);
    expect(taken.polluted).toEqual([4]);

    const idle = executeOpcodes(taken, [{ op: 'absorbAlly' }], { selfId: 'host' });
    expect(cardAt(idle, 4)?.instanceId).toBe('host');
    expect(idle.instances.host.permanentMod).toBe(2);
  });

  it('recomputes a standing mirror aura and drops it when the source is sealed', () => {
    const twin = field('twin', 3, {
      presence: [{ amount: 2, target: { owner: 'same', selfWhileAllyMirror: true } }],
    });
    const star = field('star', 4, {
      presence: [{ amount: 2, target: { owner: 'same', mirroredAlly: true } }],
    });
    const state = createBattle({
      cards: [
        at(twin, 'board', { cell: 2, instanceId: 'a' }),
        at(twin, 'board', { cell: 8, instanceId: 'b' }),
        at(star, 'board', { cell: 5, instanceId: 'star' }),
      ],
    });
    expect(currentPoints(state, 'a')).toBe(7);
    expect(currentPoints(state, 'b')).toBe(7);
    expect(currentPoints(state, 'star')).toBe(4);
    expect(state.instances.a.permanentMod).toBe(0);
    const sealed = executeOpcodes(state, [{ op: 'seal', target: { ref: 'self' } }], { selfId: 'star' });
    expect(currentPoints(sealed, 'a')).toBe(5);
    expect(sealed.instances.a.permanentMod).toBe(0);
    expect(currentPoints(unseal(sealed, 'player'), 'a')).toBe(7);
  });
});

describe('tutorial battle scripts the kernel was missing', () => {
  it('queries orthogonal neighbors of one side, so 勘验员 does not mark every enemy', () => {
    const examiner = field('勘验员', 4, {
      effects: [{ op: 'addMark', target: { ref: 'query', owner: 'opponent', adjacentToSelf: true } }],
    });
    const state = createBattle({
      cards: [
        at(examiner, 'hand', { instanceId: 'examiner' }),
        at(field('foe', 5), 'board', { owner: 'enemy', cell: 2, instanceId: 'near' }),
        at(field('foe', 5), 'board', { owner: 'enemy', cell: 1, instanceId: 'diagonal' }),
        at(field('foe', 5), 'board', { owner: 'enemy', cell: 6, instanceId: 'side' }),
        at(field('ally', 3), 'board', { cell: 4, instanceId: 'ally' }),
      ],
    });

    expect(adjacentFieldCards(state, 5, 'enemy')).toEqual(['near', 'side']);
    expect(adjacentFieldCards(state, 5, 'player')).toEqual(['ally']);

    const next = played(state, { instanceId: 'examiner', cell: 5 });
    expect(next.instances.near.analyzed).toBe(true);
    expect(next.instances.side.analyzed).toBe(true);
    expect(next.instances.diagonal.analyzed).toBe(false);
    expect(next.instances.ally.analyzed).toBe(false);
    expect(next.instances.examiner.analyzed).toBe(false);
  });

  it('adds +2 to 解析仪 only when an adjacent enemy already has a mark', () => {
    const analyzer = field('解析仪', 4, {
      effects: [
        {
          op: 'when',
          query: { owner: 'opponent', adjacentToSelf: true, hasMark: true },
          effects: [{ op: 'modPermanent', amount: 2, target: { ref: 'self' } }],
        },
      ],
    });
    const boosted = played(
      createBattle({
        cards: [
          at(analyzer, 'hand', { instanceId: 'analyzer' }),
          at(field('foe', 4), 'board', { owner: 'enemy', cell: 2, instanceId: 'marked', analyzed: true }),
          at(field('foe', 4), 'board', { owner: 'enemy', cell: 6, instanceId: 'plain' }),
          at(field('foe', 4), 'board', { owner: 'enemy', cell: 1, instanceId: 'diagonal', analyzed: true }),
          at(field('ally', 3), 'board', { cell: 4, instanceId: 'ally', analyzed: true }),
        ],
      }),
      { instanceId: 'analyzer', cell: 5 },
    );
    expect(boosted.instances.analyzer.permanentMod).toBe(2);

    const quiet = played(
      createBattle({
        cards: [
          at(analyzer, 'hand', { instanceId: 'analyzer' }),
          at(field('foe', 4), 'board', { owner: 'enemy', cell: 2, instanceId: 'plain' }),
          at(field('foe', 4), 'board', { owner: 'enemy', cell: 1, instanceId: 'diagonal', analyzed: true }),
        ],
      }),
      { instanceId: 'analyzer', cell: 5 },
    );
    expect(quiet.instances.analyzer.permanentMod).toBe(0);
  });

  it('runs each opcode on every query hit for 勘验员, and on nobody else', () => {
    const examiner = field('勘验员', 4, {
      effects: [
        {
          op: 'forEach',
          query: { owner: 'opponent', adjacentToSelf: true },
          effects: [
            { op: 'addMark', target: { ref: 'each' } },
            { op: 'modPermanent', amount: -1, target: { ref: 'each' } },
          ],
        },
      ],
    });
    const next = played(
      createBattle({
        cards: [
          at(examiner, 'hand', { instanceId: 'examiner' }),
          at(field('foe', 5), 'board', { owner: 'enemy', cell: 2, instanceId: 'near' }),
          at(field('foe', 5), 'board', { owner: 'enemy', cell: 1, instanceId: 'diagonal' }),
          at(field('foe', 5), 'board', { owner: 'enemy', cell: 8, instanceId: 'far' }),
          at(field('ally', 3), 'board', { cell: 4, instanceId: 'ally' }),
        ],
      }),
      { instanceId: 'examiner', cell: 5 },
    );

    expect(next.instances.near.analyzed).toBe(true);
    expect(next.instances.near.permanentMod).toBe(-1);
    expect(next.instances.far.analyzed).toBe(true);
    expect(next.instances.far.permanentMod).toBe(-1);
    expect(next.instances.diagonal.analyzed).toBe(false);
    expect(next.instances.diagonal.permanentMod).toBe(0);
    expect(next.instances.ally.analyzed).toBe(false);
    expect(next.instances.ally.permanentMod).toBe(0);
    expect(next.instances.examiner.permanentMod).toBe(0);
  });

  it('lists a marked enemy for 攻击炮台 and applies -2 only after that pick', () => {
    const turret = field('攻击炮台', 6, {
      turnEndTarget: { owner: 'opponent', hasMark: true },
      onTurnEnd: [{ op: 'modPermanent', amount: -2, target: { ref: 'choice', index: 0 } }],
    });
    const bell = field('bell', 1, { onTurnEnd: [{ op: 'gainFaith', amount: 1 }] });
    const state = createBattle({
      cards: [
        at(bell, 'board', { cell: 3, instanceId: 'bell' }),
        at(turret, 'board', { cell: 5, instanceId: 'turret' }),
        at(field('foe', 5), 'board', { owner: 'enemy', cell: 1, instanceId: 'marked', analyzed: true }),
        at(field('foe', 5), 'board', { owner: 'enemy', cell: 2, instanceId: 'plain' }),
        at(field('ally', 5), 'board', { cell: 4, instanceId: 'ally', analyzed: true }),
        at(field('foe', 5), 'board', { owner: 'enemy', cell: 9, instanceId: 'other', analyzed: true }),
      ],
    });

    expect(pendingTurnEndTargets(state, 'player')).toEqual([{ sourceId: 'turret', targets: ['marked', 'other'] }]);

    const chosen = resolveTurnEndEffects(state, 'player', { targets: ['other'] });
    expect(chosen.instances.other.permanentMod).toBe(-2);
    expect(chosen.instances.marked.permanentMod).toBe(0);
    expect(chosen.instances.plain.permanentMod).toBe(0);
    expect(chosen.instances.ally.permanentMod).toBe(0);
    expect(chosen.faith.player).toBe(1);

    const rejected = resolveTurnEndEffects(state, 'player', { targets: ['plain'] });
    expect(rejected.instances.other.permanentMod).toBe(0);
    expect(rejected.instances.marked.permanentMod).toBe(0);
    expect(rejected.faith.player).toBe(1);

    const untouched = runTurnEndEffects(state, 'player');
    expect(untouched.instances.other.permanentMod).toBe(0);
    expect(untouched.faith.player).toBe(1);
    expect(resolveTurnEndEffects(state, 'player')).toEqual(untouched);
    expect(resolveTurnEndEffects(state, 'player', {})).toEqual(untouched);
    expect(resolveTurnEndEffects(state, 'player', { targets: [] })).toEqual(untouched);
  });

  it('lists an adjacent enemy for 科学研究器, and does nothing when that pick is missing', () => {
    const device = field('科学研究器', 4, {
      turnEndTarget: { owner: 'opponent', adjacentToSelf: true },
      onTurnEnd: [{ op: 'addMark', target: { ref: 'choice', index: 0 } }],
    });
    const state = createBattle({
      cards: [
        at(device, 'board', { cell: 5, instanceId: 'device' }),
        at(field('foe', 4), 'board', { owner: 'enemy', cell: 2, instanceId: 'near' }),
        at(field('foe', 4), 'board', { owner: 'enemy', cell: 1, instanceId: 'diagonal' }),
        at(field('foe', 4), 'board', { owner: 'enemy', cell: 8, instanceId: 'far' }),
        at(field('ally', 3), 'board', { cell: 4, instanceId: 'ally' }),
      ],
    });

    expect(pendingTurnEndTargets(state, 'player')).toEqual([{ sourceId: 'device', targets: ['near', 'far'] }]);

    const chosen = resolveTurnEndEffects(state, 'player', { targets: ['near'] });
    expect(chosen.instances.near.analyzed).toBe(true);
    expect(chosen.instances.far.analyzed).toBe(false);
    expect(chosen.instances.diagonal.analyzed).toBe(false);
    expect(chosen.instances.ally.analyzed).toBe(false);

    const rejected = resolveTurnEndEffects(state, 'player', { targets: ['diagonal'] });
    expect(rejected.instances.near.analyzed).toBe(false);
    expect(rejected.instances.diagonal.analyzed).toBe(false);

    const none = createBattle({
      cards: [
        at(device, 'board', { cell: 5, instanceId: 'device' }),
        at(field('foe', 4), 'board', { owner: 'enemy', cell: 1, instanceId: 'diagonal' }),
      ],
    });
    expect(pendingTurnEndTargets(none, 'player')).toEqual([{ sourceId: 'device', targets: [] }]);
    const skipped = resolveTurnEndEffects(none, 'player', { targets: ['diagonal'] });
    expect(skipped.instances.diagonal.analyzed).toBe(false);
    expect(runTurnEndEffects(none, 'player').instances.diagonal.analyzed).toBe(false);
    expect(resolveTurnEndEffects(none, 'player')).toEqual(runTurnEndEffects(none, 'player'));
  });

  it('marks a player card with 失控机械 only after it enters an orthogonal neighbor', () => {
    const machine = field('失控机械', 5, {
      reactions: [
        {
          event: 'played',
          subject: { adjacentToSelf: true, owner: 'player' },
          effects: [{ op: 'addMark', target: { ref: 'eventSubject' } }],
        },
      ],
    });
    const scout = field('斥候', 4, {
      effects: [{ op: 'modPermanent', amount: 2, target: { ref: 'self' } }],
    });
    const opened = createBattle({
      cards: [
        at(machine, 'board', { owner: 'enemy', cell: 5, instanceId: 'machine' }),
        at(field('bystander', 2), 'board', { cell: 4, instanceId: 'bystander' }),
        at(scout, 'hand', { instanceId: 'scout' }),
      ],
    });

    const adjacent = played(opened, { instanceId: 'scout', cell: 2 });
    expect(adjacent.instances.scout.analyzed).toBe(true);
    expect(adjacent.instances.scout.permanentMod).toBe(2);
    expect(adjacent.instances.bystander.analyzed).toBe(false);
    expect(adjacent.instances.machine.analyzed).toBe(false);
    const enterAt = adjacent.log.indexOf('enter:scout');
    const reactAt = adjacent.log.indexOf('react:machine:played');
    expect(enterAt).toBeGreaterThanOrEqual(0);
    expect(reactAt).toBeGreaterThan(enterAt);

    const diagonal = played(
      createBattle({
        cards: [
          at(machine, 'board', { owner: 'enemy', cell: 5, instanceId: 'machine' }),
          at(scout, 'hand', { instanceId: 'scout' }),
        ],
      }),
      { instanceId: 'scout', cell: 1 },
    );
    expect(diagonal.instances.scout.analyzed).toBe(false);
    expect(diagonal.instances.scout.permanentMod).toBe(2);
    expect(diagonal.log.some((line) => line.startsWith('react:machine'))).toBe(false);

    const enemyPlay = played(
      createBattle({
        cards: [
          at(machine, 'board', { owner: 'enemy', cell: 5, instanceId: 'machine' }),
          at(field('raider', 3), 'hand', { owner: 'enemy', instanceId: 'raider' }),
        ],
      }),
      { instanceId: 'raider', cell: 6 },
    );
    expect(enemyPlay.instances.raider.analyzed).toBe(false);
    expect(enemyPlay.log.some((line) => line.startsWith('react:machine'))).toBe(false);
  });
});

describe('spawn on a random empty cell or a mirror cell', () => {
  it('rolls one ascending empty cell and does not roll when none are open', () => {
    const token = field('token', 1, { exhaust: true });
    const source = field('source', 2);
    const open = createBattle({
      seed: 4,
      polluted: [3, 7, 9],
      catalog: [token],
      cards: [
        at(source, 'board', { cell: 5, instanceId: 'source' }),
        at(field('a', 1), 'board', { cell: 1, instanceId: 'a' }),
        at(field('b', 1), 'board', { cell: 2, instanceId: 'b' }),
        at(field('c', 1), 'board', { cell: 4, instanceId: 'c' }),
        at(field('d', 1), 'board', { cell: 6, instanceId: 'd' }),
        at(field('e', 1), 'board', { cell: 8, instanceId: 'e' }),
      ],
    });
    const holes: CellId[] = [3, 7, 9];
    const rolled = nextInt(open.rng, holes.length);
    const spawned = executeOpcodes(
      open,
      [{ op: 'spawn', definitionId: 'token', cell: 'randomEmpty', basePoints: 2, owner: 'opponent' }],
      { selfId: 'source' },
    );
    const shade = cardAt(spawned, holes[rolled.n]);
    expect(shade?.basePoints).toBe(2);
    expect(shade?.owner).toBe('enemy');
    expect(shade?.permanentMod).toBe(0);
    expect(shade?.exhaust).toBe(true);
    expect(spawned.rng).toBe(rolled.rng);
    expect(spawned.log.some((line) => line === `enter:${shade?.instanceId}`)).toBe(true);
    for (const cell of holes) {
      if (cell === holes[rolled.n]) continue;
      expect(cardAt(spawned, cell)).toBeNull();
    }

    const full = createBattle({
      catalog: [token],
      cards: ([1, 2, 3, 4, 5, 6, 7, 8, 9] as CellId[]).map((cell) =>
        at(source, 'board', { cell, instanceId: `s${cell}` }),
      ),
    });
    const quiet = executeOpcodes(full, [{ op: 'spawn', definitionId: 'token', cell: 'randomEmpty' }], { selfId: 's1' });
    expect(quiet.rng).toBe(full.rng);
    expect(Object.keys(quiet.instances).sort()).toEqual(Object.keys(full.instances).sort());
    expect(quiet.log.some((line) => line.startsWith('enter:'))).toBe(false);
  });

  it('spawns on the subject mirror with half the printed base and skips cell 5 or a filled mirror', () => {
    const shade = field('shade', 0, { exhaust: true, effects: [] });
    const carrier = field('carrier', 3, {
      fightReactions: [
        {
          event: 'entered',
          subject: { owner: 'player' },
          effects: [
            {
              op: 'spawn',
              definitionId: 'shade',
              cell: 'mirrorOfSubject',
              owner: 'enemy',
              basePoints: 'halfSubjectBase',
            },
          ],
        },
      ],
      tokens: [shade],
    });
    const odd = field('odd', 5);
    const entered = played(
      createBattle({
        polluted: [6],
        cards: [
          at(carrier, 'board', { cell: 2, instanceId: 'carrier' }),
          at(odd, 'hand', { instanceId: 'odd', permanentMod: 6 }),
        ],
      }),
      { instanceId: 'odd', cell: 4 },
    );
    const born = cardAt(entered, 6);
    expect(born?.definitionId).toBe('shade');
    expect(born?.owner).toBe('enemy');
    expect(born?.basePoints).toBe(2);
    expect(born?.permanentMod).toBe(0);
    expect(born?.exhaust).toBe(true);
    expect(currentPoints(entered, 'odd')).toBe(11);

    const center = played(
      createBattle({
        cards: [at(carrier, 'board', { cell: 2, instanceId: 'carrier' }), at(odd, 'hand', { instanceId: 'odd' })],
      }),
      { instanceId: 'odd', cell: 5 },
    );
    expect(cardAt(center, 5)?.instanceId).toBe('odd');
    expect(Object.values(center.instances).some((card) => card.definitionId === 'shade')).toBe(false);

    const filled = played(
      createBattle({
        cards: [
          at(carrier, 'board', { cell: 2, instanceId: 'carrier' }),
          at(field('wall', 4), 'board', { owner: 'enemy', cell: 9, instanceId: 'wall' }),
          at(odd, 'hand', { instanceId: 'odd' }),
        ],
      }),
      { instanceId: 'odd', cell: 1 },
    );
    expect(cardAt(filled, 9)?.instanceId).toBe('wall');
    expect(Object.values(filled.instances).some((card) => card.definitionId === 'shade')).toBe(false);
  });
});

describe('seal listeners and clearing one negative', () => {
  it('hears a new seal, and does not hear transfer or a seal that was already there', () => {
    const pillar = field('pillar', 5, {
      reactions: [
        {
          event: 'sealed',
          onBoard: true,
          subject: { ownerRelation: 'opponent' },
          effects: [{ op: 'modPermanent', amount: 2, target: { ref: 'self' } }],
        },
      ],
    });
    const foe = field('foe', 4);
    const state = createBattle({
      cards: [
        at(pillar, 'board', { cell: 5, owner: 'enemy', instanceId: 'pillar' }),
        at(foe, 'board', { cell: 1, instanceId: 'foe' }),
        at(foe, 'board', { cell: 9, owner: 'enemy', instanceId: 'mate' }),
      ],
    });
    const moved = executeOpcodes(
      state,
      [{ op: 'transferOwner', target: { ref: 'instance', id: 'foe' }, to: 'enemy' }],
      { selfId: 'pillar', controller: 'enemy' },
    );
    expect(moved.instances.foe).toMatchObject({ owner: 'enemy', sealed: false });
    expect(moved.instances.pillar.permanentMod).toBe(0);
    expect(currentPoints(moved, 'pillar')).toBe(5);

    const sameSide = executeOpcodes(state, [{ op: 'seal', target: { ref: 'instance', id: 'mate' } }], {
      selfId: 'pillar',
    });
    expect(sameSide.instances.mate.sealed).toBe(true);
    expect(sameSide.instances.pillar.permanentMod).toBe(0);

    const sealed = executeOpcodes(state, [{ op: 'seal', target: { ref: 'instance', id: 'foe' } }], { selfId: 'pillar' });
    expect(sealed.instances.foe.sealed).toBe(true);
    expect(sealed.instances.pillar.permanentMod).toBe(2);
    expect(currentPoints(sealed, 'pillar')).toBe(7);
    const again = executeOpcodes(sealed, [{ op: 'seal', target: { ref: 'instance', id: 'foe' } }], { selfId: 'pillar' });
    expect(again.instances.pillar.permanentMod).toBe(2);
  });

  it('clears a seal or one debuff layer, and leaves a parse mark in place', () => {
    const rite = spell('rite', {
      effects: [
        { op: 'giveProtect', target: { ref: 'choice', index: 0 } },
        { op: 'clearNegative', target: { ref: 'choice', index: 0 } },
      ],
      spellNeeds: 'ally',
      spellTarget: { owner: 'same' },
    });
    const host = field('host', 4);
    const opened = createBattle({
      cards: [
        at(rite, 'hand', { instanceId: 'rite' }),
        at(host, 'board', { cell: 1, instanceId: 'host', sealed: true, permanentMod: -3, analyzed: true }),
      ],
    });
    const kept = played(opened, { instanceId: 'rite', choice: { targets: ['host'], negative: 'seal' } });
    expect(kept.instances.host).toMatchObject({ sealed: false, permanentMod: -3, analyzed: true, protected: true });
    expect(currentPoints(kept, 'host')).toBe(1);

    const lifted = played(
      createBattle({
        cards: [
          at(rite, 'hand', { instanceId: 'rite' }),
          at(host, 'board', { cell: 1, instanceId: 'host', sealed: true, permanentMod: -3, analyzed: true }),
        ],
      }),
      { instanceId: 'rite', choice: { targets: ['host'], negative: 'debuff' } },
    );
    expect(lifted.instances.host).toMatchObject({ sealed: true, permanentMod: -2, analyzed: true, protected: true });
    expect(currentPoints(lifted, 'host')).toBe(2);
    expect(totalPoints(lifted, 'player')).toBe(0);

    const layer = played(
      createBattle({
        cards: [
          at(rite, 'hand', { instanceId: 'rite' }),
          at(host, 'board', { cell: 1, instanceId: 'host', permanentMod: -2, analyzed: true }),
        ],
      }),
      { instanceId: 'rite', choice: { targets: ['host'] } },
    );
    expect(layer.instances.host).toMatchObject({ sealed: false, permanentMod: -1, analyzed: true, protected: true });
    expect(currentPoints(layer, 'host')).toBe(3);
  });
});
