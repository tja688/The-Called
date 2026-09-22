/**
 * 锈门层石室 + 九宫格。动画只跟事件走；读模型只用于合法格 / 预览 / HUD 对齐。
 */
import { Scene } from '../Scene'
import type { DomainEvent } from '../../core/messages'
import type { BattleEvent } from '../../domain/battle/events'
import type { Cell } from '../../domain/geometry'
import type { TextLayer } from '../../pixel/text'
import { PAL, rgba } from '../../pixel/palette'
import { ASSETS } from '../../pixel/assets'
import { bakeTable } from '../../pixel/terrain'
import { Scenery, roomOfEncounter } from '../../pixel/scenery'
import { cardFrame, pxRoundRect, pxFrame, dashedLine, bannerBg, panel } from '../../pixel/ui'
import { drawSprite, blit } from '../../pixel/dsl'
import { tween, wait, ease, osc, clamp, type Ease } from '../../pixel/tween'
import { cardDef } from '../../content/cards'
import { encounterDef } from '../../content/encounters'
import { fictionName, avatarSpriteId } from '../fiction'
import { audio } from '../../audio/audio'
import { BATTLE, TOPBAR_H, INSPECT, PILES, W, H, PANEL } from '../layout'
import { drawHandCard, drawBoardToken, drawHpBar, drawWoundChip, drawInspectPanel, drawStatuses, drawHint, drawFaceCard, drawTooltip } from '../widgets'
import type { LegalPlay } from '../../domain/battle/BattleAggregate'
import { mapEffectDef } from '../../content/mapEffects'
import type { Cause } from '../../domain/battle/events'
import { drawSparks, sfxForKind, statusWord, strikeKind, type Spark, type SparkKind } from './battleFx'
import { BattleLog } from './battleLog'

type BE<T extends BattleEvent['type']> = Extract<BattleEvent, { type: T }>
type G = CanvasRenderingContext2D

interface Actor {
  id: string
  defId: string
  owner: 'player' | 'enemy'
  kind: 'occupy' | 'spell' | 'avatar'
  isAvatar: boolean
  x: number
  y: number
  sx: number
  sy: number
  alpha: number
  scale: number
  lift: number
  glow: number
  flash: number
  ox: number
  oy: number
  zone: 'hand' | 'board' | 'fly' | 'gone'
  /** tl 是手牌左上角，mid 是战场或牌堆的中心。 */
  anchor: 'tl' | 'mid'
  cell?: Cell
  points: number
  sealed: boolean
  statuses: string[]
  z: number
}

interface Floater { x: number; y: number; text: string; color: string; t: number; life: number }
interface Drip { x: number; y: number; t: number }

const CELL_POS = (cell: number) => {
  const c = (cell - 1) % 3, r = Math.floor((cell - 1) / 3)
  return { x: BATTLE.gridX + c * (BATTLE.cell + BATTLE.gap), y: BATTLE.gridY + r * (BATTLE.cell + BATTLE.gap) }
}
const cellCenter = (cell: number) => {
  const p = CELL_POS(cell)
  return { x: p.x + BATTLE.cell / 2, y: p.y + BATTLE.cell / 2 }
}
/** 演出时长。上一轮是 3。这轮整体快一倍，所以是 1.5。空格快进仍走 tween.speed。 */
const PACE = 1.5
/** 抽牌比上一轮快 2.5 倍。 */
const DRAW_PACE = 1.2
function pileCenter(r: { x: number; y: number; w: number; h: number }) {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}
function tableOf(id: string) {
  return roomOfEncounter(id)
}

export class BattleScene extends Scene {
  readonly name = 'battle' as const
  private actors = new Map<string, Actor>()
  private hand: string[] = []
  private selected: string | null = null
  private mana = 0
  private manaCap = 0
  private turn = 1
  private phase: 'play' | 'over' = 'play'
  private wound = 0
  private encounterId = 'MON.N01'
  private table: HTMLCanvasElement | null = null
  private scenery = new Scenery('corridor')
  private t = 0
  private floaters: Floater[] = []
  private sparks: Spark[] = []
  private drips: Drip[] = []
  private result: BE<'battle.settled'> | null = null
  private log = new BattleLog()
  /** 本张卡这一时机是否已经播过带因果的后果。effectResolved 时清掉。 */
  private beatLanded = false
  private drew = false
  private usedActive = false
  private lastCast: { x: number; y: number; defId: string } | null = null
  private pendingSetup: { cell: Cell; defId: string; current: number }[] = []
  private zc = 0
  private pickedTarget: string | null = null
  private activateAim = false
  private lockLines: { x1: number; y1: number; x2: number; y2: number; t: number }[] = []
  private deckOpen = false
  private deckPage = 0

  enter(): void {
    const v = this.app.ask({ type: 'battle.view' })
    if (!v) return
    this.encounterId = v.encounterId
    this.scenery = new Scenery(roomOfEncounter(v.encounterId))
    this.table = bakeTable(tableOf(v.encounterId))
    this.wound = v.avatar.avatarCost
    this.mana = v.occupy
    this.manaCap = v.occupyCap
    this.turn = v.turn
    this.phase = v.phase
    audio.atmosphere(v.encounterId)
  }

  exit(): void {
    audio.atmosphere(null)
  }

  update(dt: number): void {
    this.t += dt
    for (const a of this.actors.values()) {
      a.flash = Math.max(0, a.flash - (dt * 3) / PACE)
      a.glow = Math.max(0, a.glow - (dt * 2.4) / PACE)
    }
    this.floaters = this.floaters.filter((f) => (f.t += dt) < f.life)
    this.sparks = this.sparks.filter((s) => (s.t += dt) < s.life)
    this.drips = this.drips.filter((d) => (d.t += dt) < 0.55 * PACE)
    this.lockLines = this.lockLines.filter((l) => (l.t -= dt) > 0)
  }

  async handle(e: DomainEvent): Promise<void> {
    if (!e.type.startsWith('battle.')) return
    const ev = e as BattleEvent
    this.log.push(ev)
    this.beginBeat()
    switch (ev.type) {
      case 'battle.started': await this.onStart(ev); break
      case 'battle.avatarDealt': await this.onDealt(ev); break
      case 'battle.cardDrawn': await this.onDrawn(ev); break
      case 'battle.turnStarted': await this.onTurn(ev); break
      case 'battle.phaseChanged': await this.onPhase(ev); break
      case 'battle.occupyChanged': await this.onMana(ev); break
      case 'battle.resourceChanged': await this.onResource(ev); break
      case 'battle.effectResolved': await this.onEffect(ev); break
      case 'battle.activated': await this.onActivated(ev); break
      case 'battle.cardPlayed': await this.onPlayed(ev); break
      case 'battle.cardCovered': await this.onCovered(ev); break
      case 'battle.cardEntered': await this.onEntered(ev); break
      case 'battle.cardRemoved': await this.onRemoved(ev); break
      case 'battle.pointsChanged': await this.onPoints(ev); break
      case 'battle.statusAdded': await this.onStatus(ev, true); break
      case 'battle.statusRemoved': await this.onStatus(ev, false); break
      case 'battle.settled': await this.onSettled(ev); break
    }
  }

  /** 下一条后果开始前，清掉上一条还挂着的飘字和火花。 */
  private beginBeat(): void {
    this.floaters = []
    this.sparks = []
  }

  private async beat(sec: number, pace = PACE): Promise<void> {
    await wait(sec * pace)
  }

  private glide(obj: object, to: Record<string, number>, sec: number, e: Ease = ease.outQuad, pace = PACE): Promise<void> {
    return tween(obj, to, sec * pace, e)
  }

  private async banner(title: string, sub: string, hold: number, color: string): Promise<void> {
    await this.app.showBanner(title, sub, hold * PACE, color)
  }

