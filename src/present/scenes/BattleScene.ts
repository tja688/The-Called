/**
 * 俯视桌面 + 九宫格。动画只跟事件走；读模型只用于合法格 / 预览 / HUD 对齐。
 */
import { Scene } from '../Scene'
import type { DomainEvent } from '../../core/messages'
import type { BattleEvent } from '../../domain/battle/events'
import type { Cell } from '../../domain/geometry'
import type { EncounterId } from '../../domain/types'
import type { TextLayer } from '../../pixel/text'
import { PAL, rgba } from '../../pixel/palette'
import { ASSETS } from '../../pixel/assets'
import { bakeTable, type TableKind } from '../../pixel/terrain'
import { duskWash, nightWash, vignette, glow } from '../../pixel/light'
import { pxRoundRect, pxFrame, dashedLine, bannerBg } from '../../pixel/ui'
import { drawSprite, blit } from '../../pixel/dsl'
import { tween, wait, ease, osc, clamp } from '../../pixel/tween'
import { cardDef } from '../../content/cards'
import { encounterDef } from '../../content/encounters'
import { audio } from '../../audio/audio'
import { BATTLE, TOPBAR_H } from '../layout'
import { drawHandCard, drawBoardToken, drawHpBar, drawWoundChip, drawTooltip } from '../widgets'
import type { LegalPlay } from '../../domain/battle/BattleAggregate'

type BE<T extends BattleEvent['type']> = Extract<BattleEvent, { type: T }>
type G = CanvasRenderingContext2D

interface Actor {
  id: string
  defId: string
  owner: 'player' | 'enemy'
  kind: 'occupy' | 'spell'
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
  zone: 'hand' | 'board' | 'fly' | 'gone'
  cell?: Cell
  points: number
  sealed: boolean
  z: number
}

interface Floater { x: number; y: number; text: string; color: string; t: number }
interface Drip { x: number; y: number; t: number }

const CELL_POS = (cell: number) => {
  const c = (cell - 1) % 3, r = Math.floor((cell - 1) / 3)
  return { x: BATTLE.gridX + c * (BATTLE.cell + BATTLE.gap), y: BATTLE.gridY + r * (BATTLE.cell + BATTLE.gap) }
}
const cellCenter = (cell: number) => {
  const p = CELL_POS(cell)
  return { x: p.x + BATTLE.cell / 2, y: p.y + BATTLE.cell / 2 }
}
const DECK = { x: 600, y: 318 }
const TABLE: Record<EncounterId, TableKind> = { yuZhuang: 'bamboo', boShou: 'stone', shouMen: 'hall' }

export class BattleScene extends Scene {
  readonly name = 'battle' as const
  private actors = new Map<string, Actor>()
  private hand: string[] = []
  private selected: string | null = null
  private mana = 0
  private manaCap = 0
  private leading = false
  private leadFlash = 0
  private turn = 1
  private phase: 'play' | 'pressure' | 'over' = 'play'
  private wound = 0
  private encounterId: EncounterId = 'yuZhuang'
  private table: HTMLCanvasElement | null = null
  private t = 0
  private floaters: Floater[] = []
  private drips: Drip[] = []
  private result: BE<'battle.settled'> | null = null
  private lastType = ''
  private zc = 0
  private peek: string | null = null
  private lockLines: { x1: number; y1: number; x2: number; y2: number; t: number }[] = []

  enter(): void {
    const v = this.app.ask({ type: 'battle.view' })
    if (!v) return
    this.encounterId = v.encounterId
    this.table = bakeTable(TABLE[v.encounterId])
    this.wound = v.avatar.woundEstimate
    this.mana = v.mana
    this.manaCap = v.manaCap
    this.leading = v.leading
    this.turn = v.turn
    this.phase = v.phase
    audio.atmosphere(v.encounterId)
  }

  exit(): void {
    audio.atmosphere(null)
  }

  update(dt: number): void {
    this.t += dt
    this.leadFlash = Math.max(0, this.leadFlash - dt)
    for (const a of this.actors.values()) a.flash = Math.max(0, a.flash - dt * 3)
    this.floaters = this.floaters.filter((f) => (f.t += dt) < 0.7)
    this.drips = this.drips.filter((d) => (d.t += dt) < 0.55)
    this.lockLines = this.lockLines.filter((l) => (l.t -= dt) > 0)
  }

