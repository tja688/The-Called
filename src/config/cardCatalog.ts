import type { CardArtConfig, CardDefinition } from '../game/types'

const playerArt: CardArtConfig = { front: '/card/Hero-front.png', back: '/card/Hero-back.png' }
const monsterBack = '/card/Monster-back.png'
const monsterArt = (variant: number): CardArtConfig => ({
  front: `/card/Monster-front-${variant}.png`,
  back: monsterBack,
})

export const cardCatalog = {
  sva_occluder: { id: 'sva_occluder', name: '遮光体', power: 4, description: '无额外效果。', effect: { type: 'none' }, art: monsterArt(1) },
  sva_off_axis_projection: { id: 'sva_off_axis_projection', name: '偏轴投影', power: 3, description: '若相邻有己方牌，本牌 Power +1。', effect: { type: 'self_power_if_position', condition: 'adjacent_friendly', amount: 1 }, art: monsterArt(2) },
  sva_boundary_convergence: { id: 'sva_boundary_convergence', name: '边界收束', power: 3, description: '若放在棋盘边缘，本牌 Power +1。', effect: { type: 'self_power_if_position', condition: 'edge', amount: 1 }, art: monsterArt(3) },
  sva_unobservable_zone: { id: 'sva_unobservable_zone', name: '不可观测区', power: 3, description: '入场时，使所有相邻玩家牌 Power -1。', effect: { type: 'adjacent_power_change', target: 'enemy', amount: -1 }, art: monsterArt(4) },
  sva_distorted_reading: { id: 'sva_distorted_reading', name: '失真读数', power: 4, description: '若相邻有玩家牌，本牌 Power +1。', effect: { type: 'self_power_if_position', condition: 'adjacent_enemy', amount: 1 }, art: monsterArt(7) },
  sva_black_box_model: { id: 'sva_black_box_model', name: '黑箱模型', power: 5, description: '无额外效果。', effect: { type: 'none' }, art: monsterArt(5) },
  sva_afterimage: { id: 'sva_afterimage', name: '失光残影', power: 2, description: '无额外效果。', effect: { type: 'none' }, art: monsterArt(6) },
  player_reference_point: { id: 'player_reference_point', name: '基准点', power: 5, description: '无额外效果。', effect: { type: 'none' }, art: playerArt },
  player_observation_record: { id: 'player_observation_record', name: '观测记录', power: 4, description: '无额外效果。', effect: { type: 'none' }, art: playerArt },
  player_calibration: { id: 'player_calibration', name: '校准', power: 3, description: '入场时，使所有相邻己方牌 Power +1。', effect: { type: 'adjacent_power_change', target: 'friendly', amount: 1 }, art: playerArt },
  player_error_correction: { id: 'player_error_correction', name: '误差修正', power: 3, description: '入场时，使所有相邻怪物牌 Power -1。', effect: { type: 'adjacent_power_change', target: 'enemy', amount: -1 }, art: playerArt },
  player_boundary_condition: { id: 'player_boundary_condition', name: '边界条件', power: 4, description: '若放在棋盘边缘，本牌 Power +1。', effect: { type: 'self_power_if_position', condition: 'edge', amount: 1 }, art: playerArt },
  player_falsification: { id: 'player_falsification', name: '反证', power: 4, description: '若本牌覆盖了怪物牌，本牌 Power +1。', effect: { type: 'self_power_on_cover', amount: 1 }, art: playerArt },
} as const satisfies Record<string, CardDefinition>

export type CardId = keyof typeof cardCatalog

export function getCardDefinition(cardId: string): CardDefinition {
  const card = cardCatalog[cardId as CardId]
  if (!card) throw new Error(`Unknown card: ${cardId}`)
  return card
}