  /** 手牌坐标是左上角。飞去战场或牌堆之前，改成图像中心。 */
  private asMid(a: Actor): void {
    if (a.anchor === 'tl') {
      a.x += BATTLE.cardW / 2
      a.y += BATTLE.cardH / 2
      a.anchor = 'mid'
    }
  }

  private makeActor(id: string, defId: string, owner: Actor['owner'], x: number, y: number): Actor {
    const def = cardDef(defId)
    const a: Actor = {
      id, defId, owner, kind: def.kind, isAvatar: def.kind === 'avatar',
      x, y, sx: 1, sy: 1, alpha: 1, scale: 1, lift: 0, glow: 0, flash: 0, ox: 0, oy: 0,
      zone: 'fly', anchor: 'mid', points: def.basePoints, sealed: false, statuses: [], z: this.zc++,
    }
    this.actors.set(id, a)
    return a
  }

  private handSlot(i: number, n: number): { x: number; y: number } {
    const left = BATTLE.handLeft, right = BATTLE.handRight
    const avail = right - left - BATTLE.cardW
    const step = n <= 1 ? 0 : Math.min(BATTLE.cardW + 6, avail / Math.max(1, n - 1))
    const total = step * Math.max(0, n - 1) + BATTLE.cardW
    const x0 = left + (avail + BATTLE.cardW - total) / 2
    return { x: Math.round(x0 + i * step), y: BATTLE.handY + 6 }
  }

  private async layoutHand(pace = PACE): Promise<void> {
    await Promise.all(this.hand.map(async (id, i) => {
      const a = this.actors.get(id)
      if (!a || a.zone === 'gone') return
      const p = this.handSlot(i, this.hand.length)
      const arriving = a.zone !== 'hand'
      a.z = 100 + i
      a.anchor = 'tl'
      await this.glide(a, { x: p.x, y: p.y, alpha: 1, scale: 1 }, arriving ? 0.32 : 0.14, ease.outQuad, pace)
      a.zone = 'hand'
    }))
  }

  /** 牌面中心飞进牌堆中心，再缩进堆里。 */
  private async flyToPile(a: Actor, pile: { x: number; y: number; w: number; h: number }): Promise<void> {
    const to = pileCenter(pile)
    this.asMid(a)
    a.zone = 'fly'
    a.alpha = 1
    a.z = 400
    await this.glide(a, { x: to.x, y: to.y, scale: 0.42, alpha: 1 }, 0.22, ease.inOutQuad)
    await this.glide(a, { alpha: 0, scale: 0.14 }, 0.08, ease.inQuad)
    a.zone = 'gone'
  }

  /** 同一时刻只留这一条字，等它读完再往下。 */
  private async caption(p: { x: number; y: number } | undefined, text: string, color: string, sec = 0.18): Promise<void> {
    const d = sec * PACE
    this.floaters = []
    const at = p ?? { x: 320, y: 150 }
    this.floaters.push({ x: at.x, y: at.y - 12, text, color, t: 0, life: d + 0.08 })
    await wait(d)
    this.floaters = []
  }

  private spark(kind: SparkKind, p: { x: number; y: number } | undefined, life = 0.22): Spark {
    const s: Spark = { kind, x: p?.x ?? 320, y: p?.y ?? 160, t: 0, life: life * PACE }
    this.sparks.push(s)
    return s
  }

  private noteCause(cause?: Cause): void {
    if (cause) this.beatLanded = true
  }

  private actorAt(id: string | undefined): Actor | undefined {
    return id ? this.actors.get(id) : undefined
  }

  private spot(a: Actor | undefined, fallback?: { x: number; y: number }): { x: number; y: number } {
    if (a) return { x: a.x + a.ox, y: a.y + a.oy - 8 }
    return fallback ?? { x: 320, y: 160 }
  }

  private async lunge(a: Actor, toward: { x: number; y: number }, dist = 12): Promise<void> {
    const dx = toward.x - a.x
    const dy = toward.y - a.y
    const len = Math.hypot(dx, dy) || 1
    await this.glide(a, { ox: (dx / len) * dist, oy: (dy / len) * dist, sx: 1.18, sy: 0.84 }, 0.07, ease.outQuad)
    await this.glide(a, { ox: 0, oy: 0, sx: 1, sy: 1 }, 0.08, ease.outQuad)
  }

  private async flinch(a: Actor): Promise<void> {
    a.flash = 1
    await this.glide(a, { sx: 0.82, sy: 1.16, ox: 4 }, 0.05, ease.outQuad)
    await this.glide(a, { sx: 1, sy: 1, ox: 0 }, 0.07, ease.outQuad)
  }

  private async pulse(a: Actor): Promise<void> {
    a.glow = 1
    await this.glide(a, { sx: 1.16, sy: 0.88 }, 0.06, ease.outQuad)
    await this.glide(a, { sx: 1, sy: 1 }, 0.08, ease.outBack)
  }

  private async onStart(ev: BE<'battle.started'>): Promise<void> {
    this.encounterId = ev.encounterId
    this.scenery = new Scenery(roomOfEncounter(ev.encounterId))
    this.table = bakeTable(tableOf(ev.encounterId))
    this.pendingSetup = ev.setup.map((s) => ({ ...s }))
    this.usedActive = false
    this.beatLanded = false
    this.drew = false
    this.result = null
    audio.atmosphere(ev.encounterId)
    const enc = encounterDef(ev.encounterId)
    await this.banner(fictionName(enc.id), ev.text.replace(/^[^。]+。/, ''), 0.7, enc.tier === 'boss' ? PAL.lamp2 : PAL.lamp1)
  }

  private async onDealt(ev: BE<'battle.avatarDealt'>): Promise<void> {
    const a = this.makeActor(ev.card, ev.defId, 'player', 300, 372)
    a.anchor = 'tl'
    a.scale = 0.8
    this.hand.push(ev.card)
    audio.sfx('draw')
    await this.layoutHand()
  }

  private async onDrawn(ev: BE<'battle.cardDrawn'>): Promise<void> {
    const a = this.makeActor(ev.card, ev.defId, 'player', PILES.draw.x, PILES.draw.y)
    a.anchor = 'tl'
    a.scale = 0.72
    this.hand.push(ev.card)
    this.drew = true
    audio.sfx('draw')
    await this.layoutHand(DRAW_PACE)
    await this.beat(0.06, DRAW_PACE)
  }

  private async onTurn(ev: BE<'battle.turnStarted'>): Promise<void> {
    this.turn = ev.turn
    for (const tm of ev.timers) {
      const a = this.actorAt(tm.card)
      const p = a ? this.spot(a) : { x: 320, y: 150 }
      if (a) a.glow = 1
      this.spark('fuse', p, 0.16)
      audio.sfx('pressure')
      await this.caption(p, `${fictionName(tm.defId)} 引信 ${tm.left}`, PAL.lamp2, 0.12)
    }
    if (ev.won) {
      audio.sfx('lead')
      await this.banner('总点数更大', '称重通过', 0.7, PAL.lamp1)
      return
    }
    if (!ev.opening) await this.beat(0.06)
  }

  private async onPhase(ev: BE<'battle.phaseChanged'>): Promise<void> {
    this.phase = ev.phase
  }

  private async onEffect(ev: BE<'battle.effectResolved'>): Promise<void> {
    if (ev.hit) await this.slotResolveHit(ev)
    else await this.slotResolveMiss(ev)
    this.beatLanded = false
    this.drew = false
  }

  private async slotResolveHit(ev: BE<'battle.effectResolved'>): Promise<void> {
    const a = this.actorAt(ev.card)
    if (a) a.glow = 1
    await this.beat(this.beatLanded ? 0.14 : 0.18)
  }

  private async slotResolveMiss(ev: BE<'battle.effectResolved'>): Promise<void> {
    if (this.drew) {
      await this.beat(0.04)
      return
    }
    const a = this.actorAt(ev.card)
    const p = a ? this.spot(a) : (ev.cell ? cellCenter(ev.cell) : { x: 320, y: 150 })
    this.spark('whiff', p, 0.12)
    audio.sfx('whiff')
    await this.caption(p, `${fictionName(ev.defId)} 落空`, PAL.gray3, 0.12)
  }