  async handle(e: DomainEvent): Promise<void> {
    if (!e.type.startsWith('battle.')) return
    const ev = e as BattleEvent
    const brief = this.lastType === ev.type
    this.lastType = ev.type
    switch (ev.type) {
      case 'battle.started': await this.onStart(ev); break
      case 'battle.avatarDealt': await this.onDealt(ev); break
      case 'battle.cardDrawn': await this.onDrawn(ev); break
      case 'battle.turnStarted': await this.onTurn(ev, brief); break
      case 'battle.phaseChanged': await this.onPhase(ev); break
      case 'battle.manaChanged': await this.onMana(ev, brief); break
      case 'battle.cardPlayed': await this.onPlayed(ev); break
      case 'battle.cardCovered': await this.onCovered(ev); break
      case 'battle.cardEntered': await this.onEntered(ev); break
      case 'battle.cardRemoved': await this.onRemoved(ev); break
      case 'battle.pointsChanged': await this.onPoints(ev, brief); break
      case 'battle.statusAdded': await this.onStatus(ev, true); break
      case 'battle.statusRemoved': await this.onStatus(ev, false); break
      case 'battle.pressureResolved': await this.onPressure(ev); break
      case 'battle.leadChanged': await this.onLead(ev); break
      case 'battle.settled': await this.onSettled(ev); break
    }
  }

  private async beat(sec: number): Promise<void> {
    await wait(sec)
  }

