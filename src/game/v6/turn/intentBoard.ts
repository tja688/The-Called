import { emptyCell, type IntentBoard } from '../enemy';
import { CELL_IDS, activeCoverThreshold, currentPoints, type BattleState } from '../rules';

/** The enemy package reads a plain board. Placement and target choice both start here. */
export function toIntentBoard(state: BattleState): IntentBoard {
  return {
    cells: CELL_IDS.map((cell) => {
      const id = state.cells[cell];
      if (!id) return emptyCell(cell);
      const card = state.instances[id];
      const definition = state.definitions[card.definitionId];
      return {
        index: cell,
        cardName: definition?.name ?? card.definitionId,
        owner: card.owner,
        currentPower: currentPoints(state, id),
        basePower: card.basePoints ?? 0,
        sealed: card.sealed,
        marked: card.analyzed,
        protected: card.protected,
        coverThreshold: activeCoverThreshold(state, id),
      };
    }),
  };
}
