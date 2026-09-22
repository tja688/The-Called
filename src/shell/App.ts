import type { GameService } from '../application/GameService'
import type { BattleView } from '../application/readmodels/BattleView'
import type { RunView } from '../application/readmodels/RunView'
import type { LegalPlay } from '../domain/battle/BattleAggregate'
import type { Cell } from '../domain/geometry'
import { cardName } from '../content/cards'
import type { DomainEvent } from '../core/messages'
import type { DeckId } from '../domain/types'

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, string | boolean | undefined> = {},
  kids: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === false) continue
    if (k === 'class') node.className = String(v)
    else if (k === 'disabled') (node as HTMLButtonElement).disabled = true
    else node.setAttribute(k, String(v))
  }
  for (const kid of kids) node.append(kid)
  return node
}

export class App {
  private selected: string | null = null
  private err = ''
  private seed = '1'
  private deckId: DeckId = 'DK.A'
  private eventUid?: string

  constructor(private game: GameService) {
    game.on('*', () => this.render())
    this.render()
  }

  private async send(cmd: Parameters<GameService['dispatch']>[0]): Promise<void> {
    this.err = ''
    try {
      await this.game.dispatch(cmd)
    } catch (e) {
      this.err = e instanceof Error ? e.message : String(e)
      this.render()
    }
  }

  render(): void {
    const root = document.getElementById('app')!
    root.replaceChildren()
    const run = this.game.ask({ type: 'run.view' })
    const shell = el('div', { class: 'shell' })
    shell.append(this.header(run), this.body(run), this.footer())
    root.append(shell)
  }

  private header(run: RunView | null): HTMLElement {
    const bar = el('header', {}, [
      el('div', { class: 'row' }, [
        el('h1', {}, ['The Called · 规则白模']),
        run
          ? el('span', { class: 'stat' }, [`血 ${run.hp}/${run.hpMax}`, ' · ', `${run.gold}金`, ' · ', run.floorEffect, ' · ', `种子 ${run.seed}`])
          : el('span', { class: 'muted' }, ['未开局']),
      ]),
    ])
    if (this.err) bar.append(el('div', { class: 'err' }, [this.err]))
    return bar
  }

  private footer(): HTMLElement {
    return el('footer', {}, ['控制台 called.game.dispatch / ask。?present=dom 白模。'])
  }

  private body(run: RunView | null): HTMLElement {
    const main = el('main')
    if (!run) main.append(this.boot())
    else if (run.screen === 'over') main.append(this.over(run))
    else if (run.screen === 'map') main.append(this.map(run))
    else if (run.screen === 'event') main.append(this.event(run))
    else if (run.screen === 'reward') main.append(this.reward(run))
    else if (run.screen === 'shop') main.append(this.shop(run))
    else if (run.screen === 'rest') main.append(this.rest())
    else if (run.screen === 'forge') main.append(this.forge(run))
    else if (run.screen === 'chest') main.append(this.chest(run))
    else if (run.screen === 'battle') main.append(this.battle())
    main.append(this.log())
    return main
  }

  private boot(): HTMLElement {
    const seed = el('input', { value: this.seed }) as HTMLInputElement
    seed.style.width = '80px'
    seed.oninput = () => { this.seed = seed.value }
    const row = el('div', { class: 'row' }, [el('span', {}, ['种子']), seed])
    for (const id of ['DK.A', 'DK.B', 'DK.C'] as DeckId[]) {
      const b = el('button', { class: this.deckId === id ? 'primary' : '' }, [id])
      b.onclick = () => { this.deckId = id; this.render() }
      row.append(b)
    }
    const go = el('button', { class: 'primary' }, ['开一趟'])
    go.onclick = () => {
      const n = Number(this.seed)
      void this.send({ type: 'run.start', seed: Number.isFinite(n) ? n : undefined, deckId: this.deckId })
    }
    row.append(go)
    return row
  }

