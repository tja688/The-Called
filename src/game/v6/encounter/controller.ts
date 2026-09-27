/**
 * 科学起始牌组对失控机械。
 * 只调用 rules、turn、enemy、scripts、content 的公开入口，不替玩家搜索出牌。
 */

import { getCardByName, getMonster, scienceStarter } from '../content';
import {
  chooseCardTarget,
  choosePlacement,
  emptyCell,
  type IntentBoard,
  type IntentCell,
  type IntentPlay,
} from '../enemy';
import {
  CELL_IDS,
  activeCoverThreshold,
  cardAt,
  currentPoints,
  isCellId,
  totalPoints,
  type CardDefinition,
  type CardSetup,
  type CellId,
  type Opcode,
  type RuleType,
  type Side,
  type Winner,
} from '../rules';
import { TUTORIAL_CARD_NAMES, tutorialCard, type TutorialCardName } from '../scripts';
import {
  endTurn as finishTurn,
  play as playInMatch,
  startMatch,
  type MatchState,
  type RevealedIntent,
  type TurnRejection,
} from '../turn';

/**
 * 缺口：现有 turn 不会在回合结束暂停等待选择。
 * endTurn 连续跑完玩家回合结束、敌方行动和下一轮玩家行动；
 * 内核回合结束效果拿到的 choice 恒为空。
 * 本层不改 turn。攻击炮台和科学研究器先按空效果打出，
 * 不把「点数 -2」或「添加解析标记」写成已经生效。
 */
const TURN_END_SELECTION_GAP = new Set<string>(['攻击炮台', '科学研究器']);

export interface EncounterState {
  readonly match: MatchState;
}

export interface HandCard {
  instanceId: string;
  name: string;
  basePoints: number | null;
}

export interface GridCell extends IntentCell {
  instanceId: string | null;
}

export interface Score {
  player: number;
  enemy: number;
}

export interface CurrentIntent {
  name: string;
  definitionId: string;
  owner: Side;
  ruleType: RuleType;
  basePoints: number | null;
  effects?: Opcode[];
}

export type EncounterPlay =
  | { ok: true; state: EncounterState }
  | { ok: false; reason: TurnRejection; state: EncounterState };

export interface EncounterController {
  start(seed?: number): EncounterState;
  hand(state: EncounterState): HandCard[];
  grid(state: EncounterState): GridCell[];
  totals(state: EncounterState): Score;
  intent(state: EncounterState): CurrentIntent | null;
  play(state: EncounterState, instanceId: string, cell: CellId, targetInstanceId?: string): EncounterPlay;
  endTurn(state: EncounterState): EncounterState;
  decided(state: EncounterState): { over: boolean; winner: Winner | null };
}

function isTutorialName(name: string): name is TutorialCardName {
  return (TUTORIAL_CARD_NAMES as readonly string[]).includes(name);
}

/** blocked 的卡仍可打出占场。效果保持空脚本，不补一条假装已经生效的操作。 */
function fieldDefinition(name: string, intentCopy: boolean): CardDefinition {
  if (!isTutorialName(name)) throw new Error(`No tutorial script for ${name}`);
  const content = getCardByName(name);
  if (!content || content.ruleKind !== 'permanent' || content.basePower === null) {
    throw new Error(`Field card ${name} is missing from content`);
  }
  const entry = tutorialCard(name);
  const definition: CardDefinition =
    entry.status === 'script'
      ? structuredClone(entry.definition)
      : {
          id: content.id,
          name: content.name,
          ruleType: 'field',
          basePoints: content.basePower,
          effects: [],
        };
  if (intentCopy) definition.id = `${definition.id}#intent`;
  if (TURN_END_SELECTION_GAP.has(name)) {
    definition.effects = [];
    delete definition.onTurnEnd;
  }
  return definition;
}

function deckCard(name: string): CardSetup {
  return { definition: fieldDefinition(name, false), owner: 'player', zone: 'deck' };
}

/** 预置直接放上盘面。startMatch 不会对预置牌跑入场。 */
function presetCard(name: string, cell: CellId): CardSetup {
  return { definition: fieldDefinition(name, false), owner: 'enemy', zone: 'board', cell };
}

/**
 * 内核盘面收成落位函数要的纯数据。
 * 没有的标记当 false，没有的覆盖门槛当 null。
 */
function projectBoard(battle: MatchState['battle']): IntentBoard {
  return {
    cells: CELL_IDS.map((index) => {
      const card = cardAt(battle, index);
      if (!card) return emptyCell(index);
      return {
        index,
        cardName: battle.definitions[card.definitionId]?.name ?? null,
        owner: card.owner,
        currentPower: currentPoints(battle, card.instanceId),
        basePower: card.basePoints ?? 0,
        sealed: card.sealed === true,
        marked: card.analyzed === true,
        protected: card.protected === true,
        coverThreshold: activeCoverThreshold(battle, card.instanceId) ?? null,
      };
    }),
  };
}

