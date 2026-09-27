/** Battle-kernel types. Names are English. No React. */

export type Side = 'player' | 'enemy';

/** Row-major cells 1..9. */
export type CellId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type Zone = 'deck' | 'hand' | 'discard' | 'exile' | 'board';

export type RuleType = 'field' | 'spell';

export type ForceReason = 'board' | 'resource' | 'special';

/** Winner of a board appraisal or a terminal settlement. */
export type Winner = Side;

export type RemovalReason = 'cover' | 'zero' | 'effect';

export type ListenerEvent = 'played' | 'entered' | 'left' | 'gainedMark' | 'sealed';

/** One negative a clear can remove. A parse mark is never one of these. */
export type NegativeKind = 'seal' | 'debuff';

export interface Choice {
  /** Already-selected instance ids, in order. */
  targets?: string[];
  /** Already-selected cells, in order. */
  cells?: CellId[];
  /**
   * Which negative to clear when a card has both a seal and a permanent debuff.
   * Omitted clears the seal. Ignored when the card has only one of the two.
   */
  negative?: NegativeKind;
  /** Per instance. Overrides `negative` for that card. */
  negatives?: Readonly<Record<string, NegativeKind>>;
}

/**
 * Board cards visible to an effect.
 * `adjacentToSelf` is orthogonal to the source cell. Omitted filters stay open,
 * so an owner-only query still matches every board card of that side.
 */
export interface FieldQuery {
  owner: 'same' | 'opponent' | 'any';
  adjacentToSelf?: boolean;
  /** Orthogonal to `choice.targets[0]`, not to the effect source. */
  adjacentToChoice?: boolean;
  hasMark?: boolean;
  /** The card must not already carry a parse mark. */
  unmarked?: boolean;
  /** The card stands on the source's mirror cell. Cell 5 never matches. */
  mirrorOfSource?: boolean;
  /** This card's mirror cell exists and is empty. Cell 5 never matches. */
  emptyMirror?: boolean;
  /**
   * Keep one match: the highest current points, aura included.
   * A tie keeps the smallest cell.
   */
  highest?: boolean;
}

export type TargetSpec =
  | { ref: 'self' }
  | { ref: 'choice'; index?: number }
  | { ref: 'eventSubject' }
  | { ref: 'instance'; id: string }
  /** Card currently bound by `forEach`. */
  | { ref: 'each' }
  | ({ ref: 'query' } & FieldQuery);

export type RemoveCondition =
  | { kind: 'pointsAtMost'; max: number }
  | { kind: 'hasMark' }
  | { kind: 'sealed' };

/** Dynamic aura target. Recomputed while the source is active. */
export type AuraQuery = {
  owner: 'same' | 'opponent' | 'any';
  hasMark?: boolean;
  hasProtect?: boolean;
  /** The card standing on the source's mirror cell. */
  mirrorOfSource?: boolean;
  /**
   * The source itself, and only while its mirror cell holds another same-owner card.
   * Cell 5 never matches.
   */
  selfWhileAllyMirror?: boolean;
  /** The source card alone. Other cards, including same-owner allies, do not match. */
  self?: boolean;
  /**
   * Every same-owner card whose mirror cell holds another same-owner card.
   * Cell 5 never matches.
   */
  mirroredAlly?: boolean;
};