  private map(run: RunView): HTMLElement {
    const nodes = el('div', { class: 'nodes' })
    if (run.availableNodes.includes('hub')) {
      const back = el('button', { class: 'node go' }, ['入口 (0,0)', el('div', { class: 'muted' }, ['可回'])])
      back.onclick = () => void this.send({ type: 'run.enterNode', node: 'hub' })
      nodes.append(back)
    }
    for (const n of run.nodes) {
      const can = n.adjacent
      const box = el('button', { class: `node${can ? ' go' : ''}${n.completed ? ' done' : ''}`, disabled: can ? undefined : true }, [
        `${n.label} (${n.x},${n.y})`,
        el('div', { class: 'muted' }, [n.current ? '所在' : can ? '可进' : n.completed ? '已过' : '迷雾']),
      ])
      if (can) box.onclick = () => void this.send({ type: 'run.enterNode', node: n.id })
      nodes.append(box)
    }
    const box = el('div', { class: 'box' })
    for (const c of run.boxCards) {
      const inDeck = run.deck.includes(c.uid)
      const chip = el('button', { class: `chip${inDeck ? ' in' : ''}` }, [`${cardName(c.defId)}${c.baseBonus ? `+${c.baseBonus}` : ''}${inDeck ? ' · 组' : ''}`])
      chip.onclick = () => {
        const next = [...run.deck]
        if (inDeck) {
          if (c.negative) return
          const i = next.indexOf(c.uid)
          if (i >= 0) next.splice(i, 1)
        } else next.push(c.uid)
        void this.send({ type: 'run.setDeck', deck: next })
      }
      box.append(chip)
    }
    const n04 = el('button', {}, ['+PC.N04'])
    n04.onclick = () => void this.send({ type: 'run.setDeck', deck: [...run.deck, 'PC.N04'] })
    const abandon = el('button', { class: 'warn' }, ['放弃'])
    abandon.onclick = () => void this.send({ type: 'run.abandon' })
    return el('div', {}, [
      el('p', { class: 'muted' }, [`第 1 层。${run.floorEffect}。遗物 ${run.relics.join('、') || '无'}。牌组 ${run.deck.length}/10+`]),
      nodes,
      el('p', {}, ['卡盒（点一下编入/移出）']),
      box,
      el('p', {}, [n04, abandon]),
    ])
  }

  private event(run: RunView): HTMLElement {
    const wrap = el('div', { class: 'opts' }, [el('h2', {}, [run.event?.name ?? '事件'])])
    if (run.event?.options.some((o) => o.needsCard)) {
      const row = el('div', { class: 'row' })
      for (const c of run.boxCards) {
        const b = el('button', { class: this.eventUid === c.uid ? 'primary' : '' }, [c.defId])
        b.onclick = () => { this.eventUid = c.uid; this.render() }
        row.append(b)
      }
      wrap.append(row)
    }
    for (const opt of run.event?.options ?? []) {
      const b = el('button', { class: `opt${run.event?.chosen === opt.index ? ' sel' : ''}` }, [`${opt.label} — ${opt.text}`])
      b.disabled = run.event?.chosen !== undefined || !opt.enabled
      b.onclick = () => void this.send({ type: 'run.eventOption', index: opt.index, cardUid: this.eventUid })
      wrap.append(b)
    }
    const done = el('button', { class: 'primary' }, ['回地图'])
    done.disabled = run.event?.chosen === undefined
    done.onclick = () => void this.send({ type: 'run.finishFlow' })
    wrap.append(done)
    return wrap
  }

  private reward(run: RunView): HTMLElement {
    const wrap = el('div', { class: 'opts' }, [el('h2', {}, ['选一张进卡盒'])])
    for (const id of run.reward?.pool ?? []) {
      const def = this.game.ask({ type: 'content.card', defId: id })
      const b = el('button', { class: `opt${run.reward?.picked === id ? ' sel' : ''}` }, [
        `${def.name} · ${def.kind === 'spell' ? '法术' : `${def.basePoints}点`} ${def.cost}费 — ${def.text}`,
      ])
      b.disabled = !!run.reward?.picked
      b.onclick = () => void this.send({ type: 'run.rewardPick', cardId: id })
      wrap.append(b)
    }
    const done = el('button', { class: 'primary' }, ['回地图'])
    done.disabled = !run.reward?.picked
    done.onclick = () => void this.send({ type: 'run.finishFlow' })
    wrap.append(done)
    return wrap
  }

