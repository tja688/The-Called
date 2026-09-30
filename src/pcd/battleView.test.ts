import { describe, expect, it } from 'vitest'
import { boardTargetIds, canPlayFromHand, nextCameraMode } from './battleView'

const play = { actor: 'player', options: [{ kind: 'play', instance: 4 }, { kind: 'end-turn', instance: 0 }] }

describe('对局镜头', () => {
  it('打完牌后从俯视回到手牌透视', () => {
    expect(nextCameraMode('overview', false, play, new Set())).toBe('board')
  })

  it('已经在选下一张牌时不再把镜头拉回去', () => {
    expect(nextCameraMode('overview', true, play, new Set())).toBe('overview')
  })

  it('手牌视角打出的牌结算完仍留在手牌视角', () => {
    expect(nextCameraMode('board', false, play, new Set())).toBe('board')
  })

  it('要点格子或场上的牌时切到俯视', () => {
    const cell = { actor: 'player', options: [{ kind: 'cell', instance: 0 }] }
    const boardCard = { actor: 'player', options: [{ kind: 'card', instance: 12 }] }
    expect(nextCameraMode('board', false, cell, new Set())).toBe('overview')
    expect(nextCameraMode('board', false, boardCard, new Set([12]))).toBe('overview')
    expect(canPlayFromHand(cell)).toBe(false)
  })

  it('弃牌堆里的选牌不占俯视，手牌仍可打时回到手牌', () => {
    const loose = { actor: 'player', options: [{ kind: 'card', instance: 12 }] }
    expect(nextCameraMode('overview', false, loose, new Set())).toBe('board')
    expect(canPlayFromHand(play)).toBe(true)
    expect(canPlayFromHand(null)).toBe(false)
  })

  it('场上可选的牌用实例号标记', () => {
    expect(boardTargetIds(
      [{ kind: 'card', instance: 12 }, { kind: 'card', instance: 4 }, { kind: 'play', instance: 4 }],
      new Set([12]),
    )).toEqual(['pcd-12'])
  })
})
