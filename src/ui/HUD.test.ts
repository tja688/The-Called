import { describe, expect, it } from 'vitest'
import { formatMatchResultMessage, matchResultActions } from './HUD'

describe('formatMatchResultMessage', () => {
  it('uses the configured opponent name for a monster victory', () => {
    expect(formatMatchResultMessage('monster', 'Rahu & Ketu')).toBe('Rahu & Ketu 获胜。')
    expect(formatMatchResultMessage('monster', 'Moon')).toBe('Moon 获胜。')
  })

  it('keeps player and draw copy independent of the opponent', () => {
    expect(formatMatchResultMessage('player', 'Moon')).toBe('你赢了！')
    expect(formatMatchResultMessage('draw', 'Rahu & Ketu')).toBe('平局。')
  })

  it('offers the next level only after a win that is not the last encounter', () => {
    expect(matchResultActions('player', true)).toEqual(['next', 'retry', 'map'])
    expect(matchResultActions('player', false)).toEqual(['retry', 'map'])
    expect(matchResultActions('monster', true)).toEqual(['retry', 'map'])
  })
})
