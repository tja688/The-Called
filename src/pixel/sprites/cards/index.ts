import type { ShapeIcon, Op } from '../../shapes'

function card(id: string, ops: Op[]): ShapeIcon {
  return { id, size: [24, 24], ops, shadow: true }
}

/** 玩家 / 奖励 / 事件卡面。四周留 1px。 */
export const CARD_ICONS: Record<string, ShapeIcon> = {
  p01: card('card.p01', [
    { c: 'rect', x: 11, y: 5, w: 2, h: 13, f: 'gray2' },
    { c: 'poly', pts: [[8, 5], [16, 5], [14, 8], [10, 8]], f: 'gray3' },
    { c: 'poly', pts: [[11, 17], [13, 17], [12, 20]], f: 'gray1' },
    { c: 'hl', x: 11, y: 6, w: 1 },
  ]),
  p02: card('card.p02', [
    { c: 'poly', pts: [[6, 18], [18, 18], [16, 6], [10, 10]], f: 'wood2' },
    { c: 'poly', pts: [[10, 10], [16, 6], [15, 8], [11, 11]], f: 'wood3' },
    { c: 'hl', x: 12, y: 9, w: 2 },
  ]),
  p03: card('card.p03', [
    { c: 'rect', x: 11, y: 12, w: 2, h: 7, f: 'cream' },
    { c: 'disc', x: 12, y: 9, r: 3, f: 'lamp2' },
    { c: 'disc', x: 12, y: 8, r: 2, f: 'lamp1' },
    { c: 'hl', x: 11, y: 7, w: 1 },
  ]),
  p04: card('card.p04', [
    { c: 'ell', x: 12, y: 13, rx: 8, ry: 5, f: 'stone' },
    { c: 'ell', x: 12, y: 12, rx: 6, ry: 3, f: 'stoneL' },
    { c: 'hl', x: 8, y: 11, w: 3 },
  ]),
  p05: card('card.p05', [
    { c: 'disc', x: 12, y: 14, r: 4, f: 'orangeD' },
    { c: 'disc', x: 12, y: 12, r: 3, f: 'lamp2' },
    { c: 'px', pts: [[12, 7], [10, 9], [14, 9], [8, 12], [16, 11]], f: 'lamp1' },
  ]),
  p06: card('card.p06', [
    { c: 'rect', x: 6, y: 16, w: 12, h: 3, f: 'wood1' },
    { c: 'rect', x: 11, y: 6, w: 2, h: 11, f: 'wood2' },
    { c: 'rect', x: 8, y: 8, w: 8, h: 2, f: 'wood3' },
    { c: 'hl', x: 11, y: 7, w: 1 },
  ]),
  p07: card('card.p07', [
    { c: 'disc', x: 12, y: 13, r: 6, f: 'lamp3' },
    { c: 'disc', x: 12, y: 13, r: 3, f: 'gold' },
    { c: 'rect', x: 11, y: 5, w: 2, h: 5, f: 'wood1' },
    { c: 'hl', x: 9, y: 11, w: 2 },
  ]),
  ev01: card('card.ev01', [
    { c: 'rect', x: 11, y: 5, w: 2, h: 13, f: 'blueL' },
    { c: 'poly', pts: [[8, 5], [16, 5], [14, 8], [10, 8]], f: 'river3' },
    { c: 'poly', pts: [[11, 17], [13, 17], [12, 20]], f: 'blueD' },
  ]),
  r01: card('card.r01', [
    { c: 'rect', x: 11, y: 6, w: 2, h: 12, f: 'gray2' },
    { c: 'poly', pts: [[13, 8], [18, 6], [14, 11]], f: 'gray3' },
    { c: 'poly', pts: [[13, 13], [19, 12], [14, 16]], f: 'gray3' },
  ]),
  r02: card('card.r02', [
    { c: 'rect', x: 11, y: 10, w: 2, h: 9, f: 'wood1' },
    { c: 'rect', x: 6, y: 5, w: 12, h: 6, f: 'slate' },
    { c: 'rect', x: 7, y: 6, w: 10, h: 2, f: 'slateL' },
    { c: 'hl', x: 8, y: 6, w: 2 },
  ]),
  r03: card('card.r03', [
    { c: 'rect', x: 7, y: 12, w: 10, h: 5, f: 'wood1' },
    { c: 'disc', x: 16, y: 9, r: 3, f: 'lamp2' },
    { c: 'px', pts: [[15, 5], [18, 6], [14, 7]], f: 'lamp1' },
  ]),
  r04: card('card.r04', [
    { c: 'rrect', x: 7, y: 10, w: 10, h: 8, r: 1, f: 'copper' },
    { c: 'arc', x: 12, y: 10, r: 4, a0: Math.PI, a1: 0, f: 'copperL' },
    { c: 'disc', x: 12, y: 14, r: 1, f: 'gold' },
  ]),
  r05: card('card.r05', [
    { c: 'ring', x: 12, y: 12, r: 7, f: 'purpleL' },
    { c: 'ring', x: 12, y: 12, r: 4, f: 'sig' },
    { c: 'disc', x: 12, y: 12, r: 1, f: 'cream' },
  ]),
  r06: card('card.r06', [
    { c: 'line', x1: 6, y1: 6, x2: 18, y2: 18, f: 'lamp3', w: 2 },
    { c: 'line', x1: 18, y1: 6, x2: 6, y2: 18, f: 'lamp3', w: 2 },
    { c: 'hl', x: 10, y: 10, w: 2 },
  ]),
  r07: card('card.r07', [
    { c: 'rect', x: 11, y: 4, w: 2, h: 8, f: 'slateL' },
    { c: 'poly', pts: [[6, 12], [18, 12], [16, 19], [8, 19]], f: 'slate' },
    { c: 'hl', x: 9, y: 13, w: 2 },
  ]),
  r08: card('card.r08', [
    { c: 'disc', x: 12, y: 8, r: 3, f: 'gold' },
    { c: 'rect', x: 11, y: 10, w: 2, h: 8, f: 'wood2' },
    { c: 'poly', pts: [[12, 18], [8, 20], [16, 20]], f: 'wood1' },
  ]),
}
