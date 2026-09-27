/**
 * Science starter against 解剖学家.
 * Cell 5 is 解剖台. 收容钳 and 标本柜 use generic choosePlacement.
 * 攻击炮台 and 激光扫描仪 use the anatomist branch: fewest orthogonal
 * player neighbors, smallest cell on a tie, then the generic cover step.
 * 活体解析 marks one random unmarked player card at the enemy turn end.
 */

import { getMonster, scienceStarter } from '../content';
import { chooseCardTarget, choosePlacement } from '../enemy';
import { boardInstanceIds, executeOpcodes, type BattleState, type CardDefinition, type CellId, type Opcode } from '../rules';
import { TUTORIAL_CARD_NAMES, scriptedCard, type TutorialCardName } from '../scripts';
import { ANATOMIST_CARD_NAMES, anatomistCard, type AnatomistCardName } from '../scripts/anatomist';
import { startMatch, type RevealedIntent } from '../turn';
import { toIntentBoard } from '../turn/intentBoard';
import type { Encounter } from './runaway';

const MONSTER_ID = 'anatomist';

export function startAnatomistEncounter(seed = 1): Encounter {
  const monster = getMonster(MONSTER_ID);
  if (!monster) throw new Error(`Missing monster ${MONSTER_ID}`);
  const match = startMatch(
    {
      seed,
      cards: [
        ...scienceStarter.map((name) => ({
          definition: scriptOf(name),
          owner: 'player' as const,
          zone: 'deck' as const,
        })),
        ...monster.presets.map((preset) => ({
          definition: scriptOf(preset.cardName),
          owner: 'enemy' as const,
          zone: 'board' as const,
          cell: preset.cell,
        })),
      ],
      intents: monster.intents.map((name) => ({ definition: scriptOf(name), owner: 'enemy' as const })),
    },
    { placeIntent: placeAnatomistIntent, onEnemyTurnEnd: livingAnalysis },
  );
  return { match };
}

/** Generic placement, except the two cards choosePlacement already special-cases for this monster. */
export function placeAnatomistIntent(battle: BattleState, intent: RevealedIntent): CellId | 'skip' {
  const cell = choosePlacement(toIntentBoard(battle), {
    cardName: intent.name,
    monsterId: MONSTER_ID,
    currentPower: intent.basePoints ?? 0,
    occupies: intent.ruleType === 'field',
  });
  if (cell === null) return 'skip';
  if (intent.name === '收容钳') armClamp(battle);
  return cell;
}

/** Highest marked player card at 3 or less. None means the remove stays off and the card only occupies. */
function armClamp(battle: BattleState): void {
  const script = anatomistCard('收容钳');
  const definition = battle.definitions[script.id];
  if (!definition || script.status !== 'script') return;
  const canonical = structuredClone(script.definition.effects ?? []);
  const targetCell = chooseCardTarget(toIntentBoard(battle), '收容钳');
  const targetId = targetCell === null ? null : battle.cells[targetCell];
  definition.effects =
    targetId === null ? canonical.filter((opcode) => !aimsAtChoice(opcode)) : canonical.map((opcode) => aimAt(opcode, targetId));
}

/** One random unmarked player card on the board. Nothing when every player card is marked or the board has none. */
function livingAnalysis(battle: BattleState): BattleState {
  const selfId = boardInstanceIds(battle)[0] ?? battle.hand[0] ?? battle.deck[0];
  if (!selfId || !battle.instances[selfId]) return battle;
  return executeOpcodes(
    battle,
    [{ op: 'addMark', pick: 'random', target: { ref: 'query', owner: 'opponent', unmarked: true } }],
    { selfId, controller: 'enemy' },
  );
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

function isAnatomistName(name: string): name is AnatomistCardName {
  return (ANATOMIST_CARD_NAMES as readonly string[]).includes(name);
}

function isTutorialName(name: string): name is TutorialCardName {
  return (TUTORIAL_CARD_NAMES as readonly string[]).includes(name);
}

function scriptOf(name: string): CardDefinition {
  if (isAnatomistName(name)) return anatomistCard(name).definition;
  if (isTutorialName(name)) return scriptedCard(name).definition;
  throw new Error(`Anatomist encounter cannot script ${name}`);
}
