import { DRAWER_EVENT } from '../../content/events'
import type { RunState } from '../../domain/run/RunAggregate'
import type { NodeId, RunResult, Screen } from '../../domain/types'
import { NODE_LABEL, NODES } from '../../domain/types'

export interface EventOptionView {
  index: 0 | 1 | 2
  label: string
  text: string
}

export interface RunView {
  hp: number
  hpMax: number
  box: string[]
  deck: string[]
  currentNode?: NodeId
  availableNodes: NodeId[]
  screen: Screen
  seed: number
  extraDraw: number
  event?: { eventId: string; name: string; options: EventOptionView[]; chosen?: 0 | 1 | 2 }
  reward?: { pool: string[]; picked?: string }
  ended?: RunResult
  nodes: { id: NodeId; label: string; done: boolean }[]
}

export function toRunView(state: RunState, availableNodes: NodeId[]): RunView {
  return {
    hp: state.hp,
    hpMax: state.hpMax,
    box: [...state.box],
    deck: [...state.deck],
    currentNode: NODES[state.progress],
    availableNodes,
    screen: state.screen,
    seed: state.seed,
    extraDraw: state.extraDraw,
    event: state.screen === 'event' || state.eventChosen !== undefined
      ? {
          eventId: DRAWER_EVENT.id,
          name: DRAWER_EVENT.name,
          options: DRAWER_EVENT.options,
          chosen: state.eventChosen,
        }
      : undefined,
    reward: state.pendingReward
      ? { pool: [...state.pendingReward], picked: state.rewardPicked }
      : undefined,
    ended: state.ended,
    nodes: NODES.map((id, i) => ({ id, label: NODE_LABEL[id], done: i < state.progress })),
  }
}