export type Opcode =
  | {
      op: 'modPermanent';
      /**
       * `perOwnDiscard` is that many points per card the controller owns in the
       * discard, counted before this spell itself arrives there.
       * `cap` limits how many of those cards count, so -1 with cap 5 is at most -5.
       */
      amount: number | 'lastFaithSpent' | { perOwnDiscard: number; cap?: number };
      target: TargetSpec;
      /**
       * Runs after this segment's zero check, and only for targets that were
       * on the board and then left. Not part of the same step as the point change.
       */
      onLeft?: Opcode[];
      /**
       * Runs after that same zero check, and only for targets that were on the
       * board and are still there. A card that left still carries its mark
       * through the leave.
       */
      onStayed?: Opcode[];
    }
  | { op: 'grantAura'; amount: number; target: TargetSpec | ({ ref: 'query' } & AuraQuery) }
  | { op: 'doubleBasePermanent'; target: TargetSpec }
  | { op: 'resetToBase'; target: TargetSpec }
  | { op: 'addMark'; target: TargetSpec; /** Uniform pick among resolved targets. No roll when the list is empty. */ pick?: 'random' }
  | { op: 'removeMark'; target: TargetSpec }
  | { op: 'seal'; target: TargetSpec }
  /**
   * Remove one negative from each board target.
   * A seal counts. One permanent layer counts only while base + permanent is below
   * the printed base, and then only by +1, not a full reset.
   * A parse mark is a buff and stays.
   * When both a seal and a debuff are present, `choice.negatives` or `choice.negative`
   * picks one. Anything other than `debuff` clears the seal.
   */
  | { op: 'clearNegative'; target: TargetSpec }
  | { op: 'giveProtect'; target: TargetSpec }
  | { op: 'giveRevive'; target: TargetSpec }
  | { op: 'setExhaust'; target: TargetSpec }
  | { op: 'remove'; target: TargetSpec; when?: RemoveCondition[] }
  | { op: 'grantCoverThreshold'; min: number; target: TargetSpec }
  | { op: 'sacrifice'; count: number }
  | { op: 'gainFaith'; amount: number }
  | { op: 'spendFaith'; amount: number | 'all' }
  | { op: 'doubleFaith' }
  | { op: 'pollute'; cell: CellId | 'choice' }
  | { op: 'armTimer'; turns: number; target: TargetSpec; onZero?: Opcode[] }
  | { op: 'grantSwift'; target: TargetSpec }
  | { op: 'forceSettlement' }
  | { op: 'transferOwner'; target: TargetSpec; to: Side | 'opponent' }
  | { op: 'draw'; count: number }
  | {
      op: 'spawn';
      definitionId: string;
      /**
       * `randomAdjacentEmpty` rolls one open orthogonal neighbor of the source.
       * `randomEmpty` rolls one open cell in ascending cell order.
       * `mirrorOfSubject` is the event subject's mirror. Cell 5 has none.
       * Neither random kind rolls when no cell is open.
       */
      cell: CellId | 'choice' | 'randomAdjacentEmpty' | 'randomEmpty' | 'mirrorOfSubject';
      owner?: Side | 'self' | 'opponent';
      /**
       * Overrides the token's printed base on the new instance.
       * `halfSubjectBase` is floor(the event subject's printed base / 2).
       */
      basePoints?: number | 'halfSubjectBase';
    }
  | { op: 'moveToMirror'; target: TargetSpec }
  | { op: 'lookTop' }
  /**
   * Take one field card from the deck into the hand.
   * `minBase` compares the printed base, not current points.
   * Omit it and the opcode stays unimplemented.
   * No match, an empty deck, or a full hand does nothing and does not throw.
   * Several matches use `choice.targets[0]` when it is one of them; a single match is taken on its own.
   */
  | { op: 'search'; minBase?: number }
  | { op: 'discardToHand' }
  | { op: 'discardToField' }
  | { op: 'shuffleIntoDeck' }
  | { op: 'shuffleCopy' }
  /**
   * Marker: this card may be played onto an allied field card.
   * The play pipeline records that card's current points, removes it (protection
   * applies and leave triggers), enters the cell, adds those points permanently,
   * then applies pollution and the zero check. It does not use cover deduction.
   * Invoking the opcode outside that play does not move cards or change points.
   */
  | { op: 'absorbAlly' }
  /**
   * Grants the player one more play in this action, after the card that ran it
   * spends its own. An enemy controller does nothing. The player may end
   * without using the extra play.
   */
  | { op: 'followUpPlay' }
  | { op: 'onDrawResolve' }
  /** Run `effects` once per board card that matches `query`, in cell order. */
  | { op: 'forEach'; query: FieldQuery; effects: Opcode[] }
  /** Run `effects` once when the query hits at least one board card. */
  | { op: 'when'; query: FieldQuery; effects: Opcode[] }
  /**
   * Read the controller's faith. At least `atLeast` runs `then` and skips `else`.
   * Otherwise runs `else` and skips `then`. The check does not spend faith.
   */
  | { op: 'ifFaith'; atLeast: number; then: Opcode[]; else: Opcode[] }
  /**
   * Branch on the first resolved target's owner.
   * `same` runs when that owner is the controller. `opponent` runs otherwise.
   * No target runs neither list.
   */
  | { op: 'ifOwner'; target: TargetSpec; same: Opcode[]; opponent: Opcode[] };

