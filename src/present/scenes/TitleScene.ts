import { Scene } from '../Scene'
import type { TextLayer } from '../../pixel/text'
import { PAL, rgba, SCHOOL_COLOR } from '../../pixel/palette'
import { Scenery, GROUND_Y } from '../../pixel/scenery'
import { ASSETS } from '../../pixel/assets'
import { blit, drawSprite, type Baked } from '../../pixel/dsl'
import { audio } from '../../audio/audio'
import { avatarSpriteId, DECK_BLURB, emphasizeKeywords, fictionName, KIND_NAME, RARITY_NAME } from '../fiction'
import { cardFrame, panel } from '../../pixel/ui'
import { startingDeck } from '../../content/decks'
import type { DeckId } from '../../domain/types'
import type { CardDef } from '../../content/cards'
import {
  paintDeckCard,
  paintGateShaft,
  paintMenuButton,
  paintMenuCursor,
  paintMenuLights,
  type MenuIcon,
} from '../menuPaint'

type Mode = 'menu' | 'deck'
type Overlay = 'none' | 'settings' | 'quit'

interface MenuRow {
  id: 'start' | 'settings' | 'help' | 'quit'
  label: string
  icon: MenuIcon
  x: number
  y: number
  w: number
  h: number
  primary?: boolean
}

const MENU: MenuRow[] = [
  { id: 'start', label: '开始游戏', icon: 'start', x: 392, y: 108, w: 220, h: 46, primary: true },
  { id: 'settings', label: '设置', icon: 'settings', x: 404, y: 164, w: 208, h: 36 },
  { id: 'help', label: '教程', icon: 'help', x: 404, y: 208, w: 208, h: 36 },
  { id: 'quit', label: '退出游戏', icon: 'quit', x: 404, y: 252, w: 208, h: 36 },
]

const DECKS: { id: DeckId; school: string; who: string }[] = [
  { id: 'DK.A', school: 'SYS.A', who: 'PC.A00' },
  { id: 'DK.B', school: 'SYS.B', who: 'PC.B00' },
  { id: 'DK.C', school: 'SYS.C', who: 'PC.C00' },
]

const CARD_W = 184
const CARD_H = 122
const CARD_Y = 36

const PILE_W = 56
const PILE_H = 86
const PILE_GAP = 4
const PILE_Y = 192

function cardX(i: number): number {
  return 30 + i * (CARD_W + 14)
}

function paintPileCard(
  ui: CanvasRenderingContext2D,
  text: TextLayer,
  def: CardDef,
  x: number,
  y: number,
  w: number,
  h: number,
  hot: boolean,
): void {
  const edge = def.kind === 'spell' ? PAL.sig : (SCHOOL_COLOR[def.school] ?? PAL.stoneL)
  cardFrame(ui, x, y, w, h, edge, PAL.paper, { selected: hot })
  const icon = ASSETS.card(def.id)
  blit(ui, icon, x + Math.round((w - icon.width) / 2), y + 6)
  text.draw(fictionName(def.id), x + w / 2, y + 32, {
    size: 11, align: 'center', color: PAL.ink, bold: true, maxWidth: w - 8,
  })
  const sub = def.kind === 'spell' ? '法术' : `${def.basePoints}点`
  text.draw(`${sub} · ${def.cost}费`, x + w / 2, y + h - 16, {
    size: 9, align: 'center', color: PAL.wood1, maxWidth: w - 6,
  })
}

/** 卡组下方的效果条。只占牌列下面的空档，不盖住其他牌，方便接着指下一张。 */
function paintPileTip(ui: CanvasRenderingContext2D, text: TextLayer, def: CardDef): void {
  const iw = 600
  const body = emphasizeKeywords(def.text)
  const lines = text.wrapRich(body, iw - 16, 10).slice(0, 2)
  const ih = 38 + Math.max(1, lines.length) * 14
  const ix = Math.round((640 - iw) / 2)
  const iy = PILE_Y + PILE_H + 4
  text.occlude(ix, iy, iw, ih)
  panel(ui, ix, iy, iw, ih, 'paper')
  const kind = KIND_NAME[def.kind] ?? def.kind
  const rare = RARITY_NAME[def.rarity] ?? ''
  const meta = def.kind === 'spell'
    ? `${kind} · ${def.cost}费 · ${rare}`
    : `${kind} · ${def.basePoints}点 · ${def.cost}费 · ${rare}`
  text.draw(fictionName(def.id), ix + 8, iy + 6, { size: 12, bold: true, color: PAL.ink, maxWidth: 160 })
  text.draw(meta, ix + 168, iy + 8, { size: 10, color: PAL.wood1, maxWidth: iw - 180 })
  lines.forEach((ln, i) => text.rich(ln, ix + 8, iy + 24 + i * 14, { size: 10, color: PAL.ink2, hl: PAL.blueD }))
}

