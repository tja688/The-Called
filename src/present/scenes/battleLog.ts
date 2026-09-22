/**
 * 本场战报。只回放已经播过的战斗事件，按「谁做了什么、带出什么后果」收成可翻的记录。
 * 空收束、阶段切换、没变化的费用不进正文。
 */
import type { BattleEvent, Cause } from '../../domain/battle/events'
import { fictionName } from '../fiction'
import { audio } from '../../audio/audio'
import { PAL, rgba } from '../../pixel/palette'
import { panel } from '../../pixel/ui'
import type { UiKit } from '../../pixel/ui'
import type { TextLayer } from '../../pixel/text'

type G = CanvasRenderingContext2D

export interface LogLine {
  tone: 'turn' | 'you' | 'foe' | 'note' | 'end'
  text: string
  notes: string[]
}

interface Who {
  defId: string
  owner: 'player' | 'enemy'
}

interface Draft {
  tone: LogLine['tone']
  text: string
  notes: string[]
  /** 没有后果也保留，例如玩家出牌。 */
  keep: boolean
  /** 玩家这一下落空时写「没有打中」。敌人的空结算直接丢掉。 */
  miss: boolean
  actor: string | null
  whiffed: boolean
}

const PAGE = 13
const STEP = 5
const ROW = 15

export const BATTLE_LOG_PANEL = { x: 8, y: 50, w: 528, h: 308 }

export function foldBattleLog(events: BattleEvent[]): LogLine[] {
  return new Folder(events).run()
}

class Folder {
  private who = new Map<string, Who>()
  private cell = new Map<string, number>()
  private openingIds = new Set<string>()
  private lines: LogLine[] = []
  private draft: Draft | null = null
  private pendingHeader: string | null = null
  private mode: 'boot' | 'play' | 'turn' | 'section' = 'boot'
  /** 当前这一段的标题。和 pendingHeader 分开：标题画出后，同一段里的下一张牌还要接着写。 */
  private section: string | null = null
  private seenTurn = false
  private opening: string[] = []
  private explained = new Set<string>()
  private head: LogLine | null = null
  private tail: LogLine | null = null
  private lastOcc = -1
  private lastCap = -1

  constructor(private events: BattleEvent[]) {}

  run(): LogLine[] {
    this.index()
    for (const ev of this.events) this.feed(ev)
    this.flushOpening()
    this.close()
    return this.lines
  }

  private index(): void {
    let setup: { defId: string }[] = []
    for (const ev of this.events) {
      if (ev.type === 'battle.started') setup = ev.setup.map((s) => ({ cell: s.cell, defId: s.defId }))
      if (ev.type === 'battle.cardEntered' && !ev.cause && setup.length) {
        const slot = setup.shift()!
        this.learn(ev.card, slot.defId)
        this.openingIds.add(ev.card)
      } else if (ev.type === 'battle.cardEntered' && !this.who.has(ev.card)) {
        const id = ev.text.match(/(?:PC|EC)\.[A-Z0-9]+/)?.[0]
        if (id) this.learn(ev.card, id)
      }
      if (ev.type === 'battle.avatarDealt' || ev.type === 'battle.cardDrawn' || ev.type === 'battle.cardPlayed' || ev.type === 'battle.activated') {
        this.learn(ev.card, ev.defId)
      }
      if (ev.type === 'battle.cardRemoved' || ev.type === 'battle.effectResolved') this.learn(ev.card, ev.defId)
      if (ev.type === 'battle.turnStarted') {
        for (const t of ev.timers) this.learn(t.card, t.defId)
      }
      if (ev.type === 'battle.pointsChanged') {
        for (const a of ev.auras ?? []) this.learn(a.card, a.defId)
      }
      const cause = causeOf(ev)
      if (cause) this.learn(cause.actor, cause.defId)
    }
  }

  private learn(id: string, defId: string): void {
    if (!id || !defId) return
    this.who.set(id, { defId, owner: defId.startsWith('EC.') ? 'enemy' : 'player' })
  }

