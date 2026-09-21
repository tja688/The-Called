import type { ShapeIcon, Op } from '../../shapes'

function card(id: string, ops: Op[]): ShapeIcon {
  return { id, size: [24, 24], ops, shadow: true }
}

/** 锈门层卡面。化身走 ASCII，这里是占场 / 法术。 */
export const CARD_ICONS: Record<string, ShapeIcon> = {
  pca01: card('card.pca01', [
    { c: 'ell', x: 12, y: 14, rx: 7, ry: 5, f: 'brown' },
    { c: 'disc', x: 8, y: 12, r: 3, f: 'pack' },
    { c: 'rect', x: 14, y: 8, w: 3, h: 4, f: 'sta' },
    { c: 'px', pts: [[6, 11]], f: 'gold' },
  ]),
  pca02: card('card.pca02', [
    { c: 'line', x1: 6, y1: 18, x2: 17, y2: 6, f: 'wood2', w: 2 },
    { c: 'poly', pts: [[16, 5], [20, 7], [16, 9]], f: 'gray2' },
    { c: 'disc', x: 17, y: 6, r: 2, f: 'gold' },
  ]),
  pca03: card('card.pca03', [
    { c: 'ring', x: 12, y: 13, r: 7, f: 'wood2' },
    { c: 'line', x1: 7, y1: 10, x2: 17, y2: 16, f: 'gray2', w: 1 },
    { c: 'line', x1: 17, y1: 10, x2: 7, y2: 16, f: 'gray2', w: 1 },
    { c: 'px', pts: [[12, 13], [8, 13], [16, 13]], f: 'gold' },
  ]),
  pca04: card('card.pca04', [
    { c: 'rect', x: 9, y: 10, w: 6, h: 8, f: 'pack' },
    { c: 'px', pts: [[12, 6], [8, 8], [16, 8], [6, 12], [18, 12], [10, 16], [14, 16]], f: 'gold' },
  ]),
  pca05: card('card.pca05', [
    { c: 'rect', x: 5, y: 10, w: 6, h: 6, f: 'pack' },
    { c: 'disc', x: 8, y: 12, r: 2, f: 'gold' },
    { c: 'poly', pts: [[12, 12], [18, 9], [18, 15]], f: 'sta' },
  ]),
  pca06: card('card.pca06', [
    { c: 'poly', pts: [[6, 16], [8, 8], [10, 8], [9, 16]], f: 'gray2' },
    { c: 'rect', x: 6, y: 6, w: 5, h: 3, f: 'pack' },
    { c: 'line', x1: 10, y1: 9, x2: 16, y2: 9, f: 'redD', w: 1 },
    { c: 'px', pts: [[11, 8]], f: 'gold' },
  ]),
  pca07: card('card.pca07', [
    { c: 'ell', x: 12, y: 13, rx: 7, ry: 6, f: 'pack' },
    { c: 'ell', x: 12, y: 13, rx: 5, ry: 4, f: 'wood2' },
    { c: 'ring', x: 12, y: 13, r: 3, f: 'gold' },
  ]),
  pca08: card('card.pca08', [
    { c: 'poly', pts: [[8, 18], [9, 7], [12, 6], [11, 18]], f: 'gray2' },
    { c: 'rect', x: 7, y: 8, w: 6, h: 2, f: 'pack' },
    { c: 'px', pts: [[10, 7], [13, 10]], f: 'gold' },
  ]),
  pca09: card('card.pca09', [
    { c: 'rect', x: 5, y: 16, w: 14, h: 4, f: 'stone' },
    { c: 'rect', x: 7, y: 8, w: 2, h: 8, f: 'copper' },
    { c: 'rect', x: 11, y: 6, w: 2, h: 10, f: 'copper' },
    { c: 'rect', x: 15, y: 9, w: 2, h: 7, f: 'copper' },
    { c: 'px', pts: [[8, 7], [12, 5], [16, 8]], f: 'gold' },
  ]),
  pca10: card('card.pca10', [
    { c: 'disc', x: 12, y: 12, r: 3, f: 'gold' },
    { c: 'px', pts: [[6, 8], [18, 8], [6, 16], [18, 16], [12, 6]], f: 'pack' },
  ]),
  pca11: card('card.pca11', [
    { c: 'line', x1: 5, y1: 16, x2: 8, y2: 6, f: 'wood2', w: 1 },
    { c: 'line', x1: 10, y1: 16, x2: 12, y2: 5, f: 'wood2', w: 1 },
    { c: 'line', x1: 15, y1: 16, x2: 18, y2: 6, f: 'wood2', w: 1 },
    { c: 'px', pts: [[8, 5], [12, 4], [18, 5]], f: 'gold' },
  ]),
  pca12: card('card.pca12', [
    { c: 'line', x1: 6, y1: 18, x2: 16, y2: 7, f: 'wood2', w: 2 },
    { c: 'poly', pts: [[15, 6], [19, 8], [15, 10]], f: 'leaf' },
    { c: 'px', pts: [[16, 6]], f: 'gold' },
  ]),
  pca13: card('card.pca13', [
    { c: 'poly', pts: [[5, 18], [7, 8], [12, 10], [10, 18]], f: 'wood1' },
    { c: 'line', x1: 7, y1: 8, x2: 18, y2: 8, f: 'wood2', w: 1 },
    { c: 'px', pts: [[18, 6], [16, 10]], f: 'gold' },
    { c: 'rect', x: 16, y: 14, w: 4, h: 5, f: 'fog' },
  ]),
  pca14: card('card.pca14', [
    { c: 'rect', x: 10, y: 6, w: 3, h: 12, f: 'wood1' },
    { c: 'rect', x: 8, y: 4, w: 8, h: 5, f: 'pack' },
    { c: 'px', pts: [[12, 16], [9, 18], [15, 18]], f: 'gold' },
  ]),
  pcb01: card('card.pcb01', [
    { c: 'ell', x: 8, y: 13, rx: 4, ry: 6, f: 'gray1' },
    { c: 'ell', x: 16, y: 13, rx: 4, ry: 6, f: 'gray1' },
    { c: 'line', x1: 10, y1: 10, x2: 14, y2: 10, f: 'redD', w: 1 },
    { c: 'px', pts: [[8, 10], [16, 10]], f: 'cream' },
  ]),
  pcb02: card('card.pcb02', [
    { c: 'rect', x: 6, y: 16, w: 12, h: 4, f: 'stone' },
    { c: 'px', pts: [[11, 10], [12, 12], [13, 14], [12, 16]], f: 'cream' },
    { c: 'px', pts: [[9, 15], [15, 15]], f: 'leaf' },
  ]),
  pcb03: card('card.pcb03', [
    { c: 'arc', x: 12, y: 12, r: 7, a0: 0.2, a1: 3.0, f: 'cream' },
    { c: 'px', pts: [[10, 14], [14, 14], [12, 16]], f: 'gray1' },
  ]),
  pcb04: card('card.pcb04', [
    { c: 'rect', x: 7, y: 14, w: 10, h: 5, f: 'cream' },
    { c: 'disc', x: 12, y: 10, r: 4, f: 'lamp2' },
    { c: 'px', pts: [[12, 5], [10, 8], [14, 8]], f: 'lamp1' },
  ]),
  pcb05: card('card.pcb05', [
    { c: 'rect', x: 8, y: 10, w: 8, h: 8, f: 'gray1' },
    { c: 'poly', pts: [[10, 10], [12, 4], [14, 10]], f: 'gray1' },
    { c: 'px', pts: [[12, 16]], f: 'cream' },
  ]),
  pcb06: card('card.pcb06', [
    { c: 'ell', x: 12, y: 12, rx: 8, ry: 7, f: 'cream' },
    { c: 'ell', x: 12, y: 13, rx: 5, ry: 4, f: 'ink' },
    { c: 'hl', x: 9, y: 8, w: 2 },
  ]),
  pcb07: card('card.pcb07', [
    { c: 'ell', x: 12, y: 13, rx: 7, ry: 6, f: 'gray2' },
    { c: 'ell', x: 12, y: 13, rx: 5, ry: 4, f: 'cream' },
    { c: 'rect', x: 18, y: 8, w: 2, h: 8, f: 'wood1' },
  ]),
  pcb08: card('card.pcb08', [
    { c: 'rect', x: 7, y: 6, w: 10, h: 12, f: 'paper' },
    { c: 'px', pts: [[10, 5], [14, 4], [12, 8]], f: 'lamp2' },
    { c: 'px', pts: [[9, 14], [15, 16]], f: 'gray2' },
  ]),
  pcb09: card('card.pcb09', [
    { c: 'rect', x: 5, y: 14, w: 14, h: 5, f: 'stone' },
    { c: 'poly', pts: [[8, 14], [12, 6], [16, 14]], f: 'cream' },
    { c: 'px', pts: [[10, 10], [14, 12]], f: 'gray1' },
  ]),
  pcb10: card('card.pcb10', [
    { c: 'px', pts: [[7, 10], [10, 8], [13, 12], [16, 9], [12, 16], [8, 15], [17, 14]], f: 'cream' },
  ]),
  pcb11: card('card.pcb11', [
    { c: 'ell', x: 9, y: 13, rx: 4, ry: 7, f: 'gray1' },
    { c: 'ell', x: 15, y: 14, rx: 4, ry: 6, f: 'fog' },
    { c: 'px', pts: [[15, 10]], f: 'purpleL' },
  ]),
  pcb12: card('card.pcb12', [
    { c: 'poly', pts: [[5, 18], [12, 6], [19, 18]], f: 'gray1' },
    { c: 'px', pts: [[12, 12], [10, 16], [14, 16]], f: 'cream' },
  ]),
  pcb13: card('card.pcb13', [
    { c: 'ell', x: 12, y: 14, rx: 7, ry: 5, f: 'cream' },
    { c: 'ell', x: 12, y: 14, rx: 5, ry: 3, f: 'redD' },
    { c: 'rect', x: 10, y: 6, w: 4, h: 6, f: 'cream' },
  ]),
  pcb14: card('card.pcb14', [
    { c: 'rect', x: 5, y: 12, w: 14, h: 7, f: 'wood1' },
    { c: 'rect', x: 5, y: 8, w: 14, h: 5, f: 'wood2' },
    { c: 'px', pts: [[12, 10]], f: 'cream' },
  ]),
  pcc01: card('card.pcc01', [
    { c: 'rect', x: 9, y: 12, w: 6, h: 7, f: 'copper' },
    { c: 'disc', x: 12, y: 9, r: 4, f: 'lamp2' },
    { c: 'disc', x: 12, y: 8, r: 2, f: 'lamp1' },
    { c: 'hl', x: 10, y: 7, w: 2 },
  ]),
  pcc02: card('card.pcc02', [
    { c: 'disc', x: 12, y: 13, r: 7, f: 'gray2' },
    { c: 'ell', x: 12, y: 12, rx: 5, ry: 4, f: 'gold' },
    { c: 'hl', x: 9, y: 9, w: 3 },
  ]),
  pcc03: card('card.pcc03', [
    { c: 'poly', pts: [[8, 8], [16, 8], [14, 18], [10, 18]], f: 'copper' },
    { c: 'px', pts: [[12, 6], [12, 10]], f: 'gold' },
  ]),
  pcc04: card('card.pcc04', [
    { c: 'ell', x: 12, y: 13, rx: 6, ry: 7, f: 'pack' },
    { c: 'rect', x: 10, y: 6, w: 4, h: 4, f: 'copper' },
    { c: 'px', pts: [[12, 8]], f: 'gold' },
  ]),
  pcc05: card('card.pcc05', [
    { c: 'rect', x: 8, y: 10, w: 8, h: 6, f: 'cream' },
    { c: 'px', pts: [[10, 8], [14, 8], [12, 6]], f: 'gold' },
  ]),
  pcc06: card('card.pcc06', [
    { c: 'ell', x: 12, y: 15, rx: 8, ry: 5, f: 'copper' },
    { c: 'ell', x: 12, y: 14, rx: 6, ry: 3, f: 'gold' },
    { c: 'hl', x: 8, y: 13, w: 3 },
  ]),
  pcc07: card('card.pcc07', [
    { c: 'rect', x: 10, y: 8, w: 4, h: 8, f: 'copper' },
    { c: 'px', pts: [[7, 10], [17, 10], [6, 16], [18, 16]], f: 'gold' },
  ]),
  pcc08: card('card.pcc08', [
    { c: 'rect', x: 6, y: 16, w: 12, h: 3, f: 'stone' },
    { c: 'line', x1: 8, y1: 16, x2: 16, y2: 8, f: 'gold', w: 2 },
    { c: 'rect', x: 14, y: 6, w: 5, h: 5, f: 'gray1' },
  ]),
  pcc09: card('card.pcc09', [
    { c: 'rect', x: 10, y: 12, w: 3, h: 8, f: 'copper' },
    { c: 'poly', pts: [[8, 12], [16, 6], [18, 10], [12, 14]], f: 'lamp2' },
    { c: 'px', pts: [[16, 5]], f: 'lamp1' },
  ]),
  pcc10: card('card.pcc10', [
    { c: 'rect', x: 10, y: 12, w: 4, h: 7, f: 'copper' },
    { c: 'disc', x: 12, y: 10, r: 3, f: 'ink2' },
    { c: 'px', pts: [[12, 6], [10, 8], [14, 8]], f: 'gray2' },
  ]),
  pcc11: card('card.pcc11', [
    { c: 'poly', pts: [[8, 6], [16, 6], [14, 14], [10, 14]], f: 'copper' },
    { c: 'rect', x: 11, y: 14, w: 3, h: 6, f: 'gold' },
  ]),
  pcc12: card('card.pcc12', [
    { c: 'rect', x: 9, y: 12, w: 6, h: 7, f: 'copper' },
    { c: 'disc', x: 12, y: 9, r: 5, f: 'gold' },
    { c: 'disc', x: 12, y: 9, r: 2, f: 'lamp1' },
  ]),
  pcc13: card('card.pcc13', [
    { c: 'rect', x: 7, y: 14, w: 10, h: 5, f: 'gray1' },
    { c: 'px', pts: [[12, 8], [9, 12], [15, 12], [12, 6]], f: 'gold' },
  ]),
  pcc14: card('card.pcc14', [
    { c: 'rect', x: 10, y: 8, w: 4, h: 12, f: 'cream' },
    { c: 'disc', x: 12, y: 7, r: 3, f: 'lamp2' },
    { c: 'px', pts: [[14, 12], [14, 15], [14, 18]], f: 'paperD' },
  ]),
  pcn01: card('card.pcn01', [
    { c: 'poly', pts: [[6, 8], [18, 8], [16, 18], [8, 18]], f: 'wood1' },
    { c: 'rect', x: 7, y: 10, w: 10, h: 2, f: 'gray1' },
    { c: 'hl', x: 8, y: 9, w: 3 },
  ]),
  pcn02: card('card.pcn02', [
    { c: 'rect', x: 6, y: 6, w: 12, h: 12, f: 'paper' },
    { c: 'line', x1: 8, y1: 10, x2: 16, y2: 10, f: 'ink2', w: 1 },
    { c: 'line', x1: 10, y1: 8, x2: 10, y2: 16, f: 'ink2', w: 1 },
  ]),
  pcn03: card('card.pcn03', [
    { c: 'rect', x: 9, y: 8, w: 6, h: 10, f: 'river3' },
    { c: 'rect', x: 8, y: 6, w: 8, h: 3, f: 'gray2' },
    { c: 'hl', x: 10, y: 10, w: 2 },
  ]),
  pcn04: card('card.pcn04', [
    { c: 'poly', pts: [[6, 8], [16, 6], [19, 16], [7, 18]], f: 'stone' },
    { c: 'line', x1: 10, y1: 8, x2: 14, y2: 16, f: 'slate', w: 1 },
  ]),
  pcn05: card('card.pcn05', [
    { c: 'rect', x: 16, y: 4, w: 4, h: 16, f: 'stone' },
    { c: 'poly', pts: [[6, 8], [16, 8], [15, 18], [7, 18]], f: 'gray1' },
  ]),
  pcn06: card('card.pcn06', [
    { c: 'rect', x: 11, y: 8, w: 3, h: 12, f: 'wood1' },
    { c: 'rect', x: 6, y: 5, w: 12, h: 6, f: 'gray1' },
    { c: 'hl', x: 8, y: 6, w: 3 },
  ]),
  pcn07: card('card.pcn07', [
    { c: 'disc', x: 12, y: 12, r: 7, f: 'copper' },
    { c: 'rect', x: 9, y: 8, w: 6, h: 8, f: 'gold' },
    { c: 'rect', x: 10, y: 10, w: 4, h: 4, f: 'copperD' },
  ]),
  pcn08: card('card.pcn08', [
    { c: 'poly', pts: [[5, 8], [11, 8], [11, 18], [5, 16]], f: 'copper' },
    { c: 'poly', pts: [[13, 8], [19, 8], [19, 16], [13, 18]], f: 'copper' },
  ]),
  pcn09: card('card.pcn09', [
    { c: 'rect', x: 10, y: 5, w: 4, h: 10, f: 'gold' },
    { c: 'rect', x: 8, y: 14, w: 8, h: 6, f: 'gold' },
    { c: 'px', pts: [[9, 16], [11, 16], [13, 16]], f: 'ink2' },
  ]),
  pcn10: card('card.pcn10', [
    { c: 'rect', x: 6, y: 6, w: 8, h: 10, f: 'paper' },
    { c: 'disc', x: 16, y: 15, r: 3, f: 'copper' },
    { c: 'disc', x: 18, y: 13, r: 2, f: 'gold' },
  ]),
  pcn11: card('card.pcn11', [
    { c: 'ell', x: 12, y: 13, rx: 7, ry: 6, f: 'pack' },
    { c: 'ell', x: 12, y: 13, rx: 5, ry: 4, f: 'wood2' },
    { c: 'rect', x: 18, y: 8, w: 2, h: 8, f: 'wood1' },
  ]),
  pcx01: card('card.pcx01', [
    { c: 'rect', x: 7, y: 6, w: 10, h: 12, f: 'paperD' },
    { c: 'px', pts: [[8, 8], [14, 10], [10, 14], [16, 16]], f: 'leaf' },
  ]),
  pcx02: card('card.pcx02', [
    { c: 'rect', x: 5, y: 14, w: 14, h: 5, f: 'stone' },
    { c: 'disc', x: 12, y: 12, r: 6, f: 'leaf' },
    { c: 'px', pts: [[8, 10], [16, 11], [12, 8]], f: 'sprout' },
  ]),
  rl01: card('card.rl01', [
    { c: 'rect', x: 10, y: 6, w: 4, h: 12, f: 'wood1' },
    { c: 'rect', x: 7, y: 4, w: 10, h: 5, f: 'copper' },
    { c: 'hl', x: 8, y: 5, w: 3 },
  ]),
}
