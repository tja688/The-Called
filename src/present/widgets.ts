import { PAL, rgba, SCHOOL_COLOR } from '../pixel/palette'
import { ASSETS } from '../pixel/assets'
import { blit } from '../pixel/dsl'
import { cardFrame, pxRoundRect } from '../pixel/ui'
import type { TextLayer } from '../pixel/text'
import type { CardDef } from '../content/cards'
import { fictionName } from './fiction'

type G = CanvasRenderingContext2D

function edgeOf(def: CardDef): string {
  if (def.kind === 'spell') return PAL.sig
  if (def.kind === 'avatar') return PAL.lamp1
  return SCHOOL_COLOR[def.school] ?? PAL.stoneL
}

export function drawHandCard(
  g: G,
  text: TextLayer,
  def: CardDef,
  x: number,
  y: number,
  w: number,
  h: number,
  opt: { selected?: boolean; dim?: boolean; points?: number } = {},
): void {
  cardFrame(g, x, y, w, h, edgeOf(def), PAL.paper, { selected: opt.selected, dim: opt.dim })
  const icon = ASSETS.card(def.id)
  blit(g, icon, x + Math.round((w - icon.width) / 2), y + 8, 1)
  text.draw(fictionName(def.id), x + w / 2, y + 34, { size: 10, align: 'center', color: PAL.ink, bold: true, maxWidth: w - 6 })
  const sub = def.kind === 'spell' ? '法术' : `${opt.points ?? def.basePoints}点`
  text.draw(`${sub} · ${def.cost}费`, x + w / 2, y + h - 16, { size: 9, align: 'center', color: PAL.wood1, maxWidth: w - 6 })
}

export function drawBoardToken(
  g: G,
  text: TextLayer,
  def: CardDef,
  x: number,
  y: number,
  size: number,
  opt: { points: number; sealed?: boolean; player?: boolean; selected?: boolean },
): void {
  const edge = opt.player ? PAL.fruG : PAL.fruR
  cardFrame(g, x, y, size, size, edge, PAL.paper, { selected: opt.selected, dim: opt.sealed })
  const icon = ASSETS.card(def.id)
  blit(g, icon, x + Math.round((size - icon.width) / 2), y + 4)
  text.draw(String(opt.points), x + size / 2, y + size - 14, {
    size: 14, align: 'center', bold: true, color: opt.player ? PAL.fruG : PAL.fruR, stroke: PAL.ink, strokeWidth: 3,
  })
  if (opt.sealed) {
    const seal = ASSETS.icon('icon.seal', 16, 16)
    blit(g, seal, x + size - 18, y + 2)
  }
}

/** 缠布血条：红从左渗到右，不要爱心。 */
export function drawHpBar(g: G, text: TextLayer, x: number, y: number, w: number, hp: number, max: number): void {
  const ratio = max ? hp / max : 0
  pxRoundRect(g, x, y, w, 8, PAL.ink, 1)
  g.fillStyle = PAL.paperD
  g.fillRect(x + 1, y + 1, w - 2, 6)
  const fw = Math.round((w - 2) * Math.max(0, Math.min(1, ratio)))
  if (fw > 0) {
    g.fillStyle = PAL.redD
    g.fillRect(x + 1, y + 1, fw, 6)
    g.fillStyle = PAL.red
    g.fillRect(x + 1, y + 1, fw, 3)
    g.fillStyle = rgba(PAL.cream, 0.25)
    g.fillRect(x + 1, y + 1, fw, 1)
  }
  g.fillStyle = mixWrap(PAL.ink2, 0.35)
  for (let i = 6; i < w - 2; i += 6) g.fillRect(x + i, y + 1, 1, 6)
  text.draw(`${hp}/${max}`, x + w + 6, y - 1, { size: 10, color: PAL.cream })
}

function mixWrap(hex: string, a: number): string {
  return rgba(hex, a)
}

export function drawWoundChip(g: G, text: TextLayer, x: number, y: number, wound: number): void {
  pxRoundRect(g, x, y, 72, 16, rgba(PAL.lamp3, 0.85), 2)
  text.draw(`代价预估 ${wound}`, x + 36, y + 8, { size: 10, align: 'center', baseline: 'middle', color: PAL.cream, bold: true })
}

export function drawTooltip(g: G, text: TextLayer, def: CardDef, x: number, y: number): void {
  const w = 200, h = 72
  let px = x, py = y
  if (px + w > 632) px = 632 - w
  if (py + h > 352) py = 352 - h
  cardFrame(g, px, py, w, h, PAL.copperD, PAL.paper)
  text.draw(fictionName(def.id), px + 8, py + 6, { size: 12, bold: true, color: PAL.ink })
  text.draw(def.kind === 'spell' ? `法术 · ${def.cost}费` : `${def.basePoints}点 · ${def.cost}费`, px + 8, py + 22, { size: 10, color: PAL.wood1 })
  text.paragraph(def.text, px + 8, py + 36, w - 16, { size: 10, color: PAL.ink2, lineHeight: 14 })
}
