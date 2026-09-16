import type { GameService } from '../application/GameService'
import type { BattleView } from '../application/readmodels/BattleView'
import type { RunView } from '../application/readmodels/RunView'
import type { LegalPlay } from '../domain/battle/BattleAggregate'
import type { Cell } from '../domain/geometry'
import { cardName } from '../content/cards'
import type { DomainEvent } from '../core/messages'

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

/**
 * 规则验收器。只对 GameService 的 dispatch / ask 说话。
 */
export class App {
  private selected: string | null = null
  private err = ''
  private seed = '1'

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
          ? el('span', { class: 'stat' }, [`血 ${run.hp}/${run.hpMax}`, ' · ', `种子 ${run.seed}`])
          : el('span', { class: 'muted' }, ['未开局']),
      ]),
    ])
    if (this.err) bar.append(el('div', { class: 'err' }, [this.err]))
    return bar
  }

  private footer(): HTMLElement {
    return el('footer', {}, [
      '控制台 called.game.dispatch / ask。?present=dom 白模。这是规则验收器，不是表现层。',
    ])
  }

  private body(run: RunView | null): HTMLElement {
    const main = el('main')
    if (!run) {
      main.append(this.boot())
      return main
    }
    if (run.screen === 'over') main.append(this.over(run))
    else if (run.screen === 'map') main.append(this.map(run))
    else if (run.screen === 'event') main.append(this.event(run))
    else if (run.screen === 'reward') main.append(this.reward(run))
    else if (run.screen === 'battle') main.append(this.battle())
    main.append(this.log())
    return main
  }

  private boot(): HTMLElement {
    const seed = el('input', { value: this.seed }) as HTMLInputElement
    seed.style.width = '100px'
    seed.oninput = () => { this.seed = seed.value }
    const go = el('button', { class: 'primary' }, ['开一趟'])
    go.onclick = () => {
      const n = Number(this.seed)
      void this.send({ type: 'run.start', seed: Number.isFinite(n) ? n : undefined })
    }
    return el('div', { class: 'row' }, [el('span', {}, ['种子']), seed, go])
  }

  private map(run: RunView): HTMLElement {
    const nodes = el('div', { class: 'nodes' })
    for (const n of run.nodes) {
      const can = run.availableNodes.includes(n.id)
      const box = el('button', { class: `node${can ? ' go' : ''}${n.done ? ' done' : ''}`, disabled: can ? undefined : true }, [
        n.label,
        el('div', { class: 'muted' }, [n.done ? '已过' : can ? '可进' : '未到']),
      ])
      if (can) box.onclick = () => void this.send({ type: 'run.enterNode', node: n.id })
      nodes.append(box)
    }

    const box = el('div', { class: 'box' })
    const deckCount = new Map<string, number>()
    for (const id of run.deck) deckCount.set(id, (deckCount.get(id) ?? 0) + 1)
    const used = new Map<string, number>()
    for (const id of run.box) {
      const u = used.get(id) ?? 0
      used.set(id, u + 1)
      const inDeck = (deckCount.get(id) ?? 0) > u
      const chip = el('button', { class: `chip${inDeck ? ' in' : ''}` }, [`${cardName(id)}${inDeck ? ' · 组' : ''}`])
      chip.onclick = () => {
        const next = [...run.deck]
        if (inDeck) {
          const i = next.lastIndexOf(id)
          if (i >= 0 && next.length > 1) next.splice(i, 1)
        } else next.push(id)
        void this.send({ type: 'run.setDeck', deck: next })
      }
      box.append(chip)
    }

    const abandon = el('button', { class: 'warn' }, ['放弃'])
    abandon.onclick = () => void this.send({ type: 'run.abandon' })

    return el('div', {}, [
      el('p', { class: 'muted' }, ['线性四节点。点亮的才能进。卡盒芯片点一下编入/移出牌组（橙色=在组里）。']),
      nodes,
      el('p', {}, [`牌组 ${run.deck.length} 张（至少 1）。${run.extraDraw ? '夹层：剥手多抽 1。' : ''}`]),
      box,
      el('p', {}, [abandon]),
    ])
  }

  private event(run: RunView): HTMLElement {
    const wrap = el('div', { class: 'opts' }, [el('h2', {}, [run.event?.name ?? '事件'])])
    for (const opt of run.event?.options ?? []) {
      const b = el('button', { class: `opt${run.event?.chosen === opt.index ? ' sel' : ''}` }, [
        `${opt.label} — ${opt.text}`,
      ])
      b.disabled = run.event?.chosen !== undefined
      b.onclick = () => void this.send({ type: 'run.eventOption', index: opt.index })
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
        `${def.name} · ${def.kind === 'occupy' ? `${def.basePoints}点` : '法术'} ${def.cost}费 — ${def.text}`,
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

  private over(run: RunView): HTMLElement {
    const again = el('button', { class: 'primary' }, ['再开一趟'])
    again.onclick = () => void this.send({ type: 'run.start', seed: run.seed + 1 })
    return el('div', {}, [
      el('h2', {}, [run.ended === 'victory' ? '通关' : '失败']),
      el('p', {}, [`血 ${run.hp}/${run.hpMax}`]),
      again,
    ])
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
      const cls = [
        'cell',
        cell.corner ? 'corner' : '',
        cell.shadowActive ? 'shadow' : '',
        inst?.owner ?? '',
        inst?.sealed ? 'sealed' : '',
        canCell || canTarget ? 'legal' : '',
      ].filter(Boolean).join(' ')
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
        el('div', { class: 'cost' }, [
          c.kind === 'occupy' ? `${c.basePoints}点` : '法术',
          ` · ${this.game.ask({ type: 'content.card', defId: c.defId }).cost}费`,
          playable ? '' : ' ·不可',
        ]),
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

    const finish = el('button', { class: 'good' }, ['结算回地图'])
    finish.disabled = !view.result
    finish.onclick = () => void this.send({ type: 'run.finishFlow' })

    let preview = ''
    if (this.selected && legal) {
      const cell = legal.cells[0]
      const target = legal.targets[0]
      const p = this.game.ask({
        type: 'battle.previewPlay',
        card: this.selected,
        cell,
        target,
      })
      if (p) preview = `预览（首个合法）：己${p.player} 敌${p.enemy} 化身${p.avatar} 费${p.mana}/${p.manaCap}`
    }

    return el('div', {}, [
      el('p', { class: 'stat' }, [
        `第${view.turn}回合 ${view.phase}`,
        ` · 己${view.playerFinal} 敌${view.enemyFinal}`,
        view.leading ? ' · 领先' : '',
        ` · 费 ${view.mana}/${view.manaCap}`,
      ]),
      el('p', { class: 'stat' }, [
        `化身${view.avatar.onBoard ? `在场 ${view.avatar.current}` : '未入场'} · 伤口预估 ${view.avatar.woundEstimate}`,
        view.mustPlaceAvatar ? ' · 必须先打化身' : '',
        ` · 牌组${view.deckLeft} 弃${view.discardCount}`,
      ]),
      view.result
        ? el('p', {}, [`${view.result.outcome === 'win' ? '胜' : '负'} · ${view.result.reason} · 伤口 ${view.result.wound}`])
        : el('span'),
      el('p', { class: 'muted' }, [preview || '点手牌，再点高亮格或目标。无目标法术点一下即打。']),
      hand,
      el('p', { class: 'row' }, [end, finish]),
    ])
  }

  private log(): HTMLElement {
    const box = el('div', { class: 'log' })
    const evs = this.game.store.all()
    for (const e of evs) {
      const text = 'text' in e && typeof (e as DomainEvent & { text?: string }).text === 'string'
        ? (e as DomainEvent & { text: string }).text
        : e.type
      box.append(el('div', {}, [`${e.seq ?? ''} ${e.type}  ${text}`]))
    }
    queueMicrotask(() => { box.scrollTop = box.scrollHeight })
    return el('div', {}, [el('h3', {}, ['日志']), box])
  }
}
