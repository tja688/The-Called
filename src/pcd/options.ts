import type { CellId } from '../game/types'
import { ruleCell } from './cells'
import { readInstance } from './ids'
import type { PcdOption } from './types'

export function optionForPlay(options: readonly PcdOption[], instanceId: string, cell: CellId) {
  const instance = readInstance(instanceId)
  if (instance == null) return null
  const cellNo = ruleCell(cell)
  return options.find((option) => option.kind === 'play' && option.instance === instance && option.cell === cellNo)?.id ?? null
}

export function optionForCast(options: readonly PcdOption[], instanceId: string) {
  const instance = readInstance(instanceId)
  if (instance == null) return null
  return options.find((option) => option.kind === 'cast' && option.instance === instance)?.id ?? null
}

export function optionForEndTurn(options: readonly PcdOption[]) {
  return options.find((option) => option.kind === 'end-turn')?.id ?? null
}

/** A click on a cell while no hand card is selected: a cell choice, or a card that is already on that cell. */
export function optionForAnswer(options: readonly PcdOption[], cell: CellId, boardInstanceId: string | null) {
  const cellNo = ruleCell(cell)
  const byCell = options.find((option) => option.kind === 'cell' && option.cell === cellNo)
  if (byCell) return byCell.id
  const instance = boardInstanceId ? readInstance(boardInstanceId) : null
  if (instance == null) return null
  return options.find((option) => option.kind === 'card' && option.instance === instance)?.id ?? null
}

export function looseCardOptions(options: readonly PcdOption[], boardInstances: ReadonlySet<number>) {
  return options.filter((option) => option.kind === 'card' && !boardInstances.has(option.instance))
}
