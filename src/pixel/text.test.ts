import { describe, expect, it } from 'vitest'
import { rectsOverlap, textBox } from './text'

describe('textBox', () => {
  it('left/top 锚点就是左上角', () => {
    expect(textBox(10, 20, 40, 12, 'left', 'top')).toEqual({ x: 10, y: 20, w: 40, h: 12 })
  })
  it('居中锚点向两边展开', () => {
    expect(textBox(50, 10, 20, 8, 'center', 'top')).toEqual({ x: 40, y: 10, w: 20, h: 8 })
  })
  it('middle 基线向上折半', () => {
    expect(textBox(0, 10, 10, 8, 'left', 'middle')).toEqual({ x: 0, y: 6, w: 10, h: 8 })
  })
})

describe('rectsOverlap', () => {
  it('相邻不重叠，相交则重叠', () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false)
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 9, y: 0, w: 10, h: 10 })).toBe(true)
  })
  it('居中卡名会盖进侧边检视盒', () => {
    const name = textBox(48, 34, 36, 12, 'center', 'top')
    const tip = { x: 40, y: 20, w: 200, h: 72 }
    expect(rectsOverlap(name, tip)).toBe(true)
  })
})