  private feed(ev: BattleEvent): void {
    if (!(ev.type === 'battle.cardDrawn' && !this.seenTurn)) this.flushOpening()
    switch (ev.type) {
      case 'battle.started': {
        const line: LogLine = {
          tone: 'turn',
          text: `开战 · ${fictionName(ev.encounterId)}`,
          notes: ev.setup.map((s) => `格${s.cell} ${fictionName(s.defId)} ${s.current}点`),
        }
        this.lines.push(line)
        this.head = line
        this.tail = line
        this.mode = 'boot'
        break
      }
      case 'battle.cardEntered':
        if (this.openingIds.has(ev.card) && !ev.cause) {
          this.cell.set(ev.card, ev.cell)
          break
        }
        if (ev.motion === 'place') {
          if (this.draft?.actor === ev.card) {
            this.cell.set(ev.card, ev.cell)
            break
          }
          const id = this.who.get(ev.card)?.defId
          this.add(`${id ? fictionName(id) : '一张牌'} 出现在格${ev.cell}`, ev.cause)
          this.cell.set(ev.card, ev.cell)
          break
        }
        {
          const from = ev.from ?? this.cell.get(ev.card)
          const self = ev.cause?.actor === ev.card
          const id = this.who.get(ev.card)?.defId
          const who = self || !id ? '' : `${fictionName(id)} `
          this.add(`${who}从格${from ?? '?'}走到格${ev.cell}`, ev.cause)
          this.cell.set(ev.card, ev.cell)
        }
        break
      case 'battle.avatarDealt':
        this.close()
        this.lines.push({ tone: 'you', text: `化身 ${fictionName(ev.defId)} 入手`, notes: [] })
        break
      case 'battle.cardDrawn':
        if (!this.seenTurn) this.opening.push(fictionName(ev.defId))
        else {
          this.close()
          this.lines.push({ tone: 'note', text: `抽到 ${fictionName(ev.defId)}`, notes: [] })
        }
        break
      case 'battle.turnStarted': {
        this.close()
        this.pendingHeader = null
        this.section = null
        this.mode = 'turn'
        this.seenTurn = true
        const bits = [`第${ev.turn}回合`]
        if (ev.won) bits.push('称重')
        else if (!ev.opening) bits.push(ev.leading ? '领先' : '落后')
        const notes = ev.timers.filter((t) => t.left > 0).map((t) => `${fictionName(t.defId)} 计时还剩 ${t.left}`)
        const line: LogLine = { tone: 'turn', text: bits.join(' · '), notes }
        this.lines.push(line)
        this.tail = line
        break
      }
      case 'battle.cardPlayed':
        if (ev.cell) this.cell.set(ev.card, ev.cell)
        this.beginPlay(
          ev.kind === 'spell' || !ev.cell ? `你 打出${fictionName(ev.defId)}` : `你 把${fictionName(ev.defId)}放到格${ev.cell}`,
          ev.card,
        )
        break
      case 'battle.activated':
        this.beginPlay(`你 发动${fictionName(ev.defId)}的主动`, ev.card)
        break
      case 'battle.cardCovered':
        if (ev.tied) {
          this.add(`${this.nameOf(ev.by)} 与 ${this.nameOf(ev.victim)} 平点，双方离场`)
          this.explained.add(ev.victim)
          this.explained.add(ev.by)
        } else {
          this.add(`${this.nameOf(ev.by)} 盖住 ${this.nameOf(ev.victim)}，扣掉 ${ev.victimPoints} 点`)
          this.explained.add(ev.victim)
        }
        break
      case 'battle.cardRemoved':
        if (this.explained.has(ev.card)) break
        if (ev.reason === 'cover' || ev.reason === 'tie') break
        this.add(
          ev.reason === 'stack' ? `${this.nameOf(ev.card)} 被叠掉`
            : ev.reason === 'link' ? `${this.nameOf(ev.card)} 被连锁带走`
              : ev.to === 'hand' ? `${this.nameOf(ev.card)} 回到手牌`
                : `${this.nameOf(ev.card)} 离场`,
          ev.cause,
        )
        break
      case 'battle.pointsChanged': {
        const body = pointsBody(ev, this.nameOf(ev.card))
        if (body) this.add(body, ev.cause)
        break
      }
      case 'battle.statusAdded':
        this.add(statusBody(ev.status, true, this.nameOf(ev.card)), ev.cause)
        break
      case 'battle.statusRemoved':
        if (!ev.cause && (ev.status === 'vulnerable' || ev.status === 'sealed')) {
          this.close()
          this.lines.push({ tone: 'note', text: statusBody(ev.status, false, this.nameOf(ev.card)), notes: [] })
          break
        }
        if (ev.status === 'rebirth') this.explained.add(ev.card)
        this.add(statusBody(ev.status, false, this.nameOf(ev.card)), ev.cause)
        break
      case 'battle.occupyChanged':
        this.onOccupy(ev)
        break
      case 'battle.resourceChanged':
        this.add(`圣油 ${ev.current}`, ev.cause)
        break
      case 'battle.effectResolved':
        this.follow({ actor: ev.card, defId: ev.defId, timing: ev.timing as Cause['timing'], op: ev.timing })
        if (!ev.hit && this.draft?.actor === ev.card && this.draft.notes.length === 0 && this.draft.miss) this.draft.whiffed = true
        break
      case 'battle.settled':
        this.close()
        this.pendingHeader = null
        this.lines.push({
          tone: 'end',
          text: `${ev.outcome === 'win' ? '胜利' : '失败'} · ${reasonWord(ev.reason)} · 化身代价 ${ev.avatarCost}`,
          notes: [],
        })
        break
      case 'battle.phaseChanged':
        break
    }
  }

