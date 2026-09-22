import type { ShapeIcon } from '../../shapes'

export const ICONS: Record<string, ShapeIcon> = {
  occupy: {
    id: 'icon.occupy',
    size: [16, 16],
    ops: [
      { c: 'rect', x: 7, y: 3, w: 2, h: 10, f: 'copper' },
      { c: 'poly', pts: [[9, 3], [14, 6], [9, 8]], f: 'gold' },
      { c: 'rect', x: 5, y: 12, w: 6, h: 2, f: 'stone' },
    ],
  },
  seal: {
    id: 'icon.seal',
    size: [16, 16],
    ops: [
      { c: 'rect', x: 3, y: 6, w: 10, h: 4, f: 'copperD' },
      { c: 'rect', x: 6, y: 3, w: 4, h: 10, f: 'gray1' },
    ],
  },
  lead: {
    id: 'icon.lead',
    size: [16, 16],
    ops: [
      { c: 'poly', pts: [[8, 2], [14, 8], [11, 8], [11, 14], [5, 14], [5, 8], [2, 8]], f: 'sta' },
      { c: 'hl', x: 7, y: 5, w: 2 },
    ],
  },
  marked: {
    id: 'icon.marked',
    size: [16, 16],
    ops: [
      { c: 'px', pts: [[4, 6], [8, 4], [11, 8], [6, 10], [12, 12], [8, 14]], f: 'gold' },
    ],
  },
  oil: {
    id: 'icon.oil',
    size: [16, 16],
    ops: [
      { c: 'disc', x: 8, y: 9, r: 4, f: 'gold' },
      { c: 'px', pts: [[8, 4], [7, 6]], f: 'goldL' },
    ],
  },
  hub: {
    id: 'icon.hub',
    size: [24, 24],
    ops: [
      { c: 'rect', x: 3, y: 4, w: 4, h: 16, f: 'copperD' },
      { c: 'rect', x: 17, y: 4, w: 4, h: 16, f: 'copperD' },
      { c: 'rect', x: 5, y: 4, w: 2, h: 16, f: 'copper' },
      { c: 'rect', x: 17, y: 4, w: 2, h: 16, f: 'copper' },
      { c: 'rect', x: 3, y: 6, w: 18, h: 4, f: 'copper' },
      { c: 'clear', x: 9, y: 6, w: 6, h: 4 },
      { c: 'rect', x: 5, y: 19, w: 14, h: 2, f: 'stone' },
      { c: 'rect', x: 7, y: 17, w: 4, h: 2, f: 'ink2' },
    ],
  },
  normal: {
    id: 'icon.normal',
    size: [20, 20],
    ops: [
      { c: 'rect', x: 9, y: 11, w: 3, h: 6, f: 'wood1' },
      { c: 'rect', x: 3, y: 3, w: 14, h: 8, f: 'wood2' },
      { c: 'rect', x: 3, y: 3, w: 14, h: 2, f: 'wood3' },
      { c: 'rect', x: 5, y: 6, w: 2, h: 3, f: 'pack' },
      { c: 'rect', x: 9, y: 6, w: 2, h: 3, f: 'pack' },
      { c: 'rect', x: 13, y: 6, w: 2, h: 3, f: 'pack' },
    ],
  },
  elite: {
    id: 'icon.elite',
    size: [20, 20],
    ops: [
      { c: 'rect', x: 4, y: 2, w: 12, h: 16, f: 'gray1' },
      { c: 'rect', x: 6, y: 5, w: 8, h: 10, f: 'ink2' },
      { c: 'rect', x: 6, y: 6, w: 8, h: 1, f: 'cream' },
      { c: 'rect', x: 6, y: 9, w: 6, h: 1, f: 'cream' },
      { c: 'rect', x: 8, y: 12, w: 6, h: 1, f: 'cream' },
      { c: 'rect', x: 12, y: 9, w: 2, h: 3, f: 'copper' },
      { c: 'rect', x: 8, y: 15, w: 3, h: 2, f: 'teal' },
    ],
  },
  boss: {
    id: 'icon.boss',
    size: [20, 20],
    ops: [
      { c: 'rect', x: 2, y: 2, w: 16, h: 4, f: 'stone' },
      { c: 'rect', x: 2, y: 6, w: 4, h: 12, f: 'stone' },
      { c: 'rect', x: 14, y: 6, w: 4, h: 12, f: 'stone' },
      { c: 'rect', x: 6, y: 11, w: 8, h: 6, f: 'ene' },
      { c: 'rect', x: 8, y: 13, w: 4, h: 3, f: 'cream' },
      { c: 'rect', x: 4, y: 8, w: 2, h: 2, f: 'copperD' },
    ],
  },
  event: {
    id: 'icon.event',
    size: [20, 20],
    ops: [
      { c: 'rect', x: 9, y: 2, w: 2, h: 6, f: 'copper' },
      { c: 'disc', x: 10, y: 11, r: 3, f: 'lamp2' },
      { c: 'rect', x: 9, y: 9, w: 2, h: 2, f: 'lamp1' },
      { c: 'rect', x: 4, y: 16, w: 4, h: 2, f: 'stone' },
      { c: 'rect', x: 13, y: 16, w: 4, h: 2, f: 'slate' },
    ],
  },
  shop: {
    id: 'icon.shop',
    size: [20, 20],
    ops: [
      { c: 'poly', pts: [[2, 9], [11, 9], [13, 14], [11, 18], [2, 18]], f: 'gray1' },
      { c: 'rect', x: 2, y: 12, w: 10, h: 2, f: 'copperD' },
      { c: 'disc', x: 15, y: 6, r: 3, f: 'pack' },
      { c: 'rect', x: 13, y: 5, w: 2, h: 2, f: 'cream' },
      { c: 'rect', x: 16, y: 5, w: 2, h: 2, f: 'cream' },
      { c: 'rect', x: 5, y: 14, w: 3, h: 2, f: 'gold' },
    ],
  },
  chest: {
    id: 'icon.chest',
    size: [20, 20],
    ops: [
      { c: 'rect', x: 3, y: 8, w: 14, h: 8, f: 'wood1' },
      { c: 'rect', x: 3, y: 4, w: 14, h: 5, f: 'wood2' },
      { c: 'rect', x: 3, y: 8, w: 14, h: 2, f: 'copperD' },
      { c: 'rect', x: 3, y: 14, w: 14, h: 2, f: 'copperD' },
      { c: 'rect', x: 9, y: 10, w: 2, h: 3, f: 'gold' },
    ],
  },
  rest: {
    id: 'icon.rest',
    size: [20, 20],
    ops: [
      { c: 'rect', x: 3, y: 8, w: 11, h: 8, f: 'stone' },
      { c: 'rect', x: 5, y: 10, w: 7, h: 4, f: 'river2' },
      { c: 'rect', x: 6, y: 10, w: 4, h: 1, f: 'river3' },
      { c: 'rect', x: 2, y: 8, w: 3, h: 2, f: 'leaf' },
      { c: 'rect', x: 11, y: 14, w: 3, h: 2, f: 'leaf' },
      { c: 'rect', x: 15, y: 4, w: 2, h: 6, f: 'cream' },
      { c: 'rect', x: 14, y: 2, w: 4, h: 2, f: 'lamp2' },
    ],
  },
  forge: {
    id: 'icon.forge',
    size: [20, 20],
    ops: [
      { c: 'rect', x: 2, y: 10, w: 12, h: 4, f: 'gray1' },
      { c: 'rect', x: 5, y: 14, w: 6, h: 3, f: 'gray1' },
      { c: 'rect', x: 2, y: 10, w: 12, h: 1, f: 'stoneL' },
      { c: 'rect', x: 13, y: 6, w: 3, h: 8, f: 'copper' },
      { c: 'rect', x: 11, y: 4, w: 7, h: 3, f: 'copperD' },
    ],
  },
  next: {
    id: 'icon.next',
    size: [20, 20],
    ops: [
      { c: 'rect', x: 2, y: 3, w: 16, h: 3, f: 'stoneL' },
      { c: 'rect', x: 4, y: 7, w: 12, h: 3, f: 'stone' },
      { c: 'rect', x: 6, y: 11, w: 8, h: 3, f: 'slate' },
      { c: 'rect', x: 8, y: 15, w: 4, h: 3, f: 'ink2' },
    ],
  },
  unknown: {
    id: 'icon.unknown',
    size: [20, 20],
    ops: [
      { c: 'rect', x: 6, y: 11, w: 8, h: 5, f: 'slate' },
      { c: 'rect', x: 4, y: 6, w: 12, h: 6, f: 'gray1' },
      { c: 'rect', x: 6, y: 7, w: 8, h: 3, f: 'ink2' },
      { c: 'rect', x: 7, y: 8, w: 2, h: 2, f: 'gray3' },
      { c: 'rect', x: 11, y: 8, w: 2, h: 2, f: 'gray3' },
    ],
  },
  me01: {
    id: 'icon.me01',
    size: [16, 16],
    ops: [
      { c: 'rect', x: 3, y: 4, w: 3, h: 10, f: 'stone' },
      { c: 'rect', x: 10, y: 4, w: 3, h: 10, f: 'stone' },
      { c: 'rect', x: 6, y: 8, w: 4, h: 6, f: 'pack' },
    ],
  },
  me02: {
    id: 'icon.me02',
    size: [16, 16],
    ops: [
      { c: 'rect', x: 3, y: 4, w: 10, h: 8, f: 'stone' },
      { c: 'rect', x: 4, y: 6, w: 8, h: 5, f: 'redD' },
      { c: 'hl', x: 5, y: 7, w: 3 },
    ],
  },
  me03: {
    id: 'icon.me03',
    size: [16, 16],
    ops: [
      { c: 'rect', x: 10, y: 3, w: 4, h: 12, f: 'stone' },
      { c: 'poly', pts: [[4, 8], [10, 8], [10, 14], [5, 14]], f: 'gray1' },
      { c: 'px', pts: [[4, 12], [8, 13]], f: 'leaf' },
    ],
  },
  vulnerable: {
    id: 'icon.vulnerable',
    size: [16, 16],
    ops: [
      { c: 'px', pts: [[4, 6], [8, 4], [11, 8], [6, 10], [12, 12], [8, 14]], f: 'gold' },
      { c: 'line', x1: 5, y1: 5, x2: 12, y2: 13, f: 'redD', w: 1 },
    ],
  },
  protected: {
    id: 'icon.protected',
    size: [16, 16],
    ops: [
      { c: 'ell', x: 8, y: 9, rx: 5, ry: 6, f: 'gold' },
      { c: 'px', pts: [[8, 5], [6, 8]], f: 'goldL' },
    ],
  },
  rebirth: {
    id: 'icon.rebirth',
    size: [16, 16],
    ops: [
      { c: 'px', pts: [[5, 12], [7, 9], [8, 6], [10, 9], [12, 12], [8, 4]], f: 'goldL' },
      { c: 'px', pts: [[6, 13], [11, 13]], f: 'cream' },
    ],
  },
}
