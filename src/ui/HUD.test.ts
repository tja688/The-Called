import { describe, expect, it } from 'vitest'
import { formatMatchResultMessage } from './HUD'

describe('formatMatchResultMessage', () => {
  it('uses the configured opponent name for a monster victory', () => {
    expect(formatMatchResultMessage('monster', 'Rahu & Ketu')).toBe('Rahu & Ketu 获胜。')
    expect(formatMatchResultMessage('monster', 'Moon')).toBe('Moon 获胜。')
  })

  it('keeps player and draw copy independent of the opponent', () => {
    expect(formatMatchResultMessage('player', 'Moon')).toBe('你赢了！')
    expect(formatMatchResultMessage('draw', 'Rahu & Ketu')).toBe('平局。')
  })
})