  private onOccupy(ev: Extract<BattleEvent, { type: 'battle.occupyChanged' }>): void {
    if (ev.current === 0 && ev.cap === 0) {
      this.lastOcc = 0
      this.lastCap = 0
      return
    }
    if (ev.current === this.lastOcc && ev.cap === this.lastCap) return
    const spent = !ev.cause && this.lastOcc >= 0 && ev.current < this.lastOcc && ev.cap === this.lastCap
    const prev = this.lastOcc
    this.lastOcc = ev.current
    this.lastCap = ev.cap
    if (spent) return
    const text = !ev.cause && ev.current === ev.cap && prev >= 0 && ev.current >= prev
      ? `占领回满 ${ev.current}/${ev.cap}`
      : `占领 ${ev.current}/${ev.cap}`
    if (this.draft) this.note(text)
    else if (this.tail && (this.mode === 'turn' || this.mode === 'boot')) this.tail.notes.push(text)
    else this.lines.push({ tone: 'note', text, notes: [] })
  }

  private beginPlay(text: string, actor: string): void {
    this.close()
    this.pendingHeader = null
    this.section = null
    this.tail = null
    this.mode = 'play'
    this.draft = { tone: 'you', text, notes: [], keep: true, miss: true, actor, whiffed: false }
  }

  private follow(cause: Cause | undefined): void {
    if (!cause) return
    const sec = sectionOf(cause.timing)
    if (sec && this.section !== sec) {
      this.close()
      this.section = sec
      this.pendingHeader = sec
      this.mode = 'section'
      this.tail = null
    }
    const otherBeat = cause.timing === 'enter' || cause.timing === 'leave' || cause.timing === 'onCover'
    if ((sec || otherBeat) && this.draft?.actor !== cause.actor) {
      this.close()
      this.openActor(cause)
    }
  }

  private openActor(cause: Cause): void {
    const owner = this.who.get(cause.actor)?.owner ?? (cause.defId.startsWith('EC.') ? 'enemy' : 'player')
    this.draft = {
      tone: owner === 'enemy' ? 'foe' : 'you',
      text: `${owner === 'enemy' ? '敌' : '你'} ${this.nameOf(cause.actor)}`,
      notes: [],
      keep: false,
      miss: false,
      actor: cause.actor,
      whiffed: false,
    }
  }

  private add(body: string, cause?: Cause): void {
    this.follow(cause)
    if (this.draft) {
      const prefix = cause && this.draft.actor && cause.actor !== this.draft.actor ? `${fictionName(cause.defId)}：` : ''
      this.note(prefix + body)
      return
    }
    if (!cause && this.head && this.mode === 'boot') {
      this.head.notes.push(body)
      return
    }
    if (!cause && this.tail && this.mode === 'turn') {
      this.tail.notes.push(body)
      return
    }
    this.lines.push({ tone: 'note', text: body, notes: [] })
  }

  private note(text: string): void {
    if (!this.draft) return
    if (this.draft.notes[this.draft.notes.length - 1] === text) return
    this.draft.notes.push(text)
    this.draft.whiffed = false
  }