  private async onMana(ev: BE<'battle.occupyChanged'>): Promise<void> {
    const prev = this.mana
    const prevCap = this.manaCap
    this.mana = ev.current
    this.manaCap = ev.cap
    if (ev.cause?.timing === 'enter') {
      this.noteCause(ev.cause)
      audio.sfx('mana')
      await this.caption({ x: 180, y: 48 }, `${fictionName(ev.cause.defId)} 入场 +1`, PAL.sta, 0.14)
      return
    }
    const refill = !ev.cause && (ev.current > prev || ev.cap > prevCap) && (ev.current > 0 || ev.cap > 0)
    if (refill) {
      audio.sfx('mana')
      await this.caption({ x: 180, y: 48 }, `费用 ${ev.current}/${ev.cap}`, PAL.lamp1, 0.12)
      return
    }
    if (ev.current !== prev || ev.cap !== prevCap) await this.beat(0.04)
  }

  private async onResource(ev: BE<'battle.resourceChanged'>): Promise<void> {
    this.noteCause(ev.cause)
    const who = ev.cause ? fictionName(ev.cause.defId) : fictionName('RES.A')
    audio.sfx(ev.current > 0 ? 'buff' : 'click')
    await this.caption({ x: 220, y: 48 }, `${who} ${fictionName('RES.A')} ${ev.current}`, PAL.gold, 0.1)
  }

  private async onActivated(ev: BE<'battle.activated'>): Promise<void> {
    this.usedActive = true
    const a = this.actorAt(ev.card)
    audio.sfx('play')
    if (a) await this.pulse(a)
    await this.caption(a ? this.spot(a) : { x: 320, y: 150 }, `${fictionName(ev.defId)} 主动`, PAL.lamp1, 0.16)
  }

  private async onPlayed(ev: BE<'battle.cardPlayed'>): Promise<void> {
    const a = this.actors.get(ev.card)
    this.selected = null
    this.hand = this.hand.filter((id) => id !== ev.card)
    audio.sfx('play')
    if (!a) return
    this.asMid(a)
    if (ev.kind === 'spell') {
      this.lastCast = { x: a.x, y: a.y, defId: ev.defId }
      if (cardDef(ev.defId).burn) {
        a.zone = 'fly'
        a.z = 400
        audio.sfx('banish')
        await this.glide(a, { scale: 1.2, alpha: 0, y: a.y - 10 }, 0.16, ease.inQuad)
        a.zone = 'gone'
      } else {
        await this.flyToPile(a, PILES.discard)
      }
      await this.layoutHand()
      return
    }
    a.lift = 8
    a.zone = 'fly'
    await this.glide(a, { lift: 0 }, 0.1, ease.outQuad)
  }

  private async onCovered(ev: BE<'battle.cardCovered'>): Promise<void> {
    const v = this.actors.get(ev.victim)
    const by = this.actors.get(ev.by)
    const c = cellCenter(ev.cell)
    audio.sfx('cover')
    this.spark('boom', c, 0.2)
    if (by && !ev.tied) by.points = Math.max(0, by.points - ev.victimPoints)
    const word = ev.tied ? '平点' : `压住 -${ev.victimPoints}`
    if (v) {
      v.glow = 1
      await this.glide(v, { sy: 0.2, sx: 1.35, alpha: 0.35 }, 0.16, ease.inQuad)
    }
    await this.caption(c, word, PAL.lamp3, 0.14)
  }

  private async onEntered(ev: BE<'battle.cardEntered'>): Promise<void> {
    if (ev.motion === 'move') {
      await this.slotMove(ev)
      return
    }
    await this.slotPlace(ev)
  }

  private async slotPlace(ev: BE<'battle.cardEntered'>): Promise<void> {
    this.noteCause(ev.cause)
    let a = this.actors.get(ev.card)
    const dest = cellCenter(ev.cell)
    if (!a) {
      const slot = this.pendingSetup.find((s) => s.cell === ev.cell)
      const view = this.app.ask({ type: 'battle.view' })
      const inst = view?.cards[ev.card]
      const defId = slot?.defId ?? inst?.defId ?? ev.cause?.defId ?? 'EC.01'
      const owner = inst?.owner ?? (defId.startsWith('EC.') ? 'enemy' : 'player')
      a = this.makeActor(ev.card, defId, owner, dest.x, dest.y - 36)
      a.alpha = 0
      if (slot) a.points = slot.current
      if (slot) this.pendingSetup = this.pendingSetup.filter((s) => s !== slot)
    }
    this.hand = this.hand.filter((id) => id !== ev.card)
    this.asMid(a)
    a.cell = ev.cell
    a.zone = 'fly'
    const who = fictionName(ev.cause?.defId ?? a.defId)
    audio.sfx(a.defId === 'EC.03' ? 'buff' : 'play')
    await this.glide(a, { x: dest.x, y: dest.y, alpha: 1, scale: 1, sx: 1.2, sy: 0.75 }, 0.16, ease.outQuad)
    a.zone = 'board'
    await this.glide(a, { sx: 1, sy: 1 }, 0.1, ease.outBack)
    if (ev.covered) await this.caption(dest, `${who} 落地`, PAL.lamp2, 0.1)
    else if (ev.cause) await this.caption(dest, `${who} 落地`, PAL.cream, 0.1)
    await this.layoutHand()
  }

  private async slotMove(ev: BE<'battle.cardEntered'>): Promise<void> {
    this.noteCause(ev.cause)
    const dest = cellCenter(ev.cell)
    const from = ev.from ? cellCenter(ev.from) : dest
    let a = this.actors.get(ev.card)
    if (!a) {
      const view = this.app.ask({ type: 'battle.view' })
      const inst = view?.cards[ev.card]
      a = this.makeActor(ev.card, inst?.defId ?? ev.cause?.defId ?? 'EC.01', inst?.owner ?? 'enemy', from.x, from.y)
    }
    a.x = from.x
    a.y = from.y
    a.cell = ev.cell
    a.zone = 'fly'
    const ogre = a.defId === 'EC.01'
    const skel = a.defId === 'EC.07' || a.defId === 'EC.05'
    audio.sfx(ogre ? 'step' : 'play')
    if (ogre) this.spark('club', from, 0.16)
    await this.glide(a, { x: dest.x, y: dest.y, sx: ogre ? 1.28 : skel ? 1.05 : 1.12, sy: ogre ? 0.72 : 0.9 }, 0.14, ease.outQuad)
    a.zone = 'board'
    await this.glide(a, { sx: 1, sy: 1 }, 0.08, ease.outBack)
    if (ogre) this.app.shake = 3
    await this.caption(dest, `${fictionName(a.defId)} →${ev.cell}`, PAL.cream, 0.1)
  }

