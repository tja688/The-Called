import type { SpriteDef } from './dsl'
import type { ShapeIcon } from './shapes'
import { CARDS } from '../content/cards'
import { AVATARS } from './sprites/chars/avatar'
import { ENEMY_ICONS } from './sprites/npcs/enemies'
import { CARD_ICONS } from './sprites/cards'
import { ICONS } from './sprites/icons'
import { FX } from './sprites/fx'
import { PROPS } from './sprites/props'
import { PANEL } from './sprites/ui/panel'

export const ASCII_SPRITES: SpriteDef[] = [...AVATARS]

export function defToAssetId(defId: string): string {
  if (defId.startsWith('PC.') && defId.endsWith('00')) return `char.${defId.toLowerCase().replace('.', '')}`
  const lower = defId.toLowerCase().replace('.', '')
  if (defId.startsWith('EC.')) return `npc.${lower}`
  if (defId.startsWith('RL.')) return `card.${lower}`
  return `card.${lower}`
}

function stubFill(defId: string): string {
  if (defId.startsWith('EC.')) return 'ene'
  if (defId.startsWith('PC.A')) return 'gold'
  if (defId.startsWith('PC.B')) return 'purpleD'
  if (defId.startsWith('PC.C')) return 'copper'
  if (defId.startsWith('PC.X')) return 'leaf'
  return 'stone'
}

function stubIcon(defId: string): ShapeIcon {
  return {
    id: defToAssetId(defId),
    size: [24, 24],
    shadow: true,
    ops: [
      { c: 'rrect', x: 5, y: 5, w: 14, h: 14, r: 2, f: stubFill(defId) },
      { c: 'hl', x: 7, y: 7, w: 3 },
    ],
  }
}

const painted = new Set([
  ...AVATARS.map((s) => s.id),
  ...Object.values(ENEMY_ICONS).map((s) => s.id),
  ...Object.values(CARD_ICONS).map((s) => s.id),
])
const STUBS = Object.keys(CARDS)
  .filter((id) => !painted.has(defToAssetId(id)))
  .map(stubIcon)

export const SHAPE_ICONS: ShapeIcon[] = [
  ...Object.values(ENEMY_ICONS),
  ...Object.values(CARD_ICONS),
  ...STUBS,
  ...Object.values(ICONS),
  ...Object.values(FX),
  ...Object.values(PROPS),
  PANEL,
]