/** Narrows a listener to the event's subject. Omitted means every subject of that event. */
export interface ReactionSubject {
  /** The cell the subject was played onto (or entered), orthogonal to the listener. */
  adjacentToSelf?: boolean;
  /** Absolute owner. 失控机械 listens for player cards, not "any play". */
  owner?: Side;
  /** Owner relative to the listener. */
  ownerRelation?: 'same' | 'opponent';
  /**
   * The event cell is the mirror of a board card with this relation to the listener.
   * Cell 5 never matches, because it has no mirror.
   */
  onMirrorOf?: 'same' | 'opponent';
  /**
   * The event cell is this listener's own mirror.
   * Cell 5 never matches. This is stricter than `onMirrorOf`: another ally on some
   * other mirror does not qualify.
   */
  mirrorOfSelf?: boolean;
  /**
   * The subject is a field card. A spell does not match, including one that
   * only left a hand or the discard step.
   */
  field?: boolean;
  /**
   * The subject carried a parse mark when the event was queued.
   * Leave listeners must read that snapshot: the mark is cleared on the way to the discard.
   */
  hasMark?: boolean;
}

export interface Reaction {
  event: ListenerEvent;
  effects: Opcode[];
  subject?: ReactionSubject;
  /**
   * Hear this only while the listener occupies a cell.
   * Omitted keeps board and hand both able to hear it.
   */
  onBoard?: boolean;
}

export interface CardDefinition {
  id: string;
  name: string;
  ruleType: RuleType;
  /** Null for spells. Spells are not 0. */
  basePoints: number | null;
  /** Field: enter effect. Spell: the spell body. */
  effects?: Opcode[];
  /**
   * Standing auras. They apply while this copy occupies a cell and is not sealed.
   * Not an enter effect, so a preset receives them without entering.
   * The source leaving or being sealed drops them at once.
   */
  presence?: ReadonlyArray<{
    amount: number;
    /**
     * Multiply `amount` by how many cards the source's owner has in the discard.
     * Read live, so it follows the pile. A failed sacrifice does not remove it.
     */
    perOwnDiscard?: boolean;
    target: AuraQuery;
  }>;
  onLeave?: Opcode[];
  /**
   * Legal board cards for an onLeave effect that reads `choice`.
   * The leaver is already off its cell, so it is not among them.
   * None: the effect runs with an empty choice and changes no points.
   * Enemy owner: highest current points, smallest cell on a tie, applied at once.
   * Player owner: a supplied `leaveChoices` entry, or else the effect waits on `leavePrompts`.
   */
  leaveTarget?: FieldQuery;
  onTurnStart?: Opcode[];
  onTurnEnd?: Opcode[];
  /**
   * Printed clauses that say “敌方回合结束”.
   * Only `runEnemyTurnEndEffects` runs them, and the turn driver calls that
   * from the enemy turn-end pipeline. Owner turn-end ignores this field.
   */
  onEnemyTurnEnd?: Opcode[];
  /**
   * When set, `resolveTurnEndEffects` may feed `choice.targets` into `onTurnEnd`.
   * `runTurnEndEffects` and an empty selection never read this field.
   */
  turnEndTarget?: FieldQuery;
  /**
   * When set, `advanceTurnStart` may feed one chosen board card into `onTurnStart`.
   * `runTurnStartEffects` never reads this field. An empty legal list runs
   * the effect with no target. Sealed sources are skipped.
   */
  turnStartTarget?: FieldQuery;
  /**
   * Drawn instead of entering the hand. The draw is consumed: no replacement
   * card, and this does not spend a play. After these opcodes, the card is
   * discarded if it is still outside every zone list.
   */
  onDraw?: Opcode[];
  /**
   * Legal set for an enter effect that reads `choice`. The enemy caller fills
   * `playTargetCount` of them, or one when that count is omitted. The player
   * still passes their own choice. An empty selection hits nobody.
   */
  playTarget?: FieldQuery;
  /**
   * How many distinct legal `playTarget` cards the enemy marks or affects.
   * Highest current points first, smallest cell on a tie, then the next.
   * A shorter legal list fills only as many as exist. The card about to be
   * covered on the landing cell is not legal. Omitted means one.
   */
  playTargetCount?: number;
  onTimer?: Opcode[];
  reactions?: Reaction[];
  exhaust?: boolean;
  swift?: boolean;
  /** Printed timer X. Counter starts at X. */
  timer?: number;
  /** Removal step 3: shuffle this card into the deck instead of discarding. */
  shuffleOnLeave?: boolean;
  /**
   * 亡魂：被献祭、即将从牌组进弃牌堆时改为入手。
   * TODO 【建议默认】手牌已满则仍进弃牌堆。
   */
  toHandWhenSacrificed?: boolean;
  /**
   * When set, a spell is not a legal play unless a board field card of that
   * relation exists. Omitted spells are always legal to play.
   */
  spellNeeds?: 'enemy' | 'ally' | 'any';
  /**
   * When set on a spell, the play is illegal unless `choice.targets[0]` is in
   * this set. An empty set, a missing pick, or a pick outside it rejects the
   * play and the spell body does not run.
   */
  spellTarget?: FieldQuery;
  /**
   * With `spellTarget`, faith at least this high may play the spell with no pick.
   * Faith below this still requires a legal choice. The body still runs either way.
   */
  spellTargetBelowFaith?: number;
  /**
   * Definitions a spawn opcode on this card needs. Loaded with the card, not placed.
   */
  tokens?: CardDefinition[];
  /**
   * Listeners for the whole fight. They follow the definition, not whether this
   * copy is still on the board. Two copies of one definition register them once.
   */
  fightReactions?: Reaction[];
}