  private async onRemoved(ev: BE<'battle.cardRemoved'>): Promise<void> {
    this.noteCause(ev.cause)
    let a = this.actors.get(ev.card)
    const c = a ? this.spot(a) : cellCenter(ev.cell)
    const who = fictionName(ev.cause?.defId ?? ev.defId)
    if (ev.to !== 'hand') this.hand = this.hand.filter((id) => id !== ev.card)
    if (ev.to === 'hand' && a) {
      if (a.anchor === 'mid') {
        a.x -= BATTLE.cardW / 2
        a.y -= BATTLE.cardH / 2
      }
      a.anchor = 'tl'
      a.cell = undefined
      a.zone = 'fly'
      a.alpha = 1
      a.scale = 1
      if (!this.hand.includes(a.id)) this.hand.push(a.id)
      audio.sfx('draw')
      await this.layoutHand()
      await this.caption(c, `${who} 回手`, PAL.cream, 0.12)
      return
    }
    if (!a && (ev.to === 'discard' || ev.to === 'deck')) {
      const owner = ev.defId.startsWith('EC.') ? 'enemy' : 'player'
      const from = pileCenter(owner === 'enemy' ? PILES.enemy : PILES.draw)
      a = this.makeActor(ev.card, ev.defId, owner, from.x, from.y)
      a.scale = 0.55
      a.zone = 'fly'
    }
    if (a && (a.isAvatar || ev.to === 'gone')) {
      audio.sfx('banish')
      a.flash = 1
      a.zone = 'fly'
      this.spark('boom', c, 0.2)
      await this.glide(a, { scale: 1.4, alpha: 0, sy: 0.2 }, 0.2, ease.inQuad)
    } else if (a) {
      const pile = ev.to === 'deck' ? PILES.draw : (a.owner === 'enemy' ? PILES.enemy : PILES.discard)
      audio.sfx('play')
      await this.flyToPile(a, pile)
    }
    if (a) a.zone = 'gone'
    const word = ev.reason === 'tie' ? '平点离场' : ev.to === 'hand' ? '回手' : ev.to === 'deck' ? '洗回牌组' : ev.to === 'gone' ? '驱离' : '进弃牌堆'
    await this.caption(c, `${who} ${word}`, PAL.gray3, 0.12)
  }

  private async onPoints(ev: BE<'battle.pointsChanged'>): Promise<void> {
    this.noteCause(ev.cause)
    if (ev.source === 'aura' || ev.source === 'map') {
      await this.slotRecalc(ev)
      return
    }
    await this.slotStrike(ev)
  }

  private async slotRecalc(ev: BE<'battle.pointsChanged'>): Promise<void> {
    const target = this.actorAt(ev.card)
    const net = ev.after - ev.before
    if (target) target.points = ev.after
    const share = ev.auras?.find((a) => a.n !== 0)
    const src = share ? this.actorAt(share.card) : undefined
    if (src && src.id !== target?.id) src.glow = 1
    const label = ev.mapEffect ? fictionName(ev.mapEffect) : share ? fictionName(share.defId) : (ev.source === 'map' ? '地图' : '驻场')
    this.spark('link', target ? this.spot(target) : { x: 320, y: 150 }, 0.16)
    audio.sfx(net >= 0 ? 'buff' : 'hurt')
    await this.caption(target ? this.spot(target) : undefined, `${label} ${net > 0 ? '+' : ''}${net}`, net >= 0 ? PAL.sta : PAL.fruR, 0.16)
    if (src) src.glow = 0
  }

  private async slotStrike(ev: BE<'battle.pointsChanged'>): Promise<void> {
    const target = this.actorAt(ev.card)
    const actor = ev.cause ? this.actorAt(ev.cause.actor) : undefined
    const net = ev.after - ev.before
    const bonus = ev.vulnerableBonus ?? 0
    const kind = strikeKind(ev.cause?.defId, ev.cause?.op)
    const name = ev.cause ? fictionName(ev.cause.defId) : ''
    const p = target ? this.spot(target) : { x: 320, y: 150 }
    let flew = false
    if (actor && actor.zone !== 'gone' && actor.id !== ev.card) {
      await this.lunge(actor, target ? { x: target.x, y: target.y } : p, kind === 'club' ? 16 : 12)
    } else if (kind === 'arrow' && this.lastCast && target) {
      const bolt = this.spark('arrow', this.lastCast, 0.28)
      await this.glide(bolt, { x: target.x, y: target.y - 8 }, 0.1, ease.outQuad)
      flew = true
    } else if (target && (actor?.id === ev.card || !actor)) {
      await this.pulse(target)
    }
    if (kind === 'club') this.app.shake = 4
    if (!flew) this.spark(kind, p, 0.2)
    audio.sfx(sfxForKind(kind))
    if (bonus > 0 && net < 0) {
      const base = net + bonus
      if (target) target.points = ev.before + base
      await this.caption(p, `${name} ${base}`, PAL.fruR, 0.14)
      this.spark('mark', { x: p.x + 8, y: p.y - 6 }, 0.16)
      if (target) {
        target.points = ev.after
        await this.flinch(target)
      }
      await this.caption(p, `易伤 -${bonus}`, PAL.sig, 0.14)
    } else {
      if (target) target.points = ev.after
      const sign = net > 0 ? `+${net}` : `${net}`
      await this.caption(p, name ? `${name} ${sign}` : sign, net >= 0 ? PAL.sta : PAL.fruR, 0.2)
      if (target && net < 0) await this.flinch(target)
    }
    if (target?.isAvatar && net < 0) {
      audio.sfx('hurt')
      this.drips.push({ x: target.x, y: target.y - 20, t: 0 })
    }
  }

  private async onStatus(ev: BE<'battle.statusAdded'> | BE<'battle.statusRemoved'>, add: boolean): Promise<void> {
    this.noteCause(ev.cause)
    const a = this.actorAt(ev.card)
    if (a) {
      if (add) {
        if (!a.statuses.includes(ev.status)) a.statuses.push(ev.status)
      } else {
        a.statuses = a.statuses.filter((s) => s !== ev.status)
      }
      if (ev.status === 'sealed') a.sealed = add
    }
    if (!add && ev.status === 'protected') {
      await this.slotGuard(ev)
      return
    }
    if (ev.status === 'marked') {
      await this.slotMark(ev, add)
      return
    }
    await this.slotStatus(ev, add)
  }

  private async slotMark(ev: BE<'battle.statusAdded'> | BE<'battle.statusRemoved'>, add: boolean): Promise<void> {
    const target = this.actorAt(ev.card)
    const actor = ev.cause ? this.actorAt(ev.cause.actor) : undefined
    const p = target ? this.spot(target) : { x: 320, y: 150 }
    const name = ev.cause ? fictionName(ev.cause.defId) : ''
    if (add && actor && actor.zone !== 'gone' && actor.id !== ev.card) {
      await this.lunge(actor, target ? { x: target.x, y: target.y } : p, ev.cause?.defId === 'PC.A01' ? 14 : 10)
    }
    this.spark(add ? 'paw' : 'whiff', p, 0.2)
    audio.sfx(add ? 'mark' : 'whiff')
    if (target && add) target.glow = 1
    const mark = fictionName('MK.A')
    await this.caption(p, add ? `${name} ${mark}` : `${name} ${mark}消失`, add ? PAL.gold : PAL.gray3, 0.2)
  }

  private async slotGuard(ev: BE<'battle.statusAdded'> | BE<'battle.statusRemoved'>): Promise<void> {
    const target = this.actorAt(ev.card)
    const p = target ? this.spot(target) : { x: 320, y: 150 }
    const name = ev.cause ? fictionName(ev.cause.defId) : ''
    this.spark('shield', p, 0.22)
    audio.sfx('seal')
    if (target) await this.pulse(target)
    await this.caption(p, `${name} 挡住`, PAL.dai, 0.16)
  }

  private async slotStatus(ev: BE<'battle.statusAdded'> | BE<'battle.statusRemoved'>, add: boolean): Promise<void> {
    const target = this.actorAt(ev.card)
    const p = target ? this.spot(target) : { x: 320, y: 150 }
    const kind: SparkKind = ev.status === 'sealed' ? 'seal'
      : ev.status === 'vulnerable' ? 'mark'
      : ev.status === 'rebirth' ? 'buff'
      : 'shield'
    this.spark(kind, p, 0.18)
    audio.sfx(ev.status === 'rebirth' ? 'buff' : 'seal')
    if (target && add) await this.pulse(target)
    await this.caption(p, statusWord(ev.status, add), ev.status === 'vulnerable' ? PAL.sig : PAL.dai, 0.14)
  }