  private close(): void {
    const d = this.draft
    this.draft = null
    if (!d) return
    if (d.notes.length === 0 && d.whiffed && d.miss) d.notes.push('没有打中')
    if (d.notes.length === 0 && !d.keep) return
    if (this.pendingHeader) {
      this.lines.push({ tone: 'turn', text: this.pendingHeader, notes: [] })
      this.pendingHeader = null
    }
    this.lines.push({ tone: d.tone, text: d.text, notes: d.notes })
  }

  private flushOpening(): void {
    if (!this.opening.length) return
    this.lines.push({ tone: 'note', text: `起手 ${countNames(this.opening)}`, notes: [] })
    this.opening = []
  }

  private nameOf(id: string): string {
    const w = this.who.get(id)
    if (!w) return '未知的牌'
    const name = fictionName(w.defId)
    const cell = this.cell.get(id)
    return cell ? `${name}·格${cell}` : name
  }
}

function causeOf(ev: BattleEvent): Cause | undefined {
  return 'cause' in ev ? ev.cause : undefined
}

function sectionOf(timing: string): string | null {
  if (timing === 'turnEnd') return '回合结束时'
  if (timing === 'turnStart') return '回合开始时'
  if (timing === 'timer') return '计时走到头'
  return null
}

function reasonWord(reason: string): string {
  if (reason === 'lead') return '称重'
  if (reason === 'clear') return '清场'
  if (reason === 'avatarGone') return '化身离场'
  return '无牌可出'
}

function pointsBody(ev: Extract<BattleEvent, { type: 'battle.pointsChanged' }>, name: string): string | null {
  if (ev.source === 'lock') return null
  if (ev.source === 'aura') {
    const who = (ev.auras ?? []).map((a) => `${fictionName(a.defId)} ${a.n > 0 ? '+' : ''}${a.n}`).join('、')
    return who ? `驻场 ${who}，${name} ${ev.before}→${ev.after}` : `驻场重算，${name} ${ev.before}→${ev.after}`
  }
  if (ev.source === 'map') return `${ev.mapEffect ? fictionName(ev.mapEffect) : '地图'}，${name} ${ev.before}→${ev.after}`
  if (ev.source === 'relic') return `遗物，${name} ${ev.before}→${ev.after}`
  const delta = ev.after - ev.before
  const sign = delta > 0 ? `+${delta}` : String(delta)
  let s = `${name} ${ev.before}→${ev.after}（${sign}）`
  if (ev.vulnerableBonus && ev.vulnerableBonus > 0) s += `，易伤多 ${ev.vulnerableBonus} 点`
  return s
}

function statusBody(status: string, add: boolean, name: string): string {
  if (!add && status === 'protected') return `${name} 的保护挡住了`
  if (!add && status === 'vulnerable') return `${name} 易伤消退`
  if (!add && status === 'sealed') return `${name} 解封，重新计入总点`
  if (!add && status === 'marked') return `${name} 猎印被揭掉`
  if (!add && status === 'rebirth') return `${name} 返魂，回到手牌`
  if (add && status === 'marked') return `${name} 被印上猎印`
  if (add && status === 'vulnerable') return `${name} 易伤`
  if (add && status === 'sealed') return `${name} 被封印，暂不计入总点`
  if (add && status === 'protected') return `${name} 获得保护`
  if (add && status === 'rebirth') return `${name} 获得返魂`
  return `${name} ${add ? '得到' : '失去'}状态`
}

function countNames(names: string[]): string {
  const order: string[] = []
  const count = new Map<string, number>()
  for (const n of names) {
    if (!count.has(n)) order.push(n)
    count.set(n, (count.get(n) ?? 0) + 1)
  }
  return order.map((n) => (count.get(n)! > 1 ? `${n}×${count.get(n)}` : n)).join('、')
}

interface Row { text: string; tone: LogLine['tone']; indent: boolean }

function flatten(lines: LogLine[]): Row[] {
  const rows: Row[] = []
  for (const ln of lines) {
    rows.push({ text: ln.text, tone: ln.tone, indent: false })
    for (const n of ln.notes) rows.push({ text: n, tone: 'note', indent: true })
  }
  return rows
}

export class BattleLog {
  open = false
  private events: BattleEvent[] = []
  private scroll = 0
  private stick = true

  push(ev: BattleEvent): void {
    this.events.push(ev)
  }

  toggle(): void {
    this.open = !this.open
    if (this.open) this.stick = true
  }

  close(): void {
    this.open = false
  }