/** 锚点到不透明脚底的距离。立绘脚底以上有空行，不补上的话人会悬在影子上。 */
const footInsetCache = new Map<string, number>()
function footInset(sprite: Baked): number {
  const cached = footInsetCache.get(sprite.def.id)
  if (cached !== undefined) return cached
  const src = sprite.still
  const g = src.getContext('2d')
  let inset = 0
  if (g) {
    const { data, width, height } = g.getImageData(0, 0, src.width, src.height)
    for (let y = height - 1; y >= 0; y--) {
      let opaque = false
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 16) { opaque = true; break }
      }
      if (opaque) {
        inset = sprite.anchor[1] - (y + 1)
        break
      }
    }
  }
  if (inset < 0) inset = 0
  footInsetCache.set(sprite.def.id, inset)
  return inset
}

/** 待机第 2 帧整个人下移 1 像素。补回去，脚才一直踩在影子上。 */
function idleDrop(t: number): number {
  const seq = [0, 1, 0, 2]
  return seq[Math.floor(t * 3) % seq.length] === 1 ? 1 : 0
}

function paintFootShadow(g: CanvasRenderingContext2D, sprite: Baked, x: number, groundY: number, scale: number): void {
  const bottom = sprite.anchor[1] - footInset(sprite)
  g.save()
  g.translate(Math.round(x), Math.round(groundY + 1))
  g.globalAlpha = 0.62
  g.scale(scale * 0.92, scale * 0.18)
  g.drawImage(sprite.shadow, -sprite.anchor[0], -bottom)
  g.restore()
}

function paintPlanted(
  g: CanvasRenderingContext2D,
  sprite: Baked,
  x: number,
  groundY: number,
  scale: number,
  t: number,
): void {
  const inset = footInset(sprite) - idleDrop(t)
  paintFootShadow(g, sprite, x, groundY, scale)
  drawSprite(g, sprite, x, groundY + inset * scale, {
    anim: 'idle',
    t,
    shadow: false,
    scale,
  })
}

export class TitleScene extends Scene {
  readonly name = 'title' as const
  private scenery = new Scenery('gate')
  private t = 0
  private deckId: DeckId = 'DK.A'
  private mode: Mode = 'menu'
  private focus = 0
  private overlay: Overlay = 'none'
  private quitPick = 0
  /** 点角色后问要不要开始。0 开始，1 再看看。 */
  private confirm = false
  private confirmPick = 0
  /** 切入选角色后的一小段时间不吃 Enter，避免按键连发直接弹出确认。 */
  private deckArm = 0
  /** 一次确认后短暂忽略下一次 Enter，按键连发不会把刚打开的层立刻关掉或跳过。 */
  private confirmArm = 0
  private seenHover: string | null = null
  /** 刚进入选角色时指针还停在「开始游戏」上，先别把那一格当成选中。 */
  private deckHold: { x: number; y: number } | null = null

  enter(): void {
    audio.atmosphere(null)
  }

  update(dt: number): void {
    this.t += dt
    const hover = this.app.input.hover
    if (this.deckArm > 0) this.deckArm = Math.max(0, this.deckArm - dt)
    if (this.confirmArm > 0) this.confirmArm = Math.max(0, this.confirmArm - dt)
    if (this.confirm) {
      if (hover === 'start-yes') this.confirmPick = 0
      else if (hover === 'start-no') this.confirmPick = 1
    }
    if (hover !== this.seenHover) {
      this.seenHover = hover
      if (this.mode === 'menu' && this.overlay === 'none') {
        const i = MENU.findIndex((row) => hover === `menu-${row.id}`)
        if (i >= 0) this.focus = i
      }
      if (this.mode === 'deck' && !this.confirm) {
        const hold = this.deckHold
        if (hold && Math.hypot(this.app.input.x - hold.x, this.app.input.y - hold.y) < 6) {
          /* 指针还没动 */
        } else {
          this.deckHold = null
          for (const d of DECKS) {
            if (hover === `role-${d.id}`) this.chooseDeck(d.id, true)
          }
        }
      }
    }
  }

