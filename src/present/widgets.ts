import { PAL, rgba, SCHOOL_COLOR } from '../pixel/palette'
import { ASSETS } from '../pixel/assets'
import { blit } from '../pixel/dsl'
import { cardFrame, pxRoundRect, panel } from '../pixel/ui'
import type { TextLayer } from '../pixel/text'
import type { CardDef } from '../content/cards'
import { emphasizeKeywords, fictionName, keywordTips, KIND_NAME, RARITY_NAME, STATUS_NAME } from './fiction'

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
  text.draw(sub, x + 4, y + h - 14, { size: 9, color: PAL.wood1, maxWidth: Math.max(16, w - 8 - def.cost * 9) })
  drawCostGems(g, def.cost, x + w - 4, y + h - 15, opt.dim)
}

/** 卡盒里的牌面：上面名字，中间卡面，下面效果。金边表示已在牌组。 */
export function drawFaceCard(
  g: G,
  text: TextLayer,
  def: CardDef,
  x: number,
  y: number,
  w: number,
  h: number,
  opt: { inDeck?: boolean; negative?: boolean; bonus?: number } = {},
): void {
  const edge = opt.negative ? PAL.fruR : edgeOf(def)
  cardFrame(g, x, y, w, h, edge, PAL.paper, { selected: opt.inDeck })
  const name = `${fictionName(def.id)}${opt.bonus ? `+${opt.bonus}` : ''}`
  text.draw(name, x + w / 2, y + 4, { size: 11, align: 'center', bold: true, color: PAL.ink, maxWidth: w - 10 })
  const icon = ASSETS.card(def.id)
  blit(g, icon, x + Math.round((w - icon.width) / 2), y + 18, 1)
  const lines = text.wrapRich(emphasizeKeywords(def.text), w - 10, 8)
  const max = 3
  const shown = lines.slice(0, max)
  if (lines.length > max && shown.length) {
    const plain = shown[max - 1].replace(/\*\*/g, '')
    shown[max - 1] = `${plain.slice(0, Math.max(0, plain.length - 1))}…`
  }
  shown.forEach((ln, i) => text.rich(ln, x + 5, y + 46 + i * 12, { size: 8, color: PAL.ink2, hl: PAL.blueD }))
}

function drawCostGems(g: G, cost: number, right: number, y: number, dim?: boolean): void {
  if (cost <= 0) return
  const gem = ASSETS.icon('icon.occupy', 8, 8)
  g.save()
  if (dim) g.globalAlpha *= 0.45
  for (let i = 0; i < cost; i++) blit(g, gem, right - (cost - i) * 9, y)
  g.restore()
}

const STATUS_ICON: Record<string, string> = {
  sealed: 'icon.seal',
  marked: 'icon.marked',
  vulnerable: 'icon.vulnerable',
  protected: 'icon.protected',
  rebirth: 'icon.rebirth',
}

export function drawStatuses(g: G, statuses: string[], x: number, y: number): void {
  statuses.forEach((st, i) => {
    const id = STATUS_ICON[st]
    if (!id) return
    blit(g, ASSETS.icon(id, 16, 16), x + i * 14, y)
  })
}

export function drawBoardToken(
  g: G,
  text: TextLayer,
  def: CardDef,
  x: number,
  y: number,
  size: number,
  opt: { points: number; sealed?: boolean; player?: boolean; selected?: boolean; statuses?: string[]; hidePoints?: boolean },
): void {
  const edge = opt.player ? PAL.fruG : PAL.fruR
  cardFrame(g, x, y, size, size, edge, PAL.paper, { selected: opt.selected, dim: opt.sealed })
  const icon = ASSETS.card(def.id)
  blit(g, icon, x + Math.round((size - icon.width) / 2), y + 4)
  if (!opt.hidePoints) {
    text.draw(String(opt.points), x + size / 2, y + size - 14, {
      size: 14, align: 'center', bold: true, color: opt.player ? PAL.fruG : PAL.fruR, stroke: PAL.ink, strokeWidth: 3,
    })
  }
  const sts = opt.statuses ?? (opt.sealed ? ['sealed'] : [])
  if (sts.length) drawStatuses(g, sts, x + 2, y + 2)
}

/** 缠布血条：红从左渗到右，不要爱心。 */
export function drawHpBar(g: G, text: TextLayer, x: number, y: number, w: number, hp: number, max: number, opt: { stroke?: string } = {}): void {
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
  text.draw(`${hp}/${max}`, x + w + 6, y - 1, {
    size: 10, color: PAL.cream, stroke: opt.stroke, strokeWidth: opt.stroke ? 3 : undefined,
  })
}

function mixWrap(hex: string, a: number): string {
  return rgba(hex, a)
}