function aimsAtChoice(opcode: Opcode): boolean {
  return 'target' in opcode && opcode.target.ref === 'choice';
}

function aimAt(opcode: Opcode, instanceId: string): Opcode {
  if (!aimsAtChoice(opcode)) return opcode;
  const next = structuredClone(opcode) as Opcode & { target: { ref: 'instance'; id: string } };
  next.target = { ref: 'instance', id: instanceId };
  return next;
}

/**
 * turn 的落位回调只交回格子，敌方打出时内核不接收选择。
 * 需要目标的效果先问 chooseCardTarget。
 * 返回空则去掉那段效果，只占场；返回格子则把 choice 改写成那一格上的实例。
 */
function armTarget(battle: MatchState['battle'], revealed: RevealedIntent, board: IntentBoard): void {
  const definition = battle.definitions[revealed.definitionId];
  if (!definition) throw new Error(`Missing intent definition ${revealed.definitionId}`);
  const canonical = structuredClone(revealed.effects ?? []);
  if (!canonical.some(aimsAtChoice)) {
    definition.effects = canonical;
    return;
  }
  const targetCell = chooseCardTarget(board, revealed.name);
  const targetId = targetCell === null ? null : (cardAt(battle, targetCell)?.instanceId ?? null);
  definition.effects =
    targetId === null ? canonical.filter((opcode) => !aimsAtChoice(opcode)) : canonical.map((opcode) => aimAt(opcode, targetId));
}

function placeMonster(battle: MatchState['battle'], revealed: RevealedIntent, monsterId: string): CellId | 'skip' {
  const board = projectBoard(battle);
  const play: IntentPlay = {
    cardName: revealed.name,
    monsterId,
    currentPower: revealed.basePoints ?? 0,
    occupies: revealed.ruleType === 'field',
  };
  const cell = choosePlacement(board, play);
  if (cell === null) return 'skip';
  armTarget(battle, revealed, board);
  return cell;
}

function start(seed?: number): EncounterState {
  const monster = getMonster('runaway-machine');
  if (!monster) throw new Error('Missing monster: runaway-machine');
  const match = startMatch(
    {
      seed,
      cards: [
        ...scienceStarter.map((name) => deckCard(name)),
        ...monster.presets.map((preset) => presetCard(preset.cardName, preset.cell)),
      ],
      intents: monster.intents.map((name) => ({
        definition: fieldDefinition(name, true),
        owner: 'enemy' as const,
      })),
      polluted: monster.pollutedCells.filter(isCellId),
    },
    { placeIntent: (battle, revealed) => placeMonster(battle, revealed, monster.id) },
  );
  return { match };
}

function hand(state: EncounterState): HandCard[] {
  const battle = state.match.battle;
  return battle.hand.map((instanceId) => {
    const card = battle.instances[instanceId];
    return {
      instanceId,
      name: battle.definitions[card.definitionId]?.name ?? card.definitionId,
      basePoints: card.basePoints,
    };
  });
}

function grid(state: EncounterState): GridCell[] {
  const battle = state.match.battle;
  return projectBoard(battle).cells.map((cell) => ({
    ...cell,
    instanceId: cardAt(battle, cell.index)?.instanceId ?? null,
  }));
}

function totals(state: EncounterState): Score {
  const battle = state.match.battle;
  return {
    player: totalPoints(battle, 'player'),
    enemy: totalPoints(battle, 'enemy'),
  };
}

function intent(state: EncounterState): CurrentIntent | null {
  const revealed = state.match.revealed;
  if (!revealed) return null;
  return {
    name: revealed.name,
    definitionId: revealed.definitionId,
    owner: revealed.owner,
    ruleType: revealed.ruleType,
    basePoints: revealed.basePoints,
    effects: revealed.effects,
  };
}

function play(state: EncounterState, instanceId: string, cell: CellId, targetInstanceId?: string): EncounterPlay {
  const outcome = playInMatch(state.match, {
    instanceId,
    cell,
    choice: targetInstanceId === undefined ? undefined : { targets: [targetInstanceId] },
  });
  const next = { match: outcome.match };
  return outcome.ok ? { ok: true, state: next } : { ok: false, reason: outcome.reason, state: next };
}

function endTurn(state: EncounterState): EncounterState {
  return { match: finishTurn(state.match) };
}

function decided(state: EncounterState): { over: boolean; winner: Winner | null } {
  return { over: state.match.over, winner: state.match.winner };
}

export const scienceVsRunaway: EncounterController = {
  start,
  hand,
  grid,
  totals,
  intent,
  play,
  endTurn,
  decided,
};
