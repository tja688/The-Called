import { describe, expect, it } from 'vitest'
import { formatMatchResultMessage, matchDeparture } from './HUD'

describe('formatMatchResultMessage', () => {
  it('uses the configured opponent name for a monster victory', () => {
    expect(formatMatchResultMessage('monster', 'Rahu & Ketu')).toBe('Rahu & Ketu 获胜。')
    expect(formatMatchResultMessage('monster', 'Moon')).toBe('Moon 获胜。')
  })

  it('keeps player and draw copy independent of the opponent', () => {
    expect(formatMatchResultMessage('player', 'Moon')).toBe('你赢了！')
    expect(formatMatchResultMessage('draw', 'Rahu & Ketu')).toBe('平局。')
  })

  it('sends a win back to the map and a loss or draw back to the menu', () => {
    expect(matchDeparture('player')).toBe('map')
    expect(matchDeparture('monster')).toBe('home')
    expect(matchDeparture('draw')).toBe('home')
  })
})