export interface CardInstance {
  instanceId: string;
  definitionId: string;
  owner: Side;
  zone: Zone;
  cell: CellId | null;
  basePoints: number | null;
  permanentMod: number;
  analyzed: boolean;
  sealed: boolean;
  protected: boolean;
  revive: boolean;
  exhaust: boolean;
  swift: boolean;
  timer: number | null;
  timerMax: number | null;
  /** Overrides the printed onTimer list when set by armTimer. */
  timerEffects: Opcode[] | null;
  shuffleOnLeave: boolean;
  toHandWhenSacrificed: boolean;
}

export interface Aura {
  id: string;
  sourceId: string;
  amount: number;
  target:
    | { kind: 'fixed'; instanceIds: string[] }
    | ({ kind: 'query' } & AuraQuery);
}

export interface CoverThreshold {
  id: string;
  sourceId: string;
  min: number;
  targetId: string;
}

/**
 * One picture the board should play, in the order the kernel already settled it.
 * Same-step board effects are emitted in cell order, then hand order.
 */
export type CueKind =
  | 'arrive'
  | 'cast'
  | 'spawn'
  | 'mark'
  | 'unmark'
  | 'points'
  | 'double'
  | 'reset'
  | 'aura'
  | 'protect'
  | 'guard'
  | 'revive'
  | 'exhaust'
  | 'seal'
  | 'unseal'
  | 'clear'
  | 'remove'
  | 'cover'
  | 'threshold'
  | 'faith'
  | 'pollute'
  | 'timer'
  | 'swift'
  | 'settle'
  | 'transfer'
  | 'draw'
  | 'search'
  | 'sacrifice'
  | 'mirror'
  | 'follow'
  | 'absorb';

export interface EffectCue {
  seq: number;
  kind: CueKind;
  sourceId: string;
  sourceCell: CellId | null;
  targetId: string | null;
  cell: CellId | null;
  owner: Side | null;
  amount: number;
  toCell: CellId | null;
}

