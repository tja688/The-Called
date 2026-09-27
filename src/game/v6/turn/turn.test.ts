import { describe, expect, it } from 'vitest';
import { currentPoints, totalPoints, type CardDefinition, type CardSetup, type CellId } from '../rules';
import { scriptedCard } from '../scripts';
import { answerChoice, endTurn, play, startMatch, type MatchState, type RevealedIntent } from './index';

function field(id: string, points: number, extra: Partial<CardDefinition> = {}): CardDefinition {
  return { id, name: id, ruleType: 'field', basePoints: points, ...extra };
}

function spell(id: string, extra: Partial<CardDefinition> = {}): CardDefinition {
  return { id, name: id, ruleType: 'spell', basePoints: null, ...extra };
}

function copies(definition: CardDefinition, count: number, zone: CardSetup['zone']): CardSetup[] {
  return Array.from({ length: count }, (_, index) => ({
    definition,
    owner: 'player' as const,
    zone,
    instanceId: `${definition.id}-${index}`,
  }));
}

function occupy(owner: CardSetup['owner'], points: number, cells: CellId[]): CardSetup[] {
  return cells.map((cell) => ({
    definition: field(`${owner}-${cell}`, points),
    owner,
    zone: 'board' as const,
    cell,
    instanceId: `${owner}-${cell}`,
  }));
}

function handId(match: MatchState, definitionId: string): string {
  const id = match.battle.hand.find((entry) => match.battle.instances[entry].definitionId === definitionId);
  if (!id) throw new Error(`missing ${definitionId}`);
  return id;
}

function seenNames(calls: RevealedIntent[]): string[] {
  return calls.map((intent) => intent.name);
}

describe('opening and the first action', () => {
  it('draws 4, then a 5th before the player acts, and does not enter presets or recycle discard', () => {
    const idol = field('idol', 3, { effects: [{ op: 'gainFaith', amount: 5 }] });
    const brick = field('brick', 1);
    const match = startMatch(
      {
        seed: 7,
        cards: [
          ...copies(brick, 6, 'deck'),
          { definition: idol, owner: 'player', zone: 'board', cell: 5, instanceId: 'idol' },
          { definition: field('buried', 1), owner: 'player', zone: 'discard', instanceId: 'buried' },
        ],
        intents: [{ definition: field('Alpha', 2) }],
      },
      { placeIntent: () => 'skip' },
    );

    expect(match.phase).toBe('playerAction');
    expect(match.side).toBe('player');
    expect(match.over).toBe(false);
    expect(match.playsRemaining).toBe(1);
    expect(match.battle.hand).toHaveLength(5);
    expect(match.battle.deck).toHaveLength(1);
    expect(match.battle.discard).toEqual(['buried']);
    expect(match.battle.hand).not.toContain('buried');
    expect(match.battle.faith).toEqual({ player: 0, enemy: 0 });
    expect(match.battle.cells[5]).toBe('idol');
    expect(match.battle.log.some((line) => line.startsWith('enter:'))).toBe(false);
    expect(match.revealed?.name).toBe('Alpha');
    expect(match.revealed).not.toHaveProperty('cell');
  });
});

describe('intent reveal', () => {
  it('shows the card name and effect, and a skip still advances the index', () => {
    const calls: RevealedIntent[] = [];
    const alpha = field('Alpha', 3, { effects: [{ op: 'gainFaith', amount: 1 }] });
    const beta = field('Beta', 3);
    let match = startMatch(
      {
        seed: 1,
        cards: copies(field('brick', 1), 1, 'deck'),
        intents: [{ definition: alpha }, { definition: beta }],
      },
      {
        placeIntent: (_battle, intent) => {
          calls.push(intent);
          return 'skip';
        },
      },
    );

    expect(match.revealed?.name).toBe('Alpha');
    expect(match.revealed?.effects).toEqual([{ op: 'gainFaith', amount: 1 }]);
    expect(match.revealed).not.toHaveProperty('cell');
    expect(match.intentIndex).toBe(2);

    match = endTurn(match);

    expect(seenNames(calls)).toEqual(['Alpha']);
    expect(calls[0]).not.toHaveProperty('cell');
    expect(match.battle.faith.enemy).toBe(0);
    expect(Object.values(match.battle.instances).every((card) => card.definitionId !== 'Alpha')).toBe(true);
    expect(match.revealed?.name).toBe('Beta');
    expect(match.intentIndex).toBe(1);
    expect(match.phase).toBe('playerAction');
    expect(match.over).toBe(false);
  });
});