  private shop(run: RunView): HTMLElement {
    const wrap = el('div', { class: 'opts' }, [el('h2', {}, [`商店 · ${run.gold}金`])])
    run.shop?.offers.forEach((o, i) => {
      const b = el('button', {}, [`买 ${o.defId} · ${o.price}`])
      b.onclick = () => void this.send({ type: 'run.shopBuyCard', index: i })
      wrap.append(b)
    })
    if (run.shop?.relicId) {
      const b = el('button', {}, [`买 ${run.shop.relicId} · ${run.shop.relicPrice}`])
      b.onclick = () => void this.send({ type: 'run.shopBuyRelic' })
      wrap.append(b)
    }
    for (const c of run.boxCards) {
      const b = el('button', {}, [`复制 ${c.defId} · ${run.shop?.copyPrice}`])
      b.onclick = () => void this.send({ type: 'run.shopCopy', uid: c.uid })
      wrap.append(b)
    }
    const leave = el('button', { class: 'primary' }, ['离开'])
    leave.onclick = () => void this.send({ type: 'run.finishFlow' })
    wrap.append(leave)
    return wrap
  }

  private rest(): HTMLElement {
    const wrap = el('div', { class: 'opts' }, [el('h2', {}, ['疗养地'])])
    const a = el('button', {}, ['回血 30%'])
    a.onclick = () => void this.send({ type: 'run.restPick', choice: 'heal' })
    const b = el('button', {}, ['化身基础 +2，血上限 +2'])
    b.onclick = () => void this.send({ type: 'run.restPick', choice: 'grow' })
    const done = el('button', { class: 'primary' }, ['回地图'])
    done.onclick = () => void this.send({ type: 'run.finishFlow' })
    wrap.append(a, b, done)
    return wrap
  }

  private forge(run: RunView): HTMLElement {
    const wrap = el('div', { class: 'opts' }, [el('h2', {}, ['锻造地'])])
    for (const c of run.boxCards) {
      const buff = el('button', {}, [`${c.defId} +2`])
      buff.onclick = () => void this.send({ type: 'run.forgeBuff', uid: c.uid })
      const recast = el('button', {}, ['重铸'])
      recast.onclick = () => void this.send({ type: 'run.forgeRecast', uid: c.uid })
      wrap.append(el('div', { class: 'row' }, [buff, recast]))
    }
    const done = el('button', { class: 'primary' }, ['回地图'])
    done.onclick = () => void this.send({ type: 'run.finishFlow' })
    wrap.append(done)
    return wrap
  }

  private chest(run: RunView): HTMLElement {
    const done = el('button', { class: 'primary' }, ['回地图'])
    done.onclick = () => void this.send({ type: 'run.finishFlow' })
    return el('div', {}, [el('h2', {}, ['宝箱']), el('p', {}, [run.relics.join('、') || '15 金']), done])
  }

  private over(run: RunView): HTMLElement {
    const again = el('button', { class: 'primary' }, ['再开一趟'])
    again.onclick = () => void this.send({ type: 'run.start', seed: run.seed + 1, deckId: run.deckId })
    return el('div', {}, [el('h2', {}, [run.ended === 'victory' ? '通关' : '失败']), el('p', {}, [`血 ${run.hp}/${run.hpMax}`]), again])
  }

  private battle(): HTMLElement {
    const view = this.game.ask({ type: 'battle.view' })
    if (!view) return el('p', {}, ['没有战斗'])
    const plays = this.game.ask({ type: 'battle.legalPlays' })
    const legal = this.selected ? plays.find((p) => p.card === this.selected) : undefined
    const wrap = el('div', { class: 'cols' })
    wrap.append(this.board(view, legal), this.side(view, plays, legal))
    return wrap
  }

  private board(view: BattleView, legal?: LegalPlay): HTMLElement {
    const grid = el('div', { class: 'grid9' })
    for (const cell of view.cells) {
      const inst = cell.card ? view.cards[cell.card] : undefined
      const canCell = !!legal && legal.cells.includes(cell.id)
      const canTarget = !!(legal && inst && legal.targets.includes(inst.id))
      const cls = ['cell', cell.corner ? 'corner' : '', inst?.owner ?? '', inst?.sealed ? 'sealed' : '', canCell || canTarget ? 'legal' : ''].filter(Boolean).join(' ')
      const node = el('button', { class: cls }, [
        el('div', { class: 'nm' }, [inst ? `${inst.name}${inst.sealed ? ' 封' : ''}${inst.isAvatar ? ' ·化' : ''}` : `格${cell.id}`]),
        el('div', { class: 'pts' }, [inst ? String(inst.currentPoints) : '']),
      ])
      node.onclick = () => {
        if (!this.selected || !legal) return
        if (canCell) void this.send({ type: 'battle.play', card: this.selected, cell: cell.id as Cell })
        else if (canTarget && inst) void this.send({ type: 'battle.play', card: this.selected, target: inst.id })
        this.selected = null
      }
      grid.append(node)
    }
    return grid
  }