  private async onSettled(ev: BE<'battle.settled'>): Promise<void> {
    this.result = ev
    this.wound = ev.avatarCost
    this.phase = 'over'
    audio.sfx(ev.outcome === 'win' ? 'win' : 'lose')
    this.app.flashA = 0.4
    const why = ev.reason === 'lead' ? '称重' : ev.reason === 'clear' ? '清场' : ev.reason === 'avatarGone' ? '化身离场' : '无牌可出'
    await this.banner(ev.outcome === 'win' ? '胜利' : '失败', `${why} · 化身代价 ${ev.avatarCost}`, 0.9, ev.outcome === 'win' ? PAL.lamp1 : PAL.fruR)
  }

  render(world: G, ui: G, text: TextLayer): void {
    this.drawTable(world)
    this.drawGrid(world, ui, text)
    this.drawPiles(ui, text)
    this.drawActors(world, ui, text)
    this.drawFx(ui, text)
    this.drawHud(ui, text)
    this.drawHand(ui, text)
    this.drawDiscardPick(ui, text)
    this.drawInspect(ui, text)
    this.drawAimHint(ui, text)
    this.drawResult(ui, text)
    this.log.draw(ui, text, this.app.ui)
    this.drawDeckBrowse(ui, text)
  }

  private drawTable(g: G): void {
    this.scenery.drawBack(g, 0, this.t)
    if (this.table) g.drawImage(this.table, 0, BATTLE.tableY)
    this.scenery.drawFront(g, 0, this.t)
  }

  private legal(): LegalPlay[] {
    return this.app.busy ? [] : this.app.ask({ type: 'battle.legalPlays' })
  }

  private selectedPlay(): LegalPlay | undefined {
    return this.selected ? this.legal().find((p) => p.card === this.selected) : undefined
  }

  private drawGrid(g: G, ui: G, text: TextLayer): void {
    const play = this.selectedPlay()
    const view = this.app.ask({ type: 'battle.view' })
    for (let cell = 1; cell <= 9; cell++) {
      const p = CELL_POS(cell)
      const info = view?.cells[cell - 1]
      const legalCell = !!play?.cells.includes(cell as Cell)
      pxRoundRect(g, p.x, p.y, BATTLE.cell, BATTLE.cell, PAL.ink, 2)
      const floor = this.app.view()?.floorEffect
      const tile = info?.shadowActive ? PAL.slate : PAL.stone
      pxRoundRect(g, p.x + 1, p.y + 1, BATTLE.cell - 2, BATTLE.cell - 2, tile, 1)
      g.fillStyle = PAL.leaf
      g.fillRect(p.x + 3, p.y + BATTLE.cell - 4, 10, 1)
      if (floor === 'ME.02') {
        g.fillStyle = rgba(PAL.redD, 0.35)
        g.fillRect(p.x + 2, p.y + 2, BATTLE.cell - 4, BATTLE.cell - 4)
      }
      if (info?.corner) {
        g.fillStyle = rgba(PAL.leaf, floor === 'ME.03' ? 0.45 : 0.22)
        g.fillRect(p.x + 2, p.y + 2, BATTLE.cell - 4, BATTLE.cell - 4)
        if (floor === 'ME.03') {
          g.fillStyle = PAL.gray1
          g.fillRect(p.x + 4, p.y + BATTLE.cell - 10, 8, 6)
        }
      }
      if (legalCell) {
        pxFrame(g, p.x, p.y, BATTLE.cell, BATTLE.cell, PAL.lamp1, 2)
        g.fillStyle = rgba(PAL.lamp1, 0.12 + 0.08 * osc(this.t, 0.6))
        g.fillRect(p.x + 2, p.y + 2, BATTLE.cell - 4, BATTLE.cell - 4)
      }
      text.draw(String(cell), p.x + 5, p.y + 3, { size: 9, color: rgba(PAL.cream, 0.45) })
      if (!this.app.busy && this.selected && play) {
        const inst = info?.card ? view?.cards[info.card] : undefined
        const canTarget = !!(inst && play.targets.includes(inst.id))
        if (legalCell || canTarget) {
          this.app.ui.hit(`cell-${cell}`, { x: p.x, y: p.y, w: BATTLE.cell, h: BATTLE.cell }, () => {
            this.onCell(cell as Cell)
          }, 6)
        }
      }
    }
    for (const l of this.lockLines) dashedLine(g, l.x1, l.y1, l.x2, l.y2, PAL.fruR, 3, 2)
    void ui
  }

  private drawActors(g: G, ui: G, text: TextLayer): void {
    const inHand = new Set(this.hand)
    const list = [...this.actors.values()].filter((a) => a.zone !== 'gone' && !inHand.has(a.id)).sort((a, b) => a.z - b.z)
    const play = this.selectedPlay()
    const acts = this.activateAim ? this.app.ask({ type: 'battle.legalActivates' })[0] : undefined
    for (const a of list) {
      const x = a.x + a.ox, y = a.y + a.oy + a.lift
      const onBoard = a.zone === 'board' && a.cell != null
      const statuses = a.statuses.length ? a.statuses : (a.sealed ? ['sealed'] : [])
      const aimed = !!(play?.targets.includes(a.id) || acts?.targets.includes(a.id) || this.pickedTarget === a.id)
      g.save()
      if (a.isAvatar) {
        const b = ASSETS.sprite(avatarSpriteId(a.defId))
        if (b) {
          const bob = a.zone === 'board' ? Math.sin(this.t * 2.2) * 0.03 : 0
          drawSprite(g, b, x, y + (onBoard ? 30 : 18), {
            anim: a.flash > 0 ? 'hurt' : 'idle',
            t: this.t,
            squash: [a.sx * (1 - bob), a.sy * (1 + bob)],
            alpha: a.alpha,
            scale: a.scale * (onBoard ? 2.15 : 2.4),
            shadow: true,
            tintHex: a.flash > 0 ? PAL.red : undefined,
          })
        }
        if (!onBoard) {
          text.draw(String(a.points), x, y - 22, { size: 14, align: 'center', bold: true, color: PAL.lamp1, stroke: PAL.ink, strokeWidth: 3, alpha: a.alpha })
        }
        if (statuses.length) drawStatuses(g, statuses, x - 16, y - 4)
      } else if (a.owner === 'enemy') {
        const icon = ASSETS.npc(a.defId)
        g.save()
        g.globalAlpha *= a.alpha
        g.translate(Math.round(x), Math.round(y + (onBoard ? 6 : 0)))
        g.scale(a.sx * a.scale * (onBoard ? 1.28 : 1.5), a.sy * a.scale * (onBoard ? 1.28 : 1.5))
        g.drawImage(icon, -icon.width / 2, -icon.height / 2)
        g.restore()
        text.draw(fictionName(a.defId), x, y + (onBoard ? 20 : 18), { size: 9, align: 'center', color: PAL.cream, alpha: a.alpha })
        if (!onBoard) {
          text.draw(String(a.points), x, y - 16, { size: 13, align: 'center', bold: true, color: a.sealed ? PAL.gray2 : PAL.fruR, stroke: PAL.ink, strokeWidth: 3, alpha: a.alpha })
        }
        if (statuses.length) drawStatuses(g, statuses, x + 12, y - 2)
      } else {
        const def = cardDef(a.defId)
        const size = onBoard ? 40 : 48
        ui.save()
        ui.globalAlpha *= a.alpha
        if (!onBoard && a.scale !== 1) {
          ui.translate(Math.round(x), Math.round(y))
          ui.scale(a.scale, a.scale)
          ui.translate(-Math.round(x), -Math.round(y))
        }
        drawBoardToken(ui, text, def, x - size / 2, onBoard ? y - 12 : y - size / 2, size, {
          points: a.points, sealed: a.sealed, player: true, selected: aimed, statuses, hidePoints: onBoard || a.scale < 0.9,
        })
        ui.restore()
      }
      if (aimed) {
        pxFrame(g, Math.round(x - 28), Math.round(y - 28), 56, 56, this.pickedTarget === a.id ? PAL.lamp2 : PAL.lamp1, 2)
      }
      g.restore()
      if (a.zone === 'board') {
        this.app.ui.hit(`board-${a.id}`, { x: x - 26, y: y - 26, w: 52, h: 52 }, () => this.onBoard(a.id), 7)
      }
    }
    this.drawCellPoints(ui, text)
  }