describe('forced settlement', () => {
  it('judges a full preset board by points on the first turn start and never offers a play', () => {
    const match = startMatch(
      {
        seed: 3,
        cards: [
          ...occupy('player', 3, [1, 2, 3, 4, 5]),
          ...occupy('enemy', 2, [6, 7, 8, 9]),
          ...copies(field('brick', 1), 6, 'deck'),
        ],
        intents: [{ definition: field('Alpha', 9, { name: 'Alpha' }) }],
      },
      { placeIntent: () => 1 },
    );

    expect(match.over).toBe(true);
    expect(match.phase).toBe('playerTurnStart');
    expect(match.winner).toBe('player');
    expect(totalPoints(match.battle, 'player')).toBeGreaterThan(totalPoints(match.battle, 'enemy'));
    expect(match.battle.forceReasons).toContain('board');
    expect(match.revealed).toBeNull();
    expect(match.intentIndex).toBe(1);
    expect(match.battle.hand).toHaveLength(4);
    expect(match.battle.deck).toHaveLength(2);
    expect(play(match, { instanceId: 'brick-0', cell: 1 })).toEqual({
      ok: false,
      reason: 'match-over',
      match,
    });
  });

  it('records a full board on the play and judges it on the next turn start', () => {
    let placed = 0;
    const finisher = field('finisher', 10);
    let match = startMatch(
      {
        seed: 4,
        cards: [...occupy('enemy', 1, [1, 2, 3, 4, 5, 6, 7, 8]), ...copies(finisher, 5, 'deck')],
        intents: [{ definition: field('Alpha', 8, { name: 'Alpha' }) }],
      },
      {
        placeIntent: () => {
          placed += 1;
          return 9;
        },
      },
    );

    const played = play(match, { instanceId: handId(match, 'finisher'), cell: 9 });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    match = played.match;
    expect(match.over).toBe(false);
    expect(match.winner).toBeNull();
    expect(match.phase).toBe('playerAction');
    expect(match.battle.forceSettlement).toBe(true);
    expect(match.battle.forceReasons).toContain('board');

    match = endTurn(match);
    expect(placed).toBe(0);
    expect(match.over).toBe(true);
    expect(match.phase).toBe('enemyTurnStart');
    expect(match.winner).toBe('player');
    expect(totalPoints(match.battle, 'player')).toBe(10);
    expect(totalPoints(match.battle, 'enemy')).toBe(8);
    expect(play(match, { instanceId: handId(match, 'finisher'), cell: 1 }).ok).toBe(false);
  });

  it('raises resource when the deck is empty and nothing in hand is legal', () => {
    let placed = 0;
    const rite = spell('rite', { spellNeeds: 'enemy' });
    const match = endTurn(
      startMatch(
        {
          seed: 5,
          cards: copies(rite, 4, 'deck'),
          intents: [{ definition: field('Alpha', 1) }],
        },
        {
          placeIntent: () => {
            placed += 1;
            return 1;
          },
        },
      ),
    );

    expect(match.battle.deck).toHaveLength(0);
    expect(match.battle.forceReasons).toContain('resource');
    expect(match.battle.forceReasons).not.toContain('board');
    expect(match.over).toBe(true);
    expect(match.phase).toBe('enemyTurnStart');
    expect(match.winner).toBe('player');
    expect(placed).toBe(0);
  });

  it('does not raise resource when the player ends with a card they could still play', () => {
    let placed = 0;
    const match = endTurn(
      startMatch(
        {
          seed: 6,
          cards: copies(field('brick', 2), 5, 'deck'),
          intents: [{ definition: field('Alpha', 1) }, { definition: field('Beta', 1) }],
        },
        {
          placeIntent: () => {
            placed += 1;
            return 'skip';
          },
        },
      ),
    );

    expect(match.battle.forceSettlement).toBe(false);
    expect(match.battle.forceReasons).not.toContain('resource');
    expect(match.over).toBe(false);
    expect(match.phase).toBe('playerAction');
    expect(match.playsRemaining).toBe(1);
    expect(placed).toBe(1);
    expect(match.revealed?.name).toBe('Beta');
  });

  it('keeps an already raised special flag and judges it on the enemy turn start', () => {
    let placed = 0;
    const bell = field('bell', 6, { effects: [{ op: 'forceSettlement' }] });
    const opened = startMatch(
      {
        seed: 8,
        cards: [atDeck(bell, 'bell'), ...copies(field('brick', 2), 4, 'deck')],
        intents: [{ definition: field('Alpha', 1) }],
      },
      {
        placeIntent: () => {
          placed += 1;
          return 2;
        },
      },
    );
    const played = play(opened, { instanceId: handId(opened, 'bell'), cell: 1 });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.match.over).toBe(false);
    expect(played.match.battle.forceReasons).toContain('special');

    const ended = endTurn(played.match);
    expect(ended.battle.forceReasons).toContain('special');
    expect(ended.battle.forceReasons).not.toContain('resource');
    expect(ended.over).toBe(true);
    expect(ended.phase).toBe('enemyTurnStart');
    expect(ended.winner).toBe('player');
    expect(placed).toBe(0);
  });

  it('judges the clock in the same enemy turn-start pipeline that arms it', () => {
    let placed = 0;
    const clock = field('clock', 4, { timer: 1, onTimer: [{ op: 'forceSettlement' }] });
    const opened = startMatch(
      {
        seed: 9,
        cards: [
          { definition: clock, owner: 'enemy', zone: 'board', cell: 1, instanceId: 'clock' },
          ...copies(field('brick', 1), 5, 'deck'),
        ],
        intents: [{ definition: field('Alpha', 9, { name: 'Alpha' }) }],
      },
      {
        placeIntent: () => {
          placed += 1;
          return 2;
        },
      },
    );

    expect(opened.phase).toBe('playerAction');
    expect(opened.battle.instances.clock.timer).toBe(1);
    expect(opened.battle.forceSettlement).toBe(false);

    const ended = endTurn(opened);
    expect(ended.over).toBe(true);
    expect(ended.phase).toBe('enemyTurnStart');
    expect(ended.battle.forceReasons).toContain('special');
    expect(ended.winner).toBe('enemy');
    expect(ended.battle.cells[1]).toBe('clock');
    expect(placed).toBe(0);
    expect(Object.values(ended.battle.instances).every((card) => card.definitionId !== 'Alpha')).toBe(true);
  });
});