export function drawWoundChip(g: G, text: TextLayer, x: number, y: number, wound: number): void {
  pxRoundRect(g, x, y, 72, 16, rgba(PAL.lamp3, 0.85), 2)
  text.draw(`代价预估 ${wound}`, x + 36, y + 8, { size: 10, align: 'center', baseline: 'middle', color: PAL.cream, bold: true })
}

export interface InspectBits {
  def: CardDef
  currentPoints?: number
  statuses?: string[]
  owner?: string
}

function inspectBody(bits: InspectBits): string {
  return emphasizeKeywords(bits.def.text)
}

function glossaryLines(text: TextLayer, bits: InspectBits, w: number): string[] {
  const extra = (bits.statuses ?? []).map((s) => STATUS_NAME[s] ?? '').filter(Boolean)
  const tips = keywordTips(bits.def.text, extra)
  if (!tips.length) return []
  const lines = ['词条']
  for (const tip of tips) lines.push(...text.wrap(`${tip.name}：${tip.text}`, w - 16, 10))
  return lines
}

export function inspectHeight(text: TextLayer, bits: InspectBits, w: number): number {
  const lines = text.wrap(inspectBody(bits).replace(/\*\*/g, ''), w - 16, 10)
  const gloss = glossaryLines(text, bits, w)
  return 50 + lines.length * 14 + (bits.statuses?.length ? 18 : 0) + (gloss.length ? 4 + gloss.length * 13 : 0)
}

/** 固定位置的卡牌说明。先 occlude 再画，避免邻卡文字穿帮。 */
export function drawInspectPanel(
  g: G,
  text: TextLayer,
  bits: InspectBits,
  x: number,
  y: number,
  w: number,
  h?: number,
): { w: number; h: number } {
  const body = inspectBody(bits)
  const hh = h ?? inspectHeight(text, bits, w)
  text.occlude(x, y, w, hh)
  panel(g, x, y, w, hh, 'paper')
  text.draw(fictionName(bits.def.id), x + 8, y + 6, { size: 12, bold: true, color: PAL.ink, maxWidth: w - 16 })
  const pts = bits.currentPoints ?? bits.def.basePoints
  const kind = KIND_NAME[bits.def.kind] ?? bits.def.kind
  const rare = RARITY_NAME[bits.def.rarity] ?? ''
  const ptsLine = bits.def.kind === 'spell' ? `${kind} · ${bits.def.cost}费 · ${rare}` : `${kind} · ${pts}点 · ${bits.def.cost}费 · ${rare}`
  text.draw(ptsLine, x + 8, y + 22, { size: 10, color: PAL.wood1, maxWidth: w - 16 })
  let ty = y + 38
  if (bits.statuses?.length) {
    drawStatuses(g, bits.statuses, x + 8, ty)
    text.draw(bits.statuses.map((s) => STATUS_NAME[s] ?? s).join(' · '), x + 8 + bits.statuses.length * 14 + 4, ty + 1, {
      size: 10, color: PAL.ink2,
    })
    ty += 18
  }
  const bodyLines = text.paragraph(body, x + 8, ty, w - 16, { size: 10, color: PAL.ink2, hl: PAL.blueD, lineHeight: 14 })
  ty += bodyLines * 14 + 4
  const gloss = glossaryLines(text, bits, w)
  gloss.forEach((ln, i) => {
    if (ty + i * 13 > y + hh - 12) return
    text.draw(ln, x + 8, ty + i * 13, {
      size: 10,
      color: i === 0 ? PAL.wood1 : PAL.ink2,
      bold: i === 0,
      maxWidth: w - 16,
    })
  })
  return { w, h: hh }
}

/** 浮动说明：夹在屏幕内，并挡住被盖住的字。 */
export function drawTooltip(g: G, text: TextLayer, def: CardDef, x: number, y: number, extra: Omit<InspectBits, 'def'> = {}): void {
  const bits = { def, ...extra }
  const w = 208
  const h = inspectHeight(text, bits, w)
  let px = x, py = y
  if (px + w > 632) px = 632 - w
  if (py + h > 352) py = 352 - h
  if (px < 8) px = 8
  if (py < 8) py = 8
  drawInspectPanel(g, text, bits, px, py, w, h)
}

export function drawHint(g: G, text: TextLayer, title: string, body: string, x: number, y: number, w = 200): void {
  const lines = text.wrap(body, w - 16, 10)
  const h = 28 + lines.length * 14
  let px = x, py = y
  if (px + w > 632) px = 632 - w
  if (py + h > 352) py = 352 - h
  if (px < 8) px = 8
  if (py < 8) py = 8
  text.occlude(px, py, w, h)
  panel(g, px, py, w, h, 'paper')
  text.draw(title, px + 8, py + 6, { size: 12, bold: true, color: PAL.ink })
  text.paragraph(body, px + 8, py + 22, w - 16, { size: 10, color: PAL.ink2, lineHeight: 14 })
}
