import type {
  BattleState,
  CardDefinition,
  CardSetup,
  CellId,
  Opcode,
  PlayRejection,
  RuleType,
  Side,
  TurnEndPrompt,
  Winner,
} from '../rules';

/** Eight phases. System phases run without waiting; play rests on `playerAction`. */
export type TurnPhase =
  | 'playerTurnStart'
  | 'revealIntent'
  | 'draw'
  | 'playerAction'
  | 'playerTurnEnd'
  | 'enemyTurnStart'
  | 'enemyAction'
  | 'enemyTurnEnd';

/** The card shown in phase 2. A name and its effect text. Never a cell. */
export interface RevealedIntent {
  definitionId: string;
  name: string;
  owner: Side;
  ruleType: RuleType;
  basePoints: number | null;
  swift: boolean;
  effects?: Opcode[];
  /** Present when the printed effect waits until this card's own turn end. */
  onTurnEnd?: Opcode[];
}

export interface IntentSpec {
  definition: CardDefinition;
  /** Controller when this intent is played. Defaults to the enemy. */
  owner?: Side;
}

/**
 * A cell enters the intent. `skip` leaves it off the board and does not rewind the index.
 * `targets` are instance ids already chosen for this play. Omitted means the card picks nothing.
 */
export type IntentPlacement = CellId | 'skip' | { cell: CellId; targets?: string[] };

export type PlaceIntent = (battle: BattleState, intent: RevealedIntent) => IntentPlacement;

export interface MatchHooks {
  placeIntent: PlaceIntent;
  /**
   * Turn-start step 5: monster skills. Omitted until the enemy package supplies them.
   * Runs after card turn-start effects and before the zero check.
   */
  onSideTurnStart?: (battle: BattleState, side: Side) => BattleState;
  /**
   * Turn-end step 2, after printed `onEnemyTurnEnd` clauses.
   * Monster skills such as 活体解析 still arrive through this hook.
   */
  onEnemyTurnEnd?: (battle: BattleState) => BattleState;
}

/** Where a leave prompt interrupted the eight phases, so the answer can resume there. */
export type LeaveGate =
  | 'action'
  | 'after-player-start'
  | 'after-player-end'
  | 'after-enemy-start'
  | 'after-enemy-intent'
  | 'after-enemy-end';

export interface StartMatchInput {
  seed?: number;
  /** Deck cards are shuffled. Board cards are presets and do not enter. */
  cards: CardSetup[];
  catalog?: CardDefinition[];
  polluted?: CellId[];
  intents: IntentSpec[];
}

export interface MatchState {
  battle: BattleState;
  phase: TurnPhase;
  side: Side;
  /**
   * 1-based index of the next intent. Revealing advances it and wraps to 1.
   * Skipping the play does not move it backward.
   */
  intentIndex: number;
  revealed: RevealedIntent | null;
  /** Non-swift plays left in this player action. Cleared when the action ends. */
  playsRemaining: number;
  over: boolean;
  winner: Winner | null;
  intents: IntentSpec[];
  hooks: MatchHooks;
  /** Set while a turn-start, turn-end, or leave effect is waiting for one legal target. */
  pendingChoice: TurnEndPrompt | null;
  /** Resume point for a leave prompt. Null while a leave is not holding the match. */
  leaveGate: LeaveGate | null;
  /** Picks already accepted in this turn-end, keyed by the effect's source id. */
  turnEndChoices: Readonly<Record<string, string>>;
  /** Turn-end sources already settled in this pipeline. */
  turnEndDone: readonly string[];
  /** Picks already accepted in this turn-start, keyed by the effect's source id. */
  turnStartChoices: Readonly<Record<string, string>>;
  /** Turn-start sources already settled in this pipeline. */
  turnStartDone: readonly string[];
}

export type TurnRejection = PlayRejection | 'no-plays' | 'match-over' | 'wrong-phase';

export type PlayOutcome =
  | { ok: true; match: MatchState }
  | { ok: false; reason: TurnRejection; match: MatchState };