  /** 点数钉在格子顶上，不压住格子里的图像。 */
  private drawCellPoints(ui: G, text: TextLayer): void {
    for (const a of this.actors.values()) {
      if (a.zone !== 'board' || a.cell == null) continue
      const p = CELL_POS(a.cell)
      const label = String(a.points)
      const cx = p.x + BATTLE.cell / 2
      const y = p.y + 2
      const bw = Math.max(18, label.length * 7 + 6)
      ui.fillStyle = rgba(PAL.ink, 0.82)
      ui.fillRect(cx - bw / 2, y, bw, 12)
      const color = a.sealed ? PAL.gray2 : a.owner === 'player' ? (a.isAvatar ? PAL.lamp1 : PAL.fruG) : PAL.fruR
      text.draw(String(a.points), cx, y + 1, {
        size: 10, align: 'center', bold: true, color, stroke: PAL.ink, strokeWidth: 2, alpha: a.alpha,
      })
    }
  }

  private drawFx(g: G, text: TextLayer): void {
    drawSparks(g, this.sparks)
    for (const f of this.floaters) {
      const k = clamp(1 - f.t / f.life, 0, 1)
      text.draw(f.text, f.x, f.y - (f.t / f.life) * 14, { size: 14, align: 'center', bold: true, color: f.color, stroke: PAL.ink, strokeWidth: 3, alpha: k })
    }
    for (const d of this.drips) {
      const k = d.t / (0.55 * PACE)
      g.fillStyle = rgba(PAL.red, 1 - k)
      g.fillRect(Math.round(d.x + Math.sin(k * 6) * 4), Math.round(lerp(d.y, 18, k)), 2, 3)
    }
  }

  private drawHud(ui: G, text: TextLayer): void {
    const run = this.app.view()
    const view = this.app.ask({ type: 'battle.view' })
    bannerBg(ui, 0, TOPBAR_H, 0.82)
    text.draw(fictionName(this.encounterId), 10, 6, { size: 12, bold: true, color: PAL.lamp1 })
    text.draw(`第${this.turn}回合 · ${this.phase === 'play' ? '出牌' : '结束'}`, 92, 7, { size: 11, color: PAL.cream })
    if (run) drawHpBar(ui, text, 250, 9, 90, run.hp, run.hpMax)
    drawWoundChip(ui, text, 430, 5, view?.avatar.avatarCost ?? this.wound)
    if (run?.floorEffect) text.draw(fictionName(run.floorEffect), 512, 7, { size: 10, color: PAL.gray3 })
    const pf = view?.playerFinal ?? 0, ef = view?.enemyFinal ?? 0
    text.draw(`己${pf}`, 10, 32, { size: 13, bold: true, color: PAL.fruG })
    text.draw(`敌${ef}`, 70, 32, { size: 13, bold: true, color: PAL.fruR })
    if (view?.leading) blit(ui, ASSETS.icon('icon.lead', 16, 16), 104, 30)
    text.draw('费用：', 124, 32, { size: 12, color: PAL.cream, bold: true })
    const gem = ASSETS.icon('icon.occupy', 14, 14)
    if (this.manaCap <= 0) {
      text.draw('0', 166, 32, { size: 12, color: PAL.gray3, bold: true })
    } else {
      for (let i = 0; i < this.manaCap; i++) {
        const spent = i >= this.mana
        ui.save()
        ui.globalAlpha = spent ? 0.42 : 1
        blit(ui, gem, 166 + i * 16, 30)
        ui.restore()
      }
    }
    const oil = view?.resA ?? 0
    if (oil > 0 || (run?.deckId === 'DK.C')) {
      const ox = 166 + Math.max(this.manaCap, 1) * 16 + 10
      text.draw(fictionName('RES.A'), ox, 32, { size: 11, color: PAL.gold, bold: true })
      blit(ui, ASSETS.icon('icon.oil', 14, 14), ox + 28, 31)
      text.draw(`${oil}`, ox + 44, 32, { size: 11, color: PAL.gold, bold: true })
    }
    if (view?.mustPlaceAvatar) text.draw('先落下化身', 320, 52, { size: 12, align: 'center', color: PAL.lamp1, bold: true })
    this.app.ui.button('battle-log', { x: 552, y: 172, w: 76, h: 26 }, this.log.open ? '收起' : '记录', () => {
      audio.sfx('click')
      this.log.toggle()
    }, { small: true, primary: this.log.open, disabled: this.app.busy, z: 60 })
    this.app.ui.button('end-turn', { x: 552, y: 248, w: 76, h: 26 }, '结束回合', () => {
      audio.sfx('click')
      this.app.send({ type: 'battle.endTurn' })
    }, { small: true, disabled: this.app.busy || !view?.canEndTurn })
    const noAim = !!view && !view.mustPlaceAvatar && view.phase === 'play' && !this.usedActive && !this.app.ask({ type: 'battle.legalActivates' }).length
    this.app.ui.button('activate', { x: 552, y: 218, w: 76, h: 26 }, '主动', () => {
      this.onActivate()
    }, { small: true, disabled: this.app.busy || !view?.canActivate || noAim || this.usedActive })
    if (view && !view.mustPlaceAvatar && view.phase === 'play' && (this.usedActive || noAim)) {
      text.draw(this.usedActive ? '本场已用过' : '没有可指定的目标', 590, 206, { size: 9, align: 'center', color: PAL.gray2 })
    }
  }

  private drawPiles(ui: G, text: TextLayer): void {
    const view = this.app.ask({ type: 'battle.view' })
    this.drawPile(ui, text, PILES.draw, view?.deckLeft ?? 0, '牌组', 'back', 'pile-draw', '点击查看还剩哪些牌。')
    this.drawPile(ui, text, PILES.discard, view?.discardCount ?? 0, '弃牌堆', 'discard', 'pile-discard', '打出或离场的牌放这里。只有效果能把它们捡回来。')
    this.drawPile(ui, text, PILES.enemy, view?.enemyDiscardCount ?? 0, '敌方弃牌', 'enemy', 'pile-enemy', '对方离场的牌。不算进你的弃牌堆。')
  }

  private drawPile(
    ui: G,
    text: TextLayer,
    r: { x: number; y: number; w: number; h: number },
    count: number,
    label: string,
    kind: 'back' | 'discard' | 'enemy',
    id: string,
    hint: string,
  ): void {
    text.occlude(r.x - 6, r.y - 8, r.w + 20, r.h + 20)
    const edge = kind === 'back' ? PAL.dai : kind === 'enemy' ? PAL.fruR : PAL.copper
    const face = kind === 'back' ? PAL.blueD : kind === 'enemy' ? PAL.ink2 : PAL.slate
    const layers = count <= 0 ? 0 : Math.min(3, count)
    if (layers === 0) cardFrame(ui, r.x, r.y, r.w, r.h, PAL.slate, PAL.tile1, { dim: true })
    for (let i = layers - 1; i >= 0; i--) cardFrame(ui, r.x + i * 2, r.y - i * 2, r.w, r.h, edge, face)
    if (kind === 'back' && count > 0) {
      ui.fillStyle = PAL.blueL
      ui.fillRect(r.x + 10, r.y + 12, r.w - 20, 2)
      ui.fillRect(r.x + Math.round(r.w / 2) - 1, r.y + 8, 2, r.h - 20)
    }
    text.draw(String(count), r.x + r.w / 2, r.y + 16, { size: 14, align: 'center', bold: true, color: PAL.cream, stroke: PAL.ink, strokeWidth: 3 })
    text.draw(label, r.x + r.w / 2, r.y + r.h + 2, { size: 10, align: 'center', bold: true, color: PAL.cream, stroke: PAL.ink, strokeWidth: 3 })
    const openDeck = kind === 'back'
    this.app.ui.hit(id, { x: r.x - 4, y: r.y - 6, w: r.w + 14, h: r.h + 20 }, () => {
      if (!openDeck || this.app.busy) return
      audio.sfx('click')
      this.deckOpen = !this.deckOpen
      this.deckPage = 0
    }, openDeck ? 12 : 3, openDeck ? 'pointer' : 'default')
    if (!this.deckOpen && this.app.input.isHover(id)) drawHint(ui, text, label, hint, r.x - 20, r.y - 36, 168)
  }