  render(world: CanvasRenderingContext2D, ui: CanvasRenderingContext2D, text: TextLayer): void {
    this.scenery.drawBack(world, 48, this.t)
    paintGateShaft(world, this.t)
    this.scenery.drawFront(world, 48, this.t)
    if (this.mode === 'menu') this.drawParty(world)
    const row = this.mode === 'menu' ? MENU[this.focus] : undefined
    const deckI = DECKS.findIndex((d) => d.id === this.deckId)
    const glowAt = row
      ? { x: row.x + row.w / 2, y: row.y + row.h / 2 }
      : deckI >= 0
        ? { x: cardX(deckI) + CARD_W / 2, y: CARD_Y + 36 }
        : undefined
    paintMenuLights(world, this.t, glowAt)

    if (this.mode === 'menu') this.drawMenu(ui, text)
    else this.drawDeck(world, ui, text)
  }

  onConfirm(): void {
    if (this.confirmArm > 0) return
    if (this.overlay === 'settings') {
      this.overlay = 'none'
      return
    }
    if (this.overlay === 'quit') {
      if (this.quitPick === 0) this.overlay = 'none'
      else this.doQuit()
      return
    }
    if (this.confirm) {
      if (this.confirmPick === 0) this.startRun()
      else this.confirm = false
      return
    }
    if (this.mode === 'deck') {
      if (this.deckArm <= 0) this.openConfirm()
      return
    }
    this.activate(MENU[this.focus].id)
  }

  onCancel(): boolean {
    if (this.confirm) {
      this.confirm = false
      return true
    }
    if (this.overlay !== 'none') {
      this.overlay = 'none'
      return true
    }
    if (this.mode === 'deck') {
      this.mode = 'menu'
      return true
    }
    return true
  }