  nudge(dir: -1 | 1): void {
    const total = flatten(foldBattleLog(this.events)).length
    const max = Math.max(0, total - PAGE)
    const base = this.stick ? max : this.scroll
    const next = Math.max(0, Math.min(max, base + dir * STEP))
    this.scroll = next
    this.stick = next >= max
  }

  draw(g: G, text: TextLayer, ui: UiKit): void {
    if (!this.open) return
    const box = BATTLE_LOG_PANEL
    const rows = flatten(foldBattleLog(this.events))
    const max = Math.max(0, rows.length - PAGE)
    if (this.stick) this.scroll = max
    else this.scroll = Math.max(0, Math.min(this.scroll, max))

    const veilH = 316
    g.fillStyle = rgba(PAL.shadow, 0.5)
    g.fillRect(0, 44, box.x + box.w + 8, veilH)
    text.occlude(0, 44, box.x + box.w + 8, veilH)
    panel(g, box.x, box.y, box.w, box.h, 'paper')
    ui.hit('battle-log-shield', { x: 0, y: 44, w: box.x + box.w + 8, h: veilH }, () => {}, 40)

    text.draw('本场记录', box.x + 12, box.y + 8, { size: 13, bold: true, color: PAL.ink })
    text.draw(rows.length ? `共 ${rows.length} 条` : '还没有结算', box.x + box.w - 12, box.y + 10, {
      size: 10, align: 'right', color: PAL.wood1,
    })
    g.fillStyle = PAL.paperD
    g.fillRect(box.x + 8, box.y + 26, box.w - 16, 1)

    const listX = box.x + 12
    const listY = box.y + 32
    const listW = box.w - 28
    if (!rows.length) {
      text.draw('开战之后，这里按顺序记下出牌、走位和效果。', listX, listY + 8, {
        size: 11, color: PAL.ink2, maxWidth: listW,
      })
    }
    const start = this.scroll
    for (let i = 0; i < PAGE; i++) {
      const row = rows[start + i]
      if (!row) break
      const y = listY + i * ROW
      const color = row.tone === 'you' ? PAL.leaf
        : row.tone === 'foe' ? PAL.redD
          : row.tone === 'end' ? PAL.ink
            : row.tone === 'turn' ? PAL.wood1
              : PAL.ink2
      if (!row.indent && (row.tone === 'you' || row.tone === 'foe' || row.tone === 'end')) {
        g.fillStyle = row.tone === 'foe' ? PAL.redD : row.tone === 'end' ? PAL.lamp2 : PAL.leaf
        g.fillRect(listX, y + 3, 2, 8)
      }
      const x = listX + (row.indent ? 14 : 8)
      text.draw(row.indent ? `· ${row.text}` : row.text, x, y, {
        size: row.indent ? 10 : row.tone === 'turn' || row.tone === 'end' ? 12 : 11,
        bold: !row.indent && row.tone !== 'note',
        color,
        maxWidth: listW - (row.indent ? 14 : 8),
      })
    }
    if (max > 0) {
      const thumbH = Math.max(10, Math.round((PAGE / rows.length) * (PAGE * ROW)))
      const travel = PAGE * ROW - thumbH
      const thumbY = listY + Math.round(travel * (max === 0 ? 0 : this.scroll / max))
      g.fillStyle = PAL.paperD
      g.fillRect(box.x + box.w - 10, listY, 2, PAGE * ROW)
      g.fillStyle = PAL.wood2
      g.fillRect(box.x + box.w - 10, thumbY, 2, thumbH)

      const footY = box.y + box.h - 28
      ui.button('battle-log-up', { x: box.x + 12, y: footY, w: 72, h: 20 }, '上一段', () => {
        audio.sfx('click')
        this.nudge(-1)
      }, { small: true, disabled: this.scroll <= 0, z: 56 })
      ui.button('battle-log-down', { x: box.x + box.w - 84, y: footY, w: 72, h: 20 }, '下一段', () => {
        audio.sfx('click')
        this.nudge(1)
      }, { small: true, disabled: this.scroll >= max, z: 56 })
      const from = this.scroll + 1
      const to = Math.min(rows.length, this.scroll + PAGE)
      text.draw(`${from}–${to} / ${rows.length}`, box.x + box.w / 2, footY + 4, {
        size: 10, align: 'center', color: PAL.wood1,
      })
    }
  }
}