export interface PendingEvent {
  type: ListenerEvent;
  instanceId: string;
  cell: CellId | null;
  /**
   * Parse mark on the subject at queue time.
   * Leave wipes the mark before listeners run, so they must read this instead.
   */
  marked: boolean;
}

export interface BattleState {
  /** Seed the battle was created with. */
  seed: number;
  /** Advancing RNG state. Do not read Math.random. */
  rng: number;
  definitions: Record<string, CardDefinition>;
  instances: Record<string, CardInstance>;
  /** Index 0 is the top of the player's deck. */
  deck: string[];
  /** Left to right. Cap is HAND_LIMIT. */
  hand: string[];
  discard: string[];
  exile: string[];
  cells: Record<CellId, string | null>;
  polluted: CellId[];
  faith: Record<Side, number>;
  forceSettlement: boolean;
  forceReasons: ForceReason[];
  /** Rules log, including the zero-check depth error. */
  log: string[];
  /**
   * Append-only picture trace for the view.
   * The kernel never reads it. Each chain keeps the earlier cues and adds its own.
   */
  cues: EffectCue[];
  auras: Aura[];
  thresholds: CoverThreshold[];
  pendingEvents: PendingEvent[];
  /** Player leave effects waiting for one ally, in the order the cards left. */
  leavePrompts: LeavePrompt[];
  /**
   * Picks for this resolution only, keyed by the leaving instance.
   * Cleared when the chain closes. An enemy leaver ignores them.
   */
  leaveChoices?: Readonly<Record<string, string>>;
  /** Fight-long listeners copied from definitions the first time each one is loaded. */
  fightReactions: Reaction[];
  /** Causal-chain depth. 0 when idle. */
  chainDepth: number;
  resolutionHalted: boolean;
  nextSerial: number;
}

export interface CardSetup {
  definition: CardDefinition;
  owner: Side;
  zone: Zone;
  cell?: CellId;
  instanceId?: string;
  permanentMod?: number;
  analyzed?: boolean;
  sealed?: boolean;
  protected?: boolean;
  revive?: boolean;
  exhaust?: boolean;
  swift?: boolean;
  /** Current timer. Defaults to the printed timer. */
  timer?: number;
}

export interface CreateBattleInput {
  seed?: number;
  cards?: CardSetup[];
  /** Definitions with no instance yet (tokens a spawn opcode will copy). */
  catalog?: CardDefinition[];
  faith?: Partial<Record<Side, number>>;
  polluted?: CellId[];
  forceSettlement?: boolean;
  forceReasons?: ForceReason[];
}

export interface PlayRequest {
  instanceId: string;
  cell?: CellId;
  choice?: Choice;
  /** Player leave picks keyed by the leaving instance. */
  leaveChoices?: Readonly<Record<string, string>>;
}

export type PlayRejection =
  | 'not-in-hand'
  | 'missing-cell'
  | 'illegal-cell'
  | 'occupied-by-higher'
  | 'occupied-by-ally'
  | 'below-threshold'
  | 'no-target';

export type PlayResult =
  | { ok: true; state: BattleState; consumedPlay: boolean; /** Player follow-up plays this resolution granted. */ followUps: number }
  | { ok: false; reason: PlayRejection; state: BattleState };

export interface EffectRequest {
  selfId: string;
  controller?: Side;
  choice?: Choice;
  /** Player leave picks keyed by the leaving instance. */
  leaveChoices?: Readonly<Record<string, string>>;
}

/** One player leave effect waiting for another allied board card. */
export interface LeavePrompt {
  sourceId: string;
  /** Legal instance ids in ascending cell order. */
  targets: string[];
}

/** One on-board card whose turn-end effect is waiting for a player pick. */
export interface TurnEndPrompt {
  sourceId: string;
  /** Legal instance ids in ascending cell order. Empty means the effect does nothing. */
  targets: string[];
}

/** Partial turn-end. `pending` is the next card that still needs a player pick. */
export interface TurnEndStep {
  state: BattleState;
  pending: TurnEndPrompt | null;
  /** Source ids whose turn-end effect already ran. Do not run them again. */
  done: string[];
}