  onKey(k: string): void {
    if (this.overlay === 'quit') {
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'a' || k === 'd') this.quitPick = this.quitPick ? 0 : 1
      return
    }
    if (this.overlay === 'settings') return
    if (this.confirm) {
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'a' || k === 'd' || k === 'A' || k === 'D') {
        this.confirmPick = this.confirmPick ? 0 : 1
      }
      return
    }
    if (this.mode === 'deck') {
      if (k === '1') this.chooseDeck('DK.A', true)
      else if (k === '2') this.chooseDeck('DK.B', true)
      else if (k === '3') this.chooseDeck('DK.C', true)
      else if (k === 'ArrowLeft' || k === 'a' || k === 'A') this.stepDeck(-1)
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') this.stepDeck(1)
      return
    }
    if (k === 'ArrowUp' || k === 'w' || k === 'W') this.focus = (this.focus + MENU.length - 1) % MENU.length
    if (k === 'ArrowDown' || k === 's' || k === 'S') this.focus = (this.focus + 1) % MENU.length
  }

  private chooseDeck(id: DeckId, sound: boolean): void {
    if (this.deckId === id) return
    this.deckId = id
    if (sound) audio.sfx('click')
  }

  private stepDeck(dir: number): void {
    const i = DECKS.findIndex((d) => d.id === this.deckId)
    const next = DECKS[(i + dir + DECKS.length) % DECKS.length]
    this.chooseDeck(next.id, true)
  }

  private activate(id: MenuRow['id']): void {
    audio.sfx('click')
    this.confirmArm = 0.4
    if (id === 'start') {
      this.mode = 'deck'
      this.deckArm = 0.45
      this.confirm = false
      this.deckHold = { x: this.app.input.x, y: this.app.input.y }
    }
    else if (id === 'settings') this.overlay = 'settings'
    else if (id === 'help') this.app.shell.openHelp('none')
    else {
      this.quitPick = 0
      this.overlay = 'quit'
    }
  }

  private openConfirm(): void {
    this.confirm = true
    this.confirmPick = 0
    this.confirmArm = 0.35
    audio.sfx('click')
  }

  private startRun(): void {
    audio.sfx('click')
    this.app.send({ type: 'run.start', deckId: this.deckId })
  }

  private doQuit(): void {
    audio.sfx('click')
    window.close()
    window.setTimeout(() => {
      this.app.toast('窗口还在。直接关掉这个页面即可。')
    }, 280)
  }

  private drawParty(world: CanvasRenderingContext2D): void {
    const spots = [168, 252, 336]
    const scale = 3.6
    spots.forEach((x, i) => {
      const sprite = ASSETS.sprite(avatarSpriteId(DECKS[i].who))
      if (!sprite) return
      paintPlanted(world, sprite, x, GROUND_Y, scale, this.t + i * 0.4)
    })
  }

  private drawMenu(ui: CanvasRenderingContext2D, text: TextLayer): void {
    text.draw('TheCall', 32, 16, {
      size: 40, bold: true, color: PAL.lamp1, stroke: PAL.ink, strokeWidth: 5, shadow: true,
    })
    text.draw('地下城冒险', 34, 60, {
      size: 18, bold: true, color: PAL.cream, stroke: PAL.ink, strokeWidth: 3,
    })
    ui.fillStyle = PAL.copper
    ui.fillRect(34, 86, 148, 1)
    ui.fillStyle = PAL.lamp1
    ui.fillRect(34, 86, 36, 1)

    MENU.forEach((row, i) => {
      const hot = i === this.focus && this.overlay === 'none'
      const pressed = hot && this.app.input.isPressed(`menu-${row.id}`)
      if (hot) paintMenuCursor(ui, row.x - 22, row.y + row.h / 2, this.t)
      const at = paintMenuButton(ui, row.x, row.y, row.w, row.h, {
        icon: row.icon,
        primary: row.primary,
        hot,
        pressed,
      })
      text.draw(row.label, at.x, at.y, {
        size: row.primary ? 16 : 14,
        bold: true,
        align: 'left',
        baseline: 'middle',
        color: PAL.ink,
      })
      if (this.overlay === 'none') {
        this.app.ui.hit(`menu-${row.id}`, { x: row.x, y: row.y, w: row.w, h: row.h }, () => this.activate(row.id), 12)
      }
    })

    if (this.overlay === 'none') return

    text.occlude(0, 0, 640, 360)
    ui.fillStyle = rgba(PAL.shadow, 0.66)
    ui.fillRect(0, 0, 640, 360)
    this.app.ui.hit('ov-block', { x: 0, y: 0, w: 640, h: 360 }, () => { this.overlay = 'none' }, 40)
    if (this.overlay === 'settings') this.drawSettings(ui, text)
    else this.drawQuit(ui, text)
  }

  private drawSettings(ui: CanvasRenderingContext2D, text: TextLayer): void {
    const x = 168, y = 84, w = 304, h = 176
    this.app.ui.hit('ov-panel', { x, y, w, h }, () => {}, 45, 'default')
    panel(ui, x, y, w, h, 'stone')
    text.draw('设置', x + w / 2, y + 16, { size: 18, bold: true, align: 'center', color: PAL.lamp1 })
    text.draw('音效', x + 28, y + 58, { size: 14, color: PAL.cream, baseline: 'middle' })
    const on = !audio.muted
    this.app.ui.button('set-audio', { x: x + 148, y: y + 44, w: 124, h: 30 }, on ? '开着' : '关着', () => {
      audio.sfx('click')
      audio.toggle()
    }, { primary: on, z: 50 })
    text.draw('M 键同样能开关', x + w / 2, y + 96, { size: 11, align: 'center', color: PAL.gray3 })
    this.app.ui.button('set-done', { x: x + 88, y: y + h - 46, w: 128, h: 30 }, '完成', () => {
      audio.sfx('click')
      this.overlay = 'none'
    }, { primary: true, z: 50 })
  }

  private drawQuit(ui: CanvasRenderingContext2D, text: TextLayer): void {
    const x = 170, y = 104, w = 300, h = 140
    this.app.ui.hit('ov-panel', { x, y, w, h }, () => {}, 45, 'default')
    panel(ui, x, y, w, h, 'stone')
    text.draw('退出游戏？', x + w / 2, y + 18, { size: 16, bold: true, align: 'center', color: PAL.lamp1 })
    text.draw('窗口会关掉。', x + w / 2, y + 48, { size: 12, align: 'center', color: PAL.cream })
    const stayHot = this.quitPick === 0
    const quitHot = this.quitPick === 1
    this.app.ui.button('quit-stay', { x: x + 24, y: y + h - 48, w: 116, h: 30 }, '留下', () => {
      audio.sfx('click')
      this.overlay = 'none'
    }, { primary: stayHot, z: 50 })
    this.app.ui.button('quit-go', { x: x + w - 140, y: y + h - 48, w: 116, h: 30 }, '退出', () => this.doQuit(), {
      danger: quitHot, z: 50,
    })
  }

  private drawDeck(world: CanvasRenderingContext2D, ui: CanvasRenderingContext2D, text: TextLayer): void {
    text.draw('选择角色', 320, 12, {
      size: 22, bold: true, align: 'center', color: PAL.lamp1, stroke: PAL.ink, strokeWidth: 4,
    })

    if (!this.confirm) {
      this.app.ui.button('deck-back', { x: 16, y: 12, w: 72, h: 26 }, '返回', () => {
        audio.sfx('click')
        this.confirm = false
        this.mode = 'menu'
      }, { small: true, z: 12 })
    }

    DECKS.forEach((d, i) => {
      const x = cardX(i)
      const hot = this.deckId === d.id
      const color = SCHOOL_COLOR[d.school] ?? PAL.gold
      const top = paintDeckCard(ui, { x, y: CARD_Y, hot, color }, CARD_W, CARD_H)
      if (hot) {
        const pulse = 0.4 + 0.15 * Math.sin(this.t * 3)
        world.save()
        world.globalCompositeOperation = 'screen'
        world.fillStyle = rgba(color, pulse)
        world.fillRect(x + 8, top - 6, CARD_W - 16, 4)
        world.restore()
      }
      const school = fictionName(d.school)
      const hero = fictionName(d.who)
      if (school !== hero) {
        text.draw(school, x + 12, top + 16, {
          size: 11, bold: true, color: hot ? color : PAL.gray3,
        })
      }
      text.draw(String(i + 1), x + CARD_W - 16, top + 14, {
        size: 12, bold: true, align: 'center', color: hot ? PAL.lamp1 : PAL.gray2,
      })
      const sprite = ASSETS.sprite(avatarSpriteId(d.who))
      const ground = top + CARD_H - 28
      if (sprite) {
        ui.fillStyle = rgba(PAL.ink, 0.45)
        ui.fillRect(x + 28, ground, CARD_W - 56, 2)
        paintPlanted(ui, sprite, x + CARD_W / 2, ground, hot ? 3.3 : 2.8, this.t + i)
      }
      text.draw(hero, x + CARD_W / 2, top + CARD_H - 18, {
        size: 14, bold: true, align: 'center', color: hot ? PAL.cream : PAL.gray3,
        stroke: PAL.ink, strokeWidth: 3,
      })
      if (!hot) {
        ui.fillStyle = rgba(PAL.shadow, 0.16)
        ui.fillRect(x + 3, top + 3, CARD_W - 6, CARD_H - 6)
      }
      this.app.ui.hit(`role-${d.id}`, { x, y: top, w: CARD_W, h: CARD_H }, () => {
        this.deckId = d.id
        this.openConfirm()
      }, 12)
    })

    text.draw(DECK_BLURB[this.deckId] ?? '', 320, 174, {
      size: 11, align: 'center', color: PAL.cream, stroke: PAL.ink, strokeWidth: 3, maxWidth: 600,
    })

    const cards = startingDeck(this.deckId).cards
    const total = cards.length * PILE_W + Math.max(0, cards.length - 1) * PILE_GAP
    const x0 = Math.round((640 - total) / 2)
    let hoverDef: string | undefined
    cards.forEach((defId, i) => {
      const hot = this.app.input.isHover(`pile-${i}`)
      const x = x0 + i * (PILE_W + PILE_GAP)
      const y = PILE_Y - (hot ? 6 : 0)
      const def = this.app.ask({ type: 'content.card', defId })
      paintPileCard(ui, text, def, x, y, PILE_W, PILE_H, hot)
      this.app.ui.hit(`pile-${i}`, { x, y: PILE_Y - 6, w: PILE_W, h: PILE_H + 6 }, () => {}, 14)
      if (hot) hoverDef = defId
    })

    if (hoverDef && !this.confirm) {
      const def = this.app.ask({ type: 'content.card', defId: hoverDef })
      paintPileTip(ui, text, def)
    }

    if (this.confirm) this.drawConfirm(ui, text)
  }

  private drawConfirm(ui: CanvasRenderingContext2D, text: TextLayer): void {
    const who = DECKS.find((d) => d.id === this.deckId)?.who ?? 'PC.A00'
    const name = fictionName(who)
    const x = 156, y = 96, w = 328, h = 148
    text.occlude(0, 0, 640, 360)
    ui.fillStyle = rgba(PAL.shadow, 0.66)
    ui.fillRect(0, 0, 640, 360)
    this.app.ui.hit('ov-block', { x: 0, y: 0, w: 640, h: 360 }, () => { this.confirm = false }, 40)
    this.app.ui.hit('ov-panel', { x, y, w, h }, () => {}, 45, 'default')
    panel(ui, x, y, w, h, 'stone')
    text.draw('开始游戏？', x + w / 2, y + 18, { size: 16, bold: true, align: 'center', color: PAL.lamp1 })
    text.draw(`以${name}进入地下城。`, x + w / 2, y + 52, { size: 13, align: 'center', color: PAL.cream })
    this.app.ui.button('start-no', { x: x + 28, y: y + h - 48, w: 124, h: 30 }, '再看看', () => {
      audio.sfx('click')
      this.confirm = false
    }, { primary: this.confirmPick === 1, z: 50 })
    this.app.ui.button('start-yes', { x: x + w - 152, y: y + h - 48, w: 124, h: 30 }, '开始', () => this.startRun(), {
      primary: this.confirmPick === 0, z: 50,
    })
  }
}
