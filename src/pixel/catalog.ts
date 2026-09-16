import type { SpriteDef } from './dsl'
import type { ShapeIcon } from './shapes'
import { AVATAR } from './sprites/chars/avatar'
import { ENEMY_ICONS } from './sprites/npcs/enemies'
import { CARD_ICONS } from './sprites/cards'
import { ICONS } from './sprites/icons'
import { FX } from './sprites/fx'
import { PROPS } from './sprites/props'
import { PANEL } from './sprites/ui/panel'

export const ASCII_SPRITES: SpriteDef[] = [AVATAR]

export const SHAPE_ICONS: ShapeIcon[] = [
  ...Object.values(ENEMY_ICONS),
  ...Object.values(CARD_ICONS),
  ...Object.values(ICONS),
  ...Object.values(FX),
  ...Object.values(PROPS),
  PANEL,
]

export function defToAssetId(defId: string): string {
  if (defId === 'AVATAR') return 'char.avatar'
  const lower = defId.toLowerCase()
  if (/^E\d/.test(defId)) return `npc.${lower}`
  return `card.${lower}`
}