  /** 点牌组后列出还剩哪些牌。按名字汇总，不露出下一张的顺序。 */
  private drawDeckBrowse(ui: G, text: TextLayer): void {
    if (!this.deckOpen) return
    const view = this.app.ask({ type: 'battle.view' })
    const deck = view?.deck ?? []
    const groups = groupDeck(deck)
    const pages = Math.max(1, Math.ceil(groups.length / DECK_PAGE))
    if (this.deckPage > pages - 1) this.deckPage = pages - 1
    if (this.deckPage < 0) this.deckPage = 0
    const slice = groups.slice(this.deckPage * DECK_PAGE, this.deckPage * DECK_PAGE + DECK_PAGE)

    ui.fillStyle = rgba(PAL.ink, 0.62)
    ui.fillRect(0, 0, W, H)
    this.app.ui.hit('deck-back', { x: 0, y: 0, w: W, h: H }, () => {
      this.deckOpen = false
    }, 40)

    const { x, y, w, h } = PANEL
    text.occlude(x, y, w, h)
    panel(ui, x, y, w, h, 'stone')
    this.app.ui.hit('deck-panel', { x, y, w, h }, () => {}, 45, 'default')
    text.draw('牌组', x + 16, y + 10, { size: 14, bold: true, color: PAL.lamp1 })
    text.draw(`还剩 ${deck.length} 张`, x + 58, y + 12, { size: 12, color: PAL.cream })
    this.app.ui.button('deck-close', { x: x + w - 72, y: y + 8, w: 56, h: 22 }, '关闭', () => {
      audio.sfx('click')
      this.deckOpen = false
    }, { small: true, z: 60 })

    if (!slice.length) {
      text.draw('牌组里没有牌了。', x + 16, y + 48, { size: 12, color: PAL.cream })
      return
    }

    let hover: DeckGroup | undefined
    slice.forEach((g, i) => {
      const col = i % DECK_COLS
      const row = Math.floor(i / DECK_COLS)
      const cx = x + 16 + col * (DECK_CARD_W + 8)
      const cy = y + 40 + row * (DECK_CARD_H + 6)
      const def = cardDef(g.defId)
      const bonus = def.kind !== 'spell' && g.basePoints > def.basePoints ? g.basePoints - def.basePoints : 0
      drawFaceCard(ui, text, def, cx, cy, DECK_CARD_W, DECK_CARD_H, { bonus })
      if (g.n > 1) {
        text.draw(`×${g.n}`, cx + DECK_CARD_W - 6, cy + DECK_CARD_H - 16, {
          size: 12, align: 'right', bold: true, color: PAL.lamp1, stroke: PAL.ink, strokeWidth: 3,
        })
      }
      this.app.ui.hit(`deck-card-${i}`, { x: cx, y: cy, w: DECK_CARD_W, h: DECK_CARD_H }, () => {}, 55, 'default')
      if (this.app.input.isHover(`deck-card-${i}`)) hover = g
    })

    if (pages > 1) {
      this.app.ui.button('deck-prev', { x: x + w - 168, y: y + h - 28, w: 52, h: 20 }, '上页', () => {
        this.deckPage = Math.max(0, this.deckPage - 1)
      }, { small: true, disabled: this.deckPage <= 0, z: 60 }, { size: 10 })
      this.app.ui.button('deck-next', { x: x + w - 110, y: y + h - 28, w: 52, h: 20 }, '下页', () => {
        this.deckPage = Math.min(pages - 1, this.deckPage + 1)
      }, { small: true, disabled: this.deckPage >= pages - 1, z: 60 }, { size: 10 })
      text.draw(`${this.deckPage + 1}/${pages}`, x + w - 48, y + h - 24, { size: 10, color: PAL.gray3 })
    }

    if (hover) {
      const def = cardDef(hover.defId)
      drawTooltip(ui, text, def, x + 16, y + h - 8, {
        currentPoints: def.kind === 'spell' ? undefined : hover.basePoints,
      })
    }
  }

  private drawHand(ui: G, text: TextLayer): void {
    const plays = this.legal()
    const hover = this.app.input.hover
    const order = [...this.hand]
    const top = hover?.startsWith('hand-') ? hover.slice(5) : this.selected
    if (top && order.includes(top)) {
      order.splice(order.indexOf(top), 1)
      order.push(top)
    }
    for (const id of order) {
      const a = this.actors.get(id)
      if (!a || a.zone === 'gone') continue
      const i = this.hand.indexOf(id)
      const p = this.handSlot(i, this.hand.length)
      const flying = a.zone !== 'hand'
      if (!flying && !this.app.busy) { a.x = p.x; a.y = p.y }
      const def = cardDef(a.defId)
      const playable = plays.some((x) => x.card === id)
      const over = hover === `hand-${id}`
      const lift = !flying && !this.app.busy && (this.selected === id || over) ? 10 : 0
      const x = flying || this.app.busy ? a.x : p.x
      const y = (flying || this.app.busy ? a.y : p.y) - lift
      drawHandCard(ui, text, def, x, y, BATTLE.cardW, BATTLE.cardH, {
        selected: this.selected === id,
        dim: !playable && !flying,
        points: a.points,
      })
      if (!this.app.busy && !flying) {
        this.app.ui.hit(`hand-${id}`, { x, y: y - 10, w: BATTLE.cardW, h: BATTLE.cardH + 10 }, () => {
          this.onHand(id)
        }, 8)
      }
    }
    if (this.selected && this.selectedPlay()) {
      const p = this.selectedPlay()!
      const preview = this.app.ask({
        type: 'battle.previewPlay',
        card: this.selected,
        cell: p.cells[0],
        target: this.pickedTarget ?? p.targets[0],
        target2: this.pickedTarget ? p.targets.find((t) => t !== this.pickedTarget) : undefined,
      })
      if (preview) {
        text.draw(`预览 己${preview.player} 敌${preview.enemy} 化身${preview.avatar} 费${preview.occupy}/${preview.occupyCap}`, 320, 268, {
          size: 10, align: 'center', color: PAL.gray3,
        })
      }
    }
  }

  private drawResult(ui: G, text: TextLayer): void {
    if (!this.result) return
    text.occlude(0, 140, 640, 90)
    bannerBg(ui, 140, 70, 0.78)
    text.draw(this.result.outcome === 'win' ? '胜利' : '失败', 320, 150, { size: 20, align: 'center', bold: true, color: this.result.outcome === 'win' ? PAL.lamp1 : PAL.fruR })
    text.draw(`化身代价 ${this.result.avatarCost} · ${this.result.reason === 'lead' ? '总点检查' : this.result.reason === 'clear' ? '清场' : this.result.reason === 'avatarGone' ? '化身离场' : '无牌可出'}`, 320, 176, { size: 12, align: 'center', color: PAL.cream })
    this.app.ui.button('finish', { x: 260, y: 198, w: 120, h: 26 }, '回地图', () => {
      audio.sfx('click')
      this.app.send({ type: 'run.finishFlow' })
    }, { primary: true, small: true, disabled: this.app.busy })
  }