  private makeActor(id: string, defId: string, owner: Actor['owner'], x: number, y: number): Actor {
    const def = cardDef(defId)
    const a: Actor = {
      id, defId, owner, kind: def.kind, isAvatar: defId === 'AVATAR',
      x, y, sx: 1, sy: 1, alpha: 1, scale: 1, lift: 0, glow: 0, flash: 0,
      zone: 'fly', points: def.basePoints, sealed: false, z: this.zc++,
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

  private async layoutHand(): Promise<void> {
    await Promise.all(this.hand.map((id, i) => {
      const a = this.actors.get(id)
      if (!a) return Promise.resolve()
      const p = this.handSlot(i, this.hand.length)
      a.z = 100 + i
      a.zone = 'hand'
      return tween(a, { x: p.x, y: p.y, alpha: 1, scale: 1 }, 0.18, ease.outQuad)
    }))
  }

  private floatAt(p: { x: number; y: number }, text: string, color: string): void {
    this.floaters.push({ x: p.x, y: p.y, text, color, t: 0 })
  }

  private async onStart(ev: BE<'battle.started'>): Promise<void> {
    this.encounterId = ev.encounterId
    this.table = bakeTable(TABLE[ev.encounterId])
    audio.atmosphere(ev.encounterId)
    const enc = encounterDef(ev.encounterId)
    await this.app.showBanner(enc.name, ev.text.replace(/^[^。]+。/, ''), 0.7, enc.boss ? PAL.lamp2 : PAL.lamp1)
  }

  private async onDealt(ev: BE<'battle.avatarDealt'>): Promise<void> {
    const a = this.makeActor(ev.card, ev.defId, 'player', DECK.x, DECK.y)
    this.hand.push(ev.card)
    audio.sfx('draw')
    await this.layoutHand()
    a.sy = 0.7; a.sx = 1.25
    await tween(a, { sx: 1, sy: 1 }, 0.16, ease.outBack)
  }

  private async onDrawn(ev: BE<'battle.cardDrawn'>): Promise<void> {
    const a = this.makeActor(ev.card, ev.defId, 'player', DECK.x, DECK.y)
    this.hand.push(ev.card)
    audio.sfx('draw')
    await this.layoutHand()
    await this.beat(0.04)
  }

  private async onTurn(ev: BE<'battle.turnStarted'>, brief: boolean): Promise<void> {
    this.turn = ev.turn
    this.leading = ev.leading
    if (ev.won) {
      await this.app.showBanner('领先成立', '撑过了这一拍', 0.7, PAL.lamp1)
      return
    }
    if (!brief) await this.beat(ev.opening ? 0.12 : 0.18)
  }

  private async onPhase(ev: BE<'battle.phaseChanged'>): Promise<void> {
    this.phase = ev.phase
    if (ev.phase === 'pressure') {
      this.app.shake = 2.2
      audio.sfx('pressure')
      await this.beat(0.16)
    }
  }

  private async onMana(ev: BE<'battle.manaChanged'>, brief: boolean): Promise<void> {
    const up = ev.current > this.mana || ev.cap > this.manaCap
    this.mana = ev.current
    this.manaCap = ev.cap
    if (up) audio.sfx('mana')
    if (!brief) await this.beat(0.08)
  }

  private async onPlayed(ev: BE<'battle.cardPlayed'>): Promise<void> {
    const a = this.actors.get(ev.card)
    this.selected = null
    this.hand = this.hand.filter((id) => id !== ev.card)
    audio.sfx('play')
    if (!a) return
    if (ev.kind === 'spell') {
      a.zone = 'fly'
      await tween(a, { y: a.y - 24, alpha: 0.2, scale: 1.15 }, 0.22, ease.outQuad)
      a.zone = 'gone'
      await this.layoutHand()
      return
    }
    a.lift = 8
    a.zone = 'fly'
    await tween(a, { lift: 0 }, 0.1, ease.outQuad)
  }

  private async onCovered(ev: BE<'battle.cardCovered'>): Promise<void> {
    const v = this.actors.get(ev.victim)
    const c = cellCenter(ev.cell)
    audio.sfx('cover')
    this.floatAt(c, `-${ev.victimPoints}`, PAL.lamp3)
    if (v) {
      v.glow = 1
      await tween(v, { sy: 0.2, sx: 1.35, alpha: 0.35 }, 0.2, ease.inQuad)
    }
    await this.beat(0.05)
  }

  private async onEntered(ev: BE<'battle.cardEntered'>): Promise<void> {
    let a = this.actors.get(ev.card)
    const dest = cellCenter(ev.cell)
    const view = this.app.ask({ type: 'battle.view' })
    const inst = view?.cards[ev.card]
    if (!a) {
      a = this.makeActor(ev.card, inst?.defId ?? 'E1A', inst?.owner ?? 'enemy', dest.x, dest.y - 40)
      a.alpha = 0
    }
    this.hand = this.hand.filter((id) => id !== ev.card)
    a.cell = ev.cell
    a.zone = 'fly'
    if (inst) a.points = inst.currentPoints
    await tween(a, { x: dest.x, y: dest.y, alpha: 1, scale: 1, sx: 1.2, sy: 0.75 }, 0.22, ease.outQuad)
    a.zone = 'board'
    await tween(a, { sx: 1, sy: 1 }, 0.16, ease.outBack)
    if (ev.covered) this.floatAt(dest, '压住', PAL.lamp2)
    if (a.defId === 'P03') {
      audio.sfx('mana')
      this.floatAt({ x: dest.x, y: dest.y - 16 }, '+邻', PAL.sta)
    }
    await this.layoutHand()
  }

  private async onRemoved(ev: BE<'battle.cardRemoved'>): Promise<void> {
    const a = this.actors.get(ev.card)
    if (!a) return
    const c = cellCenter(ev.cell)
    if (a.isAvatar || ev.reason === 'banish') {
      audio.sfx('banish')
      a.flash = 1
      await tween(a, { scale: 1.4, alpha: 0, sy: 0.2 }, 0.28, ease.inQuad)
    } else {
      const to = ev.to === 'discard' ? { x: 40, y: 330 } : { x: 40, y: 40 }
      await tween(a, { x: to.x, y: to.y, alpha: 0, scale: 0.4 }, 0.22, ease.inQuad)
    }
    a.zone = 'gone'
    this.floatAt(c, ev.reason === 'banish' ? '驱离' : '离场', PAL.gray3)
    await this.beat(0.05)
  }

  private async onPoints(ev: BE<'battle.pointsChanged'>, brief: boolean): Promise<void> {
    const a = this.actors.get(ev.card)
    if (a) a.points = ev.after
    const p = a ? { x: a.x, y: a.y - 10 } : { x: 320, y: 160 }
    const d = ev.after - ev.before
    this.floatAt(p, `${d > 0 ? '+' : ''}${d}`, d >= 0 ? PAL.sta : PAL.fruR)
    if (a?.isAvatar && d < 0) {
      a.flash = 1
      audio.sfx('hurt')
      this.drips.push({ x: a.x, y: a.y - 20, t: 0 })
      const v = this.app.ask({ type: 'battle.view' })
      if (v) this.wound = v.avatar.woundEstimate
    }
    if (!brief) await this.beat(0.1)
  }

  private async onStatus(ev: BE<'battle.statusAdded'> | BE<'battle.statusRemoved'>, add: boolean): Promise<void> {
    const a = this.actors.get(ev.card)
    if (a) a.sealed = add
    audio.sfx('seal')
    if (a) this.floatAt({ x: a.x, y: a.y }, add ? '封印' : '解封', PAL.dai)
    await this.beat(0.12)
  }

  private async onPressure(ev: BE<'battle.pressureResolved'>): Promise<void> {
    const here = [...this.actors.values()].find((a) => a.zone === 'board' && a.cell === ev.cell)
    const c = cellCenter(ev.cell)
    audio.sfx('pressure')
    this.app.shake = 1.6
    if (here) {
      here.lift = ev.kind === 'damageAvatarOrBanish' ? 6 : -10
      await tween(here, { lift: 0 }, 0.22, ease.outBounce)
    }
    if (ev.kind === 'banishAvatarIfAdjacentAndAtMost') {
      const av = [...this.actors.values()].find((a) => a.isAvatar && a.zone === 'board')
      if (av) {
        this.lockLines.push({ x1: c.x, y1: c.y, x2: av.x, y2: av.y, t: 0.45 })
      }
    }
    this.floatAt(c, '压迫', PAL.orange)
    await this.beat(0.08)
  }

  private async onLead(ev: BE<'battle.leadChanged'>): Promise<void> {
    this.leading = ev.leading
    this.leadFlash = 0.6
    if (ev.leading) audio.sfx('lead')
    await this.app.showBanner(ev.leading ? '领先' : '领先丢失', undefined, 0.45, ev.leading ? PAL.sta : PAL.gray3)
  }

  private async onSettled(ev: BE<'battle.settled'>): Promise<void> {
    this.result = ev
    this.wound = ev.wound
    this.phase = 'over'
    audio.sfx(ev.outcome === 'win' ? 'win' : 'lose')
    this.app.flashA = 0.4
    await this.app.showBanner(ev.outcome === 'win' ? '胜利' : '失败', `伤口 ${ev.wound}`, 0.9, ev.outcome === 'win' ? PAL.lamp1 : PAL.fruR)
  }

  render(world: G, ui: G, text: TextLayer): void {
    this.drawTable(world)
    this.drawGrid(world, ui, text)
    this.drawActors(world, ui, text)
    this.drawFx(world, text)
    this.drawHud(ui, text)
    this.drawHand(ui, text)
    this.drawResult(ui, text)
    this.drawHoverTip(ui, text)
  }

  private drawTable(g: G): void {
    g.fillStyle = PAL.night1
    g.fillRect(0, 0, 640, 360)
    if (this.table) g.drawImage(this.table, 0, BATTLE.tableY)
    if (this.encounterId === 'yuZhuang') duskWash(g, 0.08)
    if (this.encounterId === 'boShou') duskWash(g, 0.16)
    if (this.encounterId === 'shouMen') nightWash(g, 0.22)
    vignette(g, 0.28)
    if (this.leading || this.leadFlash > 0) {
      const a = 0.18 + this.leadFlash * 0.4
      glow(g, 320, 170, 90, PAL.sta, a, false)
    }
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
      pxRoundRect(g, p.x + 1, p.y + 1, BATTLE.cell - 2, BATTLE.cell - 2, info?.shadowActive ? PAL.night2 : PAL.wood1, 1)
      if (info?.corner) {
        g.fillStyle = rgba(PAL.night1, 0.35)
        g.fillRect(p.x + 2, p.y + 2, BATTLE.cell - 4, BATTLE.cell - 4)
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
            if (legalCell) this.app.send({ type: 'battle.play', card: this.selected!, cell: cell as Cell })
            else if (canTarget && inst) this.app.send({ type: 'battle.play', card: this.selected!, target: inst.id })
            this.selected = null
          }, 6)
        }
      }
    }
    for (const l of this.lockLines) dashedLine(g, l.x1, l.y1, l.x2, l.y2, PAL.fruR, 3, 2)
    void ui
  }

  private drawActors(g: G, ui: G, text: TextLayer): void {
    const list = [...this.actors.values()].filter((a) => a.zone !== 'gone' && a.zone !== 'hand').sort((a, b) => a.z - b.z)
    for (const a of list) {
      const x = a.x, y = a.y + a.lift
      g.save()
      if (a.isAvatar) {
        const b = ASSETS.sprite('char.avatar')
        if (b) {
          const bob = a.zone === 'board' ? Math.sin(this.t * 2.2) * 0.03 : 0
          drawSprite(g, b, x, y + 18, {
            anim: a.flash > 0 ? 'hurt' : 'idle',
            t: this.t,
            squash: [a.sx * (1 - bob), a.sy * (1 + bob)],
            alpha: a.alpha,
            scale: a.scale * 2.4,
            shadow: true,
            tintHex: a.flash > 0 ? PAL.red : undefined,
          })
        }
        text.draw(String(a.points), x, y - 22, { size: 14, align: 'center', bold: true, color: PAL.lamp1, stroke: PAL.ink, strokeWidth: 3, alpha: a.alpha })
        if (a.zone === 'board') drawWoundChip(ui, text, x - 36, BATTLE.gridY - 22, this.wound)
      } else if (a.owner === 'enemy') {
        const icon = ASSETS.npc(a.defId)
        g.save()
        g.globalAlpha *= a.alpha
        g.translate(Math.round(x), Math.round(y))
        g.scale(a.sx * a.scale * 1.6, a.sy * a.scale * 1.6)
        g.drawImage(icon, -icon.width / 2, -icon.height / 2)
        g.restore()
        text.draw(cardDef(a.defId).name, x, y + 18, { size: 9, align: 'center', color: PAL.cream, alpha: a.alpha })
        text.draw(String(a.points), x, y - 16, { size: 13, align: 'center', bold: true, color: a.sealed ? PAL.gray2 : PAL.fruR, stroke: PAL.ink, strokeWidth: 3, alpha: a.alpha })
        if (a.sealed) blit(g, ASSETS.icon('icon.seal', 16, 16), x + 10, y - 22)
      } else {
        const def = cardDef(a.defId)
        drawBoardToken(ui, text, def, x - 24, y - 24, 48, { points: a.points, sealed: a.sealed, player: true })
      }
      g.restore()
    }
  }

  private drawFx(g: G, text: TextLayer): void {
    for (const f of this.floaters) {
      const k = clamp(1 - f.t / 0.7, 0, 1)
      text.draw(f.text, f.x, f.y - f.t * 22, { size: 14, align: 'center', bold: true, color: f.color, stroke: PAL.ink, strokeWidth: 3, alpha: k })
    }
    for (const d of this.drips) {
      const k = d.t / 0.55
      g.fillStyle = rgba(PAL.red, 1 - k)
      g.fillRect(Math.round(d.x + Math.sin(k * 6) * 4), Math.round(lerp(d.y, 18, k)), 2, 3)
    }
  }

  private drawHud(ui: G, text: TextLayer): void {
    const run = this.app.view()
    const view = this.app.ask({ type: 'battle.view' })
    bannerBg(ui, 0, TOPBAR_H, 0.82)
    text.draw(encounterDef(this.encounterId).name, 10, 6, { size: 12, bold: true, color: PAL.lamp1 })
    text.draw(`第${this.turn}回合 · ${this.phase === 'play' ? '出牌' : this.phase === 'pressure' ? '压迫' : '结束'}`, 92, 7, { size: 11, color: PAL.cream })
    if (run) drawHpBar(ui, text, 250, 9, 90, run.hp, run.hpMax)
    drawWoundChip(ui, text, 430, 5, view?.avatar.woundEstimate ?? this.wound)
    const pf = view?.playerFinal ?? 0, ef = view?.enemyFinal ?? 0
    text.draw(`己${pf}`, 10, 32, { size: 13, bold: true, color: PAL.fruG })
    text.draw(`敌${ef}`, 70, 32, { size: 13, bold: true, color: PAL.fruR })
    if (this.leading) blit(ui, ASSETS.icon('icon.lead', 16, 16), 118, 30)
    for (let i = 0; i < Math.max(this.manaCap, 1); i++) {
      const icon = ASSETS.icon('icon.mana', 16, 16)
      ui.save()
      ui.globalAlpha = i < this.mana ? 1 : 0.25
      blit(ui, icon, 150 + i * 14, 30)
      ui.restore()
    }
    if (view?.mustPlaceAvatar) text.draw('先落下化身', 320, 48, { size: 12, align: 'center', color: PAL.lamp1, bold: true })
    this.app.ui.button('end-turn', { x: 552, y: 248, w: 76, h: 26 }, '结束回合', () => {
      audio.sfx('click')
      this.app.send({ type: 'battle.endTurn' })
    }, { small: true, disabled: this.app.busy || !view?.canEndTurn })
  }

  private drawHand(ui: G, text: TextLayer): void {
    const plays = this.legal()
    this.peek = null
    this.hand.forEach((id, i) => {
      const a = this.actors.get(id)
      if (!a) return
      const p = this.handSlot(i, this.hand.length)
      a.x = p.x; a.y = p.y
      const def = cardDef(a.defId)
      const playable = plays.some((x) => x.card === id)
      const hover = this.app.input.isHover(`hand-${id}`)
      if (hover) this.peek = id
      drawHandCard(ui, text, def, a.x, a.y - (this.selected === id || hover ? 8 : 0), BATTLE.cardW, BATTLE.cardH, {
        selected: this.selected === id,
        dim: !playable,
        points: a.points,
      })
      if (!this.app.busy && playable) {
        this.app.ui.hit(`hand-${id}`, { x: a.x, y: a.y - 8, w: BATTLE.cardW, h: BATTLE.cardH }, () => {
          const p2 = plays.find((x) => x.card === id)!
          if (p2.cells.length === 0 && p2.targets.length === 0) {
            this.app.send({ type: 'battle.play', card: id })
            this.selected = null
            return
          }
          audio.sfx('click')
          this.selected = this.selected === id ? null : id
        }, 8)
      }
    })
    if (this.selected && this.selectedPlay()) {
      const p = this.selectedPlay()!
      const preview = this.app.ask({
        type: 'battle.previewPlay',
        card: this.selected,
        cell: p.cells[0],
        target: p.targets[0],
      })
      if (preview) {
        text.draw(`预览 己${preview.player} 敌${preview.enemy} 化身${preview.avatar} 费${preview.mana}/${preview.manaCap}`, 320, 268, {
          size: 10, align: 'center', color: PAL.gray3,
        })
      }
    }
  }

  private drawResult(ui: G, text: TextLayer): void {
    if (!this.result) return
    bannerBg(ui, 140, 70, 0.78)
    text.draw(this.result.outcome === 'win' ? '胜利' : '失败', 320, 150, { size: 20, align: 'center', bold: true, color: this.result.outcome === 'win' ? PAL.lamp1 : PAL.fruR })
    text.draw(`伤口 ${this.result.wound} · ${this.result.reason === 'lead' ? '领先检查' : this.result.reason === 'avatarGone' ? '化身离场' : '无牌可出'}`, 320, 176, { size: 12, align: 'center', color: PAL.cream })
    this.app.ui.button('finish', { x: 260, y: 198, w: 120, h: 26 }, '回地图', () => {
      audio.sfx('click')
      this.app.send({ type: 'run.finishFlow' })
    }, { primary: true, small: true, disabled: this.app.busy })
  }

  private drawHoverTip(ui: G, text: TextLayer): void {
    if (!this.peek) return
    const a = this.actors.get(this.peek)
    if (!a) return
    drawTooltip(ui, text, cardDef(a.defId), a.x + 52, a.y - 10)
  }

  onCancel(): void { this.selected = null }
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t }
