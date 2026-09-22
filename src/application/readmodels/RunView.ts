import { eventDef, eventOptionEnabled } from '../../content/events'
import { cardDef, isNegative } from '../../content/cards'
import { ANCHORS } from '../../content/anchors'
import type { RunState } from '../../domain/run/RunAggregate'
import type { Coord, DeckId, NodeType, Rarity, RunResult, SchoolId, Screen } from '../../domain/types'
import { NODE_TYPE_LABEL } from '../../domain/types'
import { adjacentNodes, nodeOpensContent } from '../../domain/run/mapgen'

export interface EventOptionView {
  index: 0 | 1 | 2
  label: string
  text: string
  enabled: boolean
  needsCard?: boolean
  needsCard2?: boolean
}

export interface MapNodeView {
  id: string
  type: NodeType | 'unknown'
  label: string
  x: number
  y: number
  visited: boolean
  completed: boolean
  lost: boolean
  /** 走进去会打开内容。已完成且不能再互动的节点为假，只作落脚。 */
  interactive: boolean
  current: boolean
  adjacent: boolean
}

export interface BoxCardView {
  uid: string
  defId: string
  baseBonus: number
  negative: boolean
  rarity: Rarity
  school: SchoolId
}

export interface ShopView {
  offers: { defId: string; price: number }[]
  relicId?: string
  relicPrice?: number
  copyPrice: number
}

export interface RunView {
  hp: number
  hpMax: number
  gold: number
  box: string[]
  boxCards: BoxCardView[]
  deck: string[]
  relics: string[]
  deckId: DeckId
  avatarDefId: string
  avatarBase: number
  floorEffect: string
  player: Coord
  availableNodes: string[]
  screen: Screen
  seed: number
  event?: { eventId: string; name: string; options: EventOptionView[]; chosen?: 0 | 1 | 2 }
  reward?: { pool: string[]; picked?: string; gold: number }
  shop?: ShopView
  ended?: RunResult
  nodes: MapNodeView[]
}

export function toRunView(state: RunState, availableNodes: string[]): RunView {
  const adj = new Set(adjacentNodes(state.nodes, state.player).map((n) => n.id))
  const nodes: MapNodeView[] = state.nodes.map((n) => {
    const show = n.revealed || n.visited || n.id === 'next'
    return {
      id: n.id,
      type: show ? n.type : 'unknown',
      label: show ? NODE_TYPE_LABEL[n.type] : '？',
      x: n.x,
      y: n.y,
      visited: n.visited,
      completed: n.completed,
      lost: n.lost,
      interactive: nodeOpensContent(n),
      current: n.x === state.player.x && n.y === state.player.y,
      adjacent: adj.has(n.id) || availableNodes.includes(n.id),
    }
  })
  const ev = state.eventId ? eventDef(state.eventId) : undefined
  const shopNode = state.pendingNode ? state.nodes.find((n) => n.id === state.pendingNode) : undefined
  const disc = (price: number) => Math.max(1, Math.round(price * (1 - state.shopDiscount)))
  return {
    hp: state.hp,
    hpMax: state.hpMax,
    gold: state.gold,
    box: state.box.map((c) => c.defId),
    boxCards: state.box.map((c) => ({
      uid: c.uid,
      defId: c.defId,
      baseBonus: c.baseBonus,
      negative: isNegative(c.defId),
      rarity: cardDef(c.defId).rarity,
      school: cardDef(c.defId).school,
    })),
    deck: [...state.deck],
    relics: [...state.relics],
    deckId: state.deckId,
    avatarDefId: state.avatarDefId,
    avatarBase: state.avatarBase,
    floorEffect: state.floorEffect,
    player: { ...state.player },
    availableNodes,
    screen: state.screen,
    seed: state.seed,
    event: ev
      ? {
          eventId: ev.id,
          name: ev.name,
          options: ev.options.map((o) => ({
            index: o.index,
            label: o.label,
            text: o.text,
            needsCard: o.needsCard,
            needsCard2: o.needsCard2,
            enabled: eventOptionEnabled(ev, o.index, state),
          })),
          chosen: state.eventChosen,
        }
      : undefined,
    reward: state.pendingReward
      ? { pool: [...state.pendingReward], picked: state.rewardPicked, gold: state.rewardGold ?? 0 }
      : undefined,
    shop: shopNode?.shop
      ? {
          offers: shopNode.shop.offers.map((o) => ({ defId: o.defId, price: disc(o.price) })),
          relicId: shopNode.shop.relicSold ? undefined : shopNode.shop.relicId,
          relicPrice: shopNode.shop.relicSold ? undefined : shopNode.shop.relicPrice === undefined ? undefined : disc(shopNode.shop.relicPrice),
          copyPrice: disc(ANCHORS.shopCopyFirst + state.copyBuys * ANCHORS.shopCopyStep),
        }
      : undefined,
    ended: state.ended,
    nodes,
  }
}
