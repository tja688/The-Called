import { describe, expect, it } from 'vitest'
import { getDiagonalNeighbors, getMirrorCell, getOrthogonalNeighbors } from './spatial'

describe('3x3 spatial queries', () => {
  it('returns two neighbors for a corner', () => {
    expect(getOrthogonalNeighbors('cell-0-0')).toEqual(['cell-1-0', 'cell-0-1'])
  })

  it('returns four neighbors for the center', () => {
    expect(getOrthogonalNeighbors('cell-1-1')).toHaveLength(4)
    expect(getDiagonalNeighbors('cell-1-1')).toHaveLength(4)
  })

  it('maps cells around the board center', () => {
    expect(getMirrorCell('cell-0-1')).toBe('cell-2-1')
    expect(getMirrorCell('cell-1-1')).toBe('cell-1-1')
  })
})
