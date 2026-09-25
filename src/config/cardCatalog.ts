import type { CardArtConfig, CardDefinition } from '../game/types'

const playerArt: CardArtConfig = { front: '/card/Hero-front.png', back: '/card/Hero-back.png' }
const monsterBack = '/card/Monster-back.png'
const monsterArt = (variant: number): CardArtConfig => ({
  front: `/card/Monster-front-${variant}.png`,
  back: monsterBack,
})

export const cardCatalog = {
  sva_occluder: { id: 'sva_occluder', name: '遮光体', power: 5, description: '无额外效果。', effect: { type: 'none' }, art: monsterArt(1) },
  sva_off_axis_projection: { id: 'sva_off_axis_projection', name: '偏轴投影', power: 4, description: '若相邻有己方牌，本牌 Power +1。', effect: { type: 'self_power_if_position', condition: 'adjacent_friendly', amount: 1 }, art: monsterArt(2) },
  sva_boundary_convergence: { id: 'sva_boundary_convergence', name: '边界收束', power: 3, description: '若放在棋盘边缘，本牌 Power +1。', effect: { type: 'self_power_if_position', condition: 'edge', amount: 1 }, art: monsterArt(3) },
  sva_unobservable_zone: { id: 'sva_unobservable_zone', name: '不可观测区', power: 3, description: '入场时，使所有相邻玩家牌 Power -1。', effect: { type: 'adjacent_power_change', target: 'enemy', amount: -1 }, art: monsterArt(4) },
  sva_distorted_reading: { id: 'sva_distorted_reading', name: '失真读数', power: 5, description: '若相邻有玩家牌，本牌 Power +1。', effect: { type: 'self_power_if_position', condition: 'adjacent_enemy', amount: 1 }, art: monsterArt(7) },
  sva_black_box_model: { id: 'sva_black_box_model', name: '黑箱模型', power: 6, description: '无额外效果。', effect: { type: 'none' }, art: monsterArt(5) },
  sva_afterimage: { id: 'sva_afterimage', name: '失光残影', power: 2, description: '无额外效果。', effect: { type: 'none' }, art: monsterArt(6) },
  rk_vacant_pole: { id: 'rk_vacant_pole', name: '空极', power: 5, description: '若正交相邻没有己方牌，本牌 Power +1。', effect: { type: 'self_power_if_position', condition: 'isolated', amount: 1 }, art: monsterArt(1) },
  rk_dipole: { id: 'rk_dipole', name: '对径读数', power: 3, description: '若中心对称的格子上有牌，本牌 Power +1。', effect: { type: 'mirror', affect: 'self', amount: 1 }, art: monsterArt(2) },
  rk_deep_eclipse: { id: 'rk_deep_eclipse', name: '深食', power: 4, description: '若本牌覆盖了玩家牌，本牌 Power +2。', effect: { type: 'self_power_on_cover', amount: 2 }, art: monsterArt(3) },
  rk_latitude: { id: 'rk_latitude', name: '纬向遮挡', power: 3, description: '入场时，使同一行的其他玩家牌 Power -1。', effect: { type: 'line', axis: 'row', target: 'enemy', amount: -1 }, art: monsterArt(4) },
  rk_longitude: { id: 'rk_longitude', name: '经向遮挡', power: 3, description: '入场时，使同一列的其他玩家牌 Power -1。', effect: { type: 'line', axis: 'col', target: 'enemy', amount: -1 }, art: monsterArt(5) },
  rk_antipode: { id: 'rk_antipode', name: '对趾点', power: 5, description: '入场时，若中心对称格上是玩家牌，使其 Power -1。', effect: { type: 'mirror', affect: 'enemy', amount: -1 }, art: monsterArt(6) },
  rk_node: { id: 'rk_node', name: '交点', power: 3, description: '若放在棋盘正中，本牌 Power +2。', effect: { type: 'self_power_if_position', condition: 'center', amount: 2 }, art: monsterArt(7) },
  moon_horn: { id: 'moon_horn', name: '角尖', power: 4, description: '若放在棋盘四角，本牌 Power +1。', effect: { type: 'self_power_if_position', condition: 'corner', amount: 1 }, art: monsterArt(1) },
  moon_waxing: { id: 'moon_waxing', name: '盈照', power: 3, description: '入场时，使所有相邻己方牌 Power +2。', effect: { type: 'adjacent_power_change', target: 'friendly', amount: 2 }, art: monsterArt(2) },
  moon_waning: { id: 'moon_waning', name: '亏蚀', power: 2, description: '入场时，使所有相邻玩家牌 Power -2。', effect: { type: 'adjacent_power_change', target: 'enemy', amount: -2 }, art: monsterArt(3) },
  moon_full: { id: 'moon_full', name: '望', power: 5, description: '若场上己方牌至少有 3 张（含本牌），本牌 Power +1。', effect: { type: 'self_power_if_count', side: 'friendly', minimum: 3, amount: 1 }, art: monsterArt(4) },
  moon_occult: { id: 'moon_occult', name: '掩食', power: 3, description: '若本牌覆盖了玩家牌，本牌 Power +2。', effect: { type: 'self_power_on_cover', amount: 2 }, art: monsterArt(5) },
  moon_tide: { id: 'moon_tide', name: '潮汐', power: 4, description: '入场时，使所有位于棋盘边缘的玩家牌 Power -1。', effect: { type: 'edge_tax', amount: -1 }, art: monsterArt(6) },
  moon_facing: { id: 'moon_facing', name: '对月', power: 5, description: '若相邻有玩家牌，本牌 Power +2。', effect: { type: 'self_power_if_position', condition: 'adjacent_enemy', amount: 2 }, art: monsterArt(7) },
  player_reference_point: { id: 'player_reference_point', name: '基准点', power: 5, description: '无额外效果。', effect: { type: 'none' }, art: playerArt },
  player_observation_record: { id: 'player_observation_record', name: '观测记录', power: 4, description: '无额外效果。', effect: { type: 'none' }, art: playerArt },
  player_calibration: { id: 'player_calibration', name: '校准', power: 3, description: '入场时，使所有相邻己方牌 Power +1。', effect: { type: 'adjacent_power_change', target: 'friendly', amount: 1 }, art: playerArt },
  player_error_correction: { id: 'player_error_correction', name: '误差修正', power: 3, description: '入场时，使所有相邻怪物牌 Power -1。', effect: { type: 'adjacent_power_change', target: 'enemy', amount: -1 }, art: playerArt },
  player_boundary_condition: { id: 'player_boundary_condition', name: '边界条件', power: 4, description: '若放在棋盘边缘，本牌 Power +1。', effect: { type: 'self_power_if_position', condition: 'edge', amount: 1 }, art: playerArt },
  player_falsification: { id: 'player_falsification', name: '反证', power: 4, description: '若本牌覆盖了怪物牌，本牌 Power +1。', effect: { type: 'self_power_on_cover', amount: 1 }, art: playerArt },
  player_antipode: { id: 'player_antipode', name: '对径', power: 3, description: '入场时，若中心对称格上是怪物牌，使其 Power -1。', effect: { type: 'mirror', affect: 'enemy', amount: -1 }, art: playerArt },
  player_meridian: { id: 'player_meridian', name: '经线', power: 4, description: '入场时，使同一列的其他怪物牌 Power -1。', effect: { type: 'line', axis: 'col', target: 'enemy', amount: -1 }, art: playerArt },
  player_center_condition: { id: 'player_center_condition', name: '中心条件', power: 4, description: '若放在棋盘正中，本牌 Power +1。', effect: { type: 'self_power_if_position', condition: 'center', amount: 1 }, art: playerArt },
  player_syzygy: { id: 'player_syzygy', name: '合相', power: 3, description: '若场上己方牌至少有 3 张（含本牌），本牌 Power +2。', effect: { type: 'self_power_if_count', side: 'friendly', minimum: 3, amount: 2 }, art: playerArt },
} as const satisfies Record<string, CardDefinition>

export type CardId = keyof typeof cardCatalog

export function getCardDefinition(cardId: string): CardDefinition {
  const card = cardCatalog[cardId as CardId]
  if (!card) throw new Error(`Unknown card: ${cardId}`)
  return card
}