describe('player action', () => {
  it('spends the non-swift play and afterwards allows only swift or ending', () => {
    const brick = field('brick', 2);
    const quick = field('quick', 2, { swift: true });
    const match = startMatch(
      {
        seed: 11,
        cards: [...copies(brick, 4, 'deck'), { definition: quick, owner: 'player', zone: 'deck', instanceId: 'quick' }],
        intents: [{ definition: field('Alpha', 1) }],
      },
      { placeIntent: () => 'skip' },
    );

    const first = play(match, { instanceId: handId(match, 'brick'), cell: 1 });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.match.playsRemaining).toBe(0);

    const blocked = play(first.match, { instanceId: handId(first.match, 'brick'), cell: 2 });
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.reason).toBe('no-plays');
    expect(blocked.match.battle.cells[2]).toBeNull();

    const swift = play(first.match, { instanceId: handId(first.match, 'quick'), cell: 2 });
    expect(swift.ok).toBe(true);
    if (!swift.ok) return;
    expect(swift.match.playsRemaining).toBe(0);
    expect(swift.match.battle.cells[2]).toBe('quick');
  });
});

function atDeck(definition: CardDefinition, instanceId: string): CardSetup {
  return { definition, owner: 'player', zone: 'deck', instanceId };
}

describe('turn-end choices', () => {
  it('stops for the player, ignores an illegal pick, then continues with the chosen card only', () => {
    let placed = 0;
    const researcher = scriptedCard('科学研究器').definition;
    const turret = scriptedCard('攻击炮台').definition;
    const foe = scriptedCard('斥候').definition;
    const bell = field('bell', 1, { onTurnEnd: [{ op: 'gainFaith', amount: 1 }] });
    const opened = startMatch(
      {
        seed: 2,
        cards: [
          { definition: bell, owner: 'player', zone: 'board', cell: 1, instanceId: 'bell' },
          { definition: researcher, owner: 'player', zone: 'board', cell: 2, instanceId: 'researcher' },
          { definition: turret, owner: 'player', zone: 'board', cell: 6, instanceId: 'turret' },
          { definition: foe, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'near' },
          { definition: foe, owner: 'enemy', zone: 'board', cell: 9, instanceId: 'marked', analyzed: true },
          ...copies(field('brick', 1), 5, 'deck'),
        ],
        intents: [{ definition: field('Alpha', 1) }],
      },
      {
        placeIntent: () => {
          placed += 1;
          return 'skip';
        },
      },
    );

    const waiting = endTurn(opened);
    expect(waiting.phase).toBe('playerTurnEnd');
    expect(waiting.pendingChoice).toEqual({ sourceId: 'researcher', targets: ['near'] });
    expect(waiting.battle.instances.near.analyzed).toBe(false);
    expect(waiting.battle.instances.marked.permanentMod).toBe(0);
    expect(waiting.battle.faith.player).toBe(1);
    expect(placed).toBe(0);

    const stuck = endTurn(waiting);
    expect(stuck.pendingChoice?.sourceId).toBe('researcher');
    expect(answerChoice(waiting, 'marked').pendingChoice?.sourceId).toBe('researcher');
    expect(stuck.battle.instances.near.analyzed).toBe(false);

    const turretWait = answerChoice(waiting, 'near');
    expect(turretWait.battle.instances.near.analyzed).toBe(true);
    expect(turretWait.pendingChoice).toEqual({ sourceId: 'turret', targets: ['near', 'marked'] });
    expect(turretWait.battle.faith.player).toBe(1);
    expect(placed).toBe(0);

    const continued = answerChoice(turretWait, 'marked');
    expect(continued.pendingChoice).toBeNull();
    expect(continued.phase).toBe('playerAction');
    expect(currentPoints(continued.battle, 'marked')).toBe(2);
    expect(continued.battle.instances.near.permanentMod).toBe(0);
    expect(continued.battle.faith.player).toBe(1);
    expect(placed).toBe(1);
  });

  it('skips a turn-end effect that has no legal target', () => {
    const device = scriptedCard('科学研究器').definition;
    const foe = scriptedCard('斥候').definition;
    const ended = endTurn(
      startMatch(
        {
          seed: 3,
          cards: [
            { definition: device, owner: 'player', zone: 'board', cell: 1, instanceId: 'device' },
            { definition: foe, owner: 'enemy', zone: 'board', cell: 9, instanceId: 'far' },
            ...copies(field('brick', 1), 5, 'deck'),
          ],
          intents: [{ definition: field('Alpha', 1) }],
        },
        { placeIntent: () => 'skip' },
      ),
    );
    expect(ended.pendingChoice).toBeNull();
    expect(ended.phase).toBe('playerAction');
    expect(ended.battle.instances.far.analyzed).toBe(false);
  });

  it('lets the enemy pick the highest marked card, and the highest adjacent card, without waiting', () => {
    const turret = scriptedCard('攻击炮台').definition;
    const body = scriptedCard('斥候').definition;
    const turretEnded = endTurn(
      startMatch(
        {
          seed: 4,
          cards: [
            { definition: turret, owner: 'enemy', zone: 'board', cell: 5, instanceId: 'turret' },
            { definition: body, owner: 'player', zone: 'board', cell: 3, instanceId: 'tied-low', analyzed: true },
            { definition: body, owner: 'player', zone: 'board', cell: 7, instanceId: 'tied-high', analyzed: true },
            { definition: body, owner: 'player', zone: 'board', cell: 9, instanceId: 'weaker', analyzed: true, permanentMod: -1 },
            ...copies(field('brick', 1), 5, 'deck'),
          ],
          intents: [{ definition: field('Alpha', 1) }],
        },
        { placeIntent: () => 'skip' },
      ),
    );
    expect(turretEnded.pendingChoice).toBeNull();
    expect(turretEnded.phase).toBe('playerAction');
    expect(currentPoints(turretEnded.battle, 'tied-low')).toBe(2);
    expect(currentPoints(turretEnded.battle, 'tied-high')).toBe(4);
    expect(currentPoints(turretEnded.battle, 'weaker')).toBe(3);

    const researcher = scriptedCard('科学研究器').definition;
    const researchEnded = endTurn(
      startMatch(
        {
          seed: 5,
          cards: [
            { definition: researcher, owner: 'enemy', zone: 'board', cell: 2, instanceId: 'device' },
            { definition: body, owner: 'player', zone: 'board', cell: 1, instanceId: 'low' },
            { definition: scriptedCard('钻心器').definition, owner: 'player', zone: 'board', cell: 5, instanceId: 'high' },
            { definition: scriptedCard('钻心器').definition, owner: 'player', zone: 'board', cell: 9, instanceId: 'far', permanentMod: 4 },
            ...copies(field('brick', 1), 5, 'deck'),
          ],
          intents: [{ definition: field('Alpha', 1) }],
        },
        { placeIntent: () => 'skip' },
      ),
    );
    expect(researchEnded.pendingChoice).toBeNull();
    expect(researchEnded.battle.instances.high.analyzed).toBe(true);
    expect(researchEnded.battle.instances.low.analyzed).toBe(false);
    expect(researchEnded.battle.instances.far.analyzed).toBe(false);
  });

  it('marks the highest player card when the enemy plays 弱点采样机, and the lower cell on a tie', () => {
    const sampler = scriptedCard('弱点采样机').definition;
    const highest = endTurn(
      startMatch(
        {
          seed: 6,
          cards: [
            { definition: scriptedCard('斥候').definition, owner: 'player', zone: 'board', cell: 1, instanceId: 'low' },
            { definition: scriptedCard('钻心器').definition, owner: 'player', zone: 'board', cell: 3, instanceId: 'high' },
            ...copies(field('brick', 1), 5, 'deck'),
          ],
          intents: [{ definition: sampler }],
        },
        { placeIntent: () => 9 },
      ),
    );
    expect(highest.pendingChoice).toBeNull();
    expect(highest.battle.cells[9]).toBeTruthy();
    expect(highest.battle.instances.high.analyzed).toBe(true);
    expect(highest.battle.instances.low.analyzed).toBe(false);

    const tied = endTurn(
      startMatch(
        {
          seed: 7,
          cards: [
            { definition: scriptedCard('斥候').definition, owner: 'player', zone: 'board', cell: 8, instanceId: 'late' },
            { definition: scriptedCard('斥候').definition, owner: 'player', zone: 'board', cell: 1, instanceId: 'early' },
            ...copies(field('brick', 1), 5, 'deck'),
          ],
          intents: [{ definition: sampler }],
        },
        { placeIntent: () => 9 },
      ),
    );
    expect(tied.battle.instances.early.analyzed).toBe(true);
    expect(tied.battle.instances.late.analyzed).toBe(false);
  });

  it('waits for the player to give +3 when their card leaves, then stays in the action', () => {
    const rite = spell('rite', { effects: [{ op: 'remove', target: { ref: 'instance', id: 'ward' } }] });
    const ward = field('ward', 3, {
      onLeave: [{ op: 'modPermanent', amount: 3, target: { ref: 'choice', index: 0 } }],
      leaveTarget: { owner: 'same' },
    });
    const opened = startMatch(
      {
        seed: 3,
        cards: [
          { definition: rite, owner: 'player', zone: 'hand', instanceId: 'rite' },
          { definition: ward, owner: 'player', zone: 'board', cell: 5, instanceId: 'ward' },
          { definition: field('low', 2), owner: 'player', zone: 'board', cell: 1, instanceId: 'low' },
          { definition: field('high', 8), owner: 'player', zone: 'board', cell: 9, instanceId: 'high' },
          ...copies(field('brick', 1), 4, 'deck'),
        ],
        intents: [{ definition: field('Alpha', 1) }],
      },
      { placeIntent: () => 2 },
    );
    const played = play(opened, { instanceId: 'rite' });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.match.phase).toBe('playerAction');
    expect(played.match.pendingChoice).toEqual({ sourceId: 'ward', targets: ['low', 'high'] });
    expect(currentPoints(played.match.battle, 'low')).toBe(2);
    expect(currentPoints(played.match.battle, 'high')).toBe(8);
    const ignored = answerChoice(played.match, 'missing');
    expect(ignored.pendingChoice?.sourceId).toBe('ward');
    expect(currentPoints(ignored.battle, 'low')).toBe(2);
    const chosen = answerChoice(played.match, 'low');
    expect(chosen.pendingChoice).toBeNull();
    expect(chosen.phase).toBe('playerAction');
    expect(chosen.battle.cells[2]).toBeNull();
    expect(currentPoints(chosen.battle, 'low')).toBe(5);
    expect(currentPoints(chosen.battle, 'high')).toBe(8);
  });
});