  private drawInspect(ui: G, text: TextLayer): void {
    const id = this.peekFromHover() ?? this.selected
    if (id) {
      const a = this.actors.get(id)
      const view = this.app.ask({ type: 'battle.view' })
      const inst = view?.cards[id]
      const defId = a?.defId ?? inst?.defId
      if (!defId) return
      const def = cardDef(defId)
      drawInspectPanel(ui, text, {
        def,
        currentPoints: inst?.currentPoints ?? a?.points,
        statuses: inst?.statuses,
        owner: inst?.owner ?? a?.owner,
      }, INSPECT.x, INSPECT.y, INSPECT.w)
      return
    }
    const run = this.app.view()
    if (!run?.floorEffect) return
    const me = mapEffectDef(run.floorEffect)
    drawHint(ui, text, fictionName(run.floorEffect), `${me.text}\n指向卡牌查看说明。Esc 菜单。`, INSPECT.x, INSPECT.y, INSPECT.w)
  }

  private drawDiscardPick(ui: G, text: TextLayer): void {
    const play = this.selectedPlay()
    if (!this.isDiscardAim(play) || !play) return
    const view = this.app.ask({ type: 'battle.view' })
    text.draw('从弃牌堆选一张', INSPECT.x + 8, 268, { size: 10, color: PAL.lamp1, bold: true })
    play.targets.forEach((id, i) => {
      const inst = view?.cards[id]
      if (!inst) return
      const def = cardDef(inst.defId)
      const x = 8 + (i % 4) * 50
      const y = 282 + Math.floor(i / 4) * 20
      this.app.ui.button(`disc-${id}`, { x, y, w: 46, h: 18 }, fictionName(def.id), () => {
        this.commit(play.card, { target: id })
      }, { small: true }, { size: 8 })
    })
  }

  private drawAimHint(ui: G, text: TextLayer): void {
    const msg = this.aimMessage()
    if (!msg) return
    text.draw(msg, 320, 64, { size: 11, align: 'center', color: PAL.lamp1, bold: true })
    void ui
  }

  private peekFromHover(): string | null {
    const h = this.app.input.hover
    if (!h) return null
    if (h.startsWith('hand-')) return h.slice(5)
    if (h.startsWith('board-')) return h.slice(6)
    if (h.startsWith('disc-')) return h.slice(5)
    return null
  }

  private isDiscardAim(play: LegalPlay | undefined): boolean {
    if (!play?.targets.length) return false
    const view = this.app.ask({ type: 'battle.view' })
    return view?.cards[play.targets[0]]?.zone === 'discard'
  }

  private isSwap(play: LegalPlay | undefined): boolean {
    if (!play) return false
    const defId = this.actors.get(play.card)?.defId
    if (!defId) return false
    return cardDef(defId).effects.some((e) => e.ops.some((op) => op.op === 'swapChosen'))
  }

  private needsCellAndTarget(play: LegalPlay | undefined): boolean {
    return !!play && play.cells.length > 0 && play.targets.length > 0
  }

  private commit(card: string, opts: { cell?: Cell; target?: string; target2?: string } = {}): void {
    this.app.send({ type: 'battle.play', card, cell: opts.cell, target: opts.target, target2: opts.target2 })
    this.selected = null
    this.pickedTarget = null
    this.activateAim = false
  }

  private onHand(id: string): void {
    if (this.app.busy) return
    const p2 = this.legal().find((x) => x.card === id)
    if (!p2) return
    if (!p2.cells.length && !p2.targets.length) {
      this.commit(id)
      return
    }
    audio.sfx('click')
    this.selected = this.selected === id ? null : id
    this.pickedTarget = null
    this.activateAim = false
  }

  private onCell(cell: Cell): void {
    if (this.app.busy || this.activateAim) return
    const play = this.selectedPlay()
    if (!play || !this.selected) return
    const view = this.app.ask({ type: 'battle.view' })
    const info = view?.cells[cell - 1]
    const inst = info?.card
    const legalCell = play.cells.includes(cell)
    const canTarget = !!(inst && play.targets.includes(inst))
    if (this.needsCellAndTarget(play)) {
      if (canTarget && inst) {
        this.pickedTarget = inst
        audio.sfx('click')
        return
      }
      if (legalCell && this.pickedTarget) {
        this.commit(this.selected, { cell, target: this.pickedTarget })
        return
      }
      if (legalCell) this.app.toast('先点要指定的那张卡', 48)
      return
    }
    if (legalCell) {
      this.commit(this.selected, { cell })
      return
    }
    if (canTarget && inst) this.commit(this.selected, { target: inst })
  }

  private onBoard(id: string): void {
    if (this.app.busy) return
    if (this.activateAim) {
      const acts = this.app.ask({ type: 'battle.legalActivates' })[0]
      if (acts?.targets.includes(id)) {
        audio.sfx('click')
        this.app.send({ type: 'battle.activate', card: acts.card, target: id })
        this.activateAim = false
      }
      return
    }
    const play = this.selectedPlay()
    if (!play || !this.selected) return
    const a = this.actors.get(id)
    if (this.isSwap(play) && play.targets.includes(id)) {
      if (!this.pickedTarget) {
        this.pickedTarget = id
        audio.sfx('click')
        return
      }
      if (this.pickedTarget === id) return
      this.commit(this.selected, { target: this.pickedTarget, target2: id })
      return
    }
    if (this.needsCellAndTarget(play) && play.targets.includes(id)) {
      this.pickedTarget = id
      audio.sfx('click')
      return
    }
    if (play.targets.includes(id)) {
      this.commit(this.selected, { target: id, cell: a?.cell })
      return
    }
    if (a?.cell && play.cells.includes(a.cell)) this.commit(this.selected, { cell: a.cell })
  }

  private onActivate(): void {
    const a = this.app.ask({ type: 'battle.legalActivates' })[0]
    if (!a) return
    audio.sfx('click')
    if (!a.targets.length) {
      this.app.send({ type: 'battle.activate', card: a.card })
      return
    }
    if (a.targets.length === 1) {
      this.app.send({ type: 'battle.activate', card: a.card, target: a.targets[0] })
      return
    }
    this.activateAim = true
    this.selected = null
    this.pickedTarget = null
  }

  private aimMessage(): string | null {
    if (this.activateAim) return `选择带${fictionName('MK.A')}的敌人`
    const play = this.selectedPlay()
    if (!play || !this.selected) return null
    if (this.isDiscardAim(play)) return '从弃牌堆选一张'
    if (this.isSwap(play)) return this.pickedTarget ? '再选一张交换位置' : '选择第一张要换位的卡'
    if (this.needsCellAndTarget(play)) return this.pickedTarget ? '选择相邻空格' : '先选择要指定的卡'
    if (play.cells.length && !play.targets.length) return '选择格子落下'
    if (play.targets.length) return '选择目标'
    return null
  }

  onKey(k: string): void {
    if (!this.log.open) return
    if (k === 'ArrowUp' || k === 'PageUp') this.log.nudge(-1)
    if (k === 'ArrowDown' || k === 'PageDown') this.log.nudge(1)
  }

  onCancel(): boolean {
    if (this.deckOpen) {
      this.deckOpen = false
      return true
    }
    if (this.log.open) {
      this.log.close()
      return true
    }
    if (this.selected || this.activateAim || this.pickedTarget) {
      this.selected = null
      this.pickedTarget = null
      this.activateAim = false
      return true
    }
    return false
  }
}

const DECK_COLS = 5
const DECK_PAGE = 10
const DECK_CARD_W = 100
const DECK_CARD_H = 86

interface DeckGroup {
  defId: string
  basePoints: number
  n: number
}

function groupDeck(deck: { defId: string; basePoints: number }[]): DeckGroup[] {
  const map = new Map<string, DeckGroup>()
  for (const c of deck) {
    const key = `${c.defId}\0${c.basePoints}`
    const g = map.get(key)
    if (g) g.n += 1
    else map.set(key, { defId: c.defId, basePoints: c.basePoints, n: 1 })
  }
  return [...map.values()].sort((a, b) => {
    const byName = fictionName(a.defId).localeCompare(fictionName(b.defId), 'zh')
    return byName || a.basePoints - b.basePoints
  })
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t }