  private side(view: BattleView, plays: LegalPlay[], legal?: LegalPlay): HTMLElement {
    const hand = el('div', { class: 'hand' })
    for (const id of view.hand) {
      const c = view.cards[id]
      const playable = plays.some((p) => p.card === id)
      const btn = el('button', { class: `card${this.selected === id ? ' sel' : ''}` }, [
        el('div', {}, [c.name, c.isAvatar ? ' ·化身' : '']),
        el('div', { class: 'cost' }, [c.kind === 'spell' ? '法术' : `${c.basePoints}点`, ` · ${this.game.ask({ type: 'content.card', defId: c.defId }).cost}费`, playable ? '' : ' ·不可']),
      ])
      btn.onclick = () => {
        if (!playable) return
        const p = plays.find((x) => x.card === id)!
        if (p.cells.length === 0 && p.targets.length === 0) {
          void this.send({ type: 'battle.play', card: id })
          this.selected = null
          return
        }
        this.selected = this.selected === id ? null : id
        this.render()
      }
      hand.append(btn)
    }
    const end = el('button', { class: 'primary' }, ['结束回合'])
    end.disabled = !view.canEndTurn
    end.onclick = () => void this.send({ type: 'battle.endTurn' })
    const act = el('button', {}, ['主动触发'])
    act.disabled = !view.canActivate
    act.onclick = () => {
      const a = this.game.ask({ type: 'battle.legalActivates' })[0]
      if (a) void this.send({ type: 'battle.activate', card: a.card, target: a.targets[0] })
    }
    const finish = el('button', { class: 'good' }, ['结算回地图'])
    finish.disabled = !view.result
    finish.onclick = () => void this.send({ type: 'run.finishFlow' })
    let preview = ''
    if (this.selected && legal) {
      const p = this.game.ask({ type: 'battle.previewPlay', card: this.selected, cell: legal.cells[0], target: legal.targets[0] })
      if (p) preview = `预览：己${p.player} 敌${p.enemy} 化身${p.avatar} 费${p.occupy}/${p.occupyCap}`
    }
    return el('div', {}, [
      el('p', { class: 'stat' }, [`第${view.turn}回合`, ` · 己${view.playerFinal} 敌${view.enemyFinal}`, ` · 费 ${view.occupy}/${view.occupyCap}`, ` · RES.A ${view.resA}`]),
      el('p', { class: 'stat' }, [
        `化身${view.avatar.onBoard ? `在场 ${view.avatar.current}` : '未入场'} · 代价预估 ${view.avatar.avatarCost}`,
        view.mustPlaceAvatar ? ' · 必须先打化身' : '',
        ` · 牌组${view.deckLeft} 弃${view.discardCount}/${view.enemyDiscardCount}`,
      ]),
      view.result ? el('p', {}, [`${view.result.outcome === 'win' ? '胜' : '负'} · ${view.result.reason} · 代价 ${view.result.avatarCost}`]) : el('span'),
      el('p', { class: 'muted' }, [preview || '点手牌，再点高亮格或目标。']),
      hand,
      el('p', { class: 'row' }, [end, act, finish]),
    ])
  }

  private log(): HTMLElement {
    const box = el('div', { class: 'log' })
    for (const e of this.game.store.all()) {
      const text = 'text' in e && typeof (e as DomainEvent & { text?: string }).text === 'string'
        ? (e as DomainEvent & { text: string }).text
        : e.type
      box.append(el('div', {}, [`${e.seq ?? ''} ${e.type}  ${text}`]))
    }
    queueMicrotask(() => { box.scrollTop = box.scrollHeight })
    return el('div', {}, [el('h3', {}, ['日志']), box])
  }
}
