# Candidate B: content tables + battle kernel

## Module map

- `src/content/eventOptions.ts` — `RunOptionPlan` per `(eventId, optionIndex)`
- `src/domain/run/runOptionExec.ts` — `executeRunOption`; closed `RunStep` union
- `src/content/cards.ts` — spells add `playSpec`; N11/B07/EC.21 add `signals[]`
- `src/domain/battle/playSpec.ts` — `legalSpellPlay`, `targetsForPool`
- `src/domain/battle/opHandlers.ts` — `Record<Op['op'], OpHandler>`
- `src/domain/battle/signals.ts` — `emitSignal` replaces play/leave watchers

RunAggregate and BattleAggregate keep commands/queries/events; private if-chains become lookup plus executor.

## Types

```ts
type RunCtx = { rng; school; box; card?: BoxCard }
type RunStep =
  | { step: 'payGold' | 'changeHp' | 'grantRelicOrGold' | 'grantRandomNegative'; ... }
  | { step: 'drawToBox'; rarity: DrawRarity }
  | { step: 'rewardScreen'; pool: 'blue3' | 'neutral3' }
  | { step: 'boxRemove' | 'boxBonus' | 'shopDiscount' | 'beginEventBattle'; ... }
  | { step: 'branch'; p: number; then: RunStep[]; else: RunStep[] }
  | { step: 'ifBoxSize'; cmp: 'le' | 'ge'; n: number; then: RunStep[] }
type RunOptionPlan = { guard?: RunGuard; steps: RunStep[]; skipFooter?: boolean }

type TargetPool = 'enemies' | 'allBoard' | 'allies' | 'alliesNonAvatar' | 'occupy' | 'discard'
type PlaySpec =
  | { mode: 'targets'; pool: TargetPool }
  | { mode: 'swapChosen' | 'spawnHalfCopy' | 'moveChosenAdjacent' | 'discardToHand' }

type SignalKind = 'allyCardPlayed' | 'enemySpellPlayed' | 'occupyLeft'
type SignalDef = { on: SignalKind; if: SignalFilter; ops: Op[]; causeOp?: Op['op'] }

type BattleKernel = /* pick, amt, changePoints, draw, removeCard, ... */
type OpHandler = (k: BattleKernel, op: Op, ctx: FxCtx, ev: BattleEvent[]) => void
```

## Signatures

```ts
export const RUN_OPTION_PLANS: Record<string, RunOptionPlan> // `${id}:${index}`

export function executeRunOption(
  agg: RunAggregate, plan: RunOptionPlan, ctx: RunCtx, out: RunEvent[]
): { out: RunEvent[]; halt: boolean }

export function playSpecOf(def: CardDef): PlaySpec
export function legalSpellPlay(s: BattleState, card: CardInst, spec: PlaySpec): LegalPlay | null
export function targetsForPool(s: BattleState, pool: TargetPool, caster: CardInst): string[]

export const OP_HANDLERS: Partial<Record<Op['op'], OpHandler>>
export function resolveOp(k: BattleKernel, op: Op, ctx: FxCtx, ev: BattleEvent[]): void

export function emitSignal(k: BattleKernel, kind: SignalKind, actor: CardInst, ev: BattleEvent[]): void
```

## Caller usage

```ts
const plan = RUN_OPTION_PLANS[`${ev.id}:${index}`]
const { out, halt } = plan
  ? executeRunOption(this, plan, ctx, events)
  : { out: events, halt: false }
if (!halt) out.push({ type: 'run.eventOffered', eventId: ev.id, ... })
return s.hp <= 0 ? out.concat(this.end('defeat', ...)) : out

const lp = legalSpellPlay(s, card, playSpecOf(def)); if (lp) out.push(lp)
OP_HANDLERS[op.op]?.(kernel, op, ctx, events)
emitSignal(kernel, kind, played, events) // after cardPlayed; occupyLeft on board remove
```

## Touch matrix

New event option: `eventOptions.ts` only, not RunAggregate. New spell targets: `playSpec` on def, not `spellTargets` defId branches. New op: one handler row, not `applyOp` switch. Watcher cards: `signals[]`, not `firePlayWatchers` / `fireLeaveWatchers`.

Aggregates still own enterNode (nextFloor → victory), screen state inside step impl, defeat concat.

## Special cases

EV.02.B random: `branch` step. EV.09 early return: `skipFooter`. EV.10 third choice: key `EV.10:2`. EV.04/06 guards: `RunOptionPlan.guard`. EV.06 rarity gold: step `boxRemoveForGoldByRarity`. EC.21 random foe -1: `damageRandom` op in signal ops (small handler in `opHandlers.ts`). `coverFeed` / `spellFeed` unused in applyOp today: `causeOp` on signals; future cards may bind real handlers. ME.02 onCover -1: stays in `placeOccupy`. ME.09: unimplemented.

## Rejected

Executor switching on `ev.id` — moved branches, not deleted. Infer targets only from `sel: chosen` — wrong for C02/N03/N07 vs default enemies. JSON rules DSL — weak typing vs `RunStep`/`Op` closures. One mega rules file — run and battle tables stay separate. Pure op-derived `PlaySpec` — duplicates today’s legalPlays op scans; explicit `playSpec` wins.
