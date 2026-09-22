# Table sketch

## Caller

`eventOption` keeps its screen, already-chosen, `eventOptionEnabled`, and `needsCard` / `needsCard2` checks, then calls `runEventSteps(opt.steps, host, { card, card2 })`. Halt skips the tail. Otherwise it appends `run.eventOffered` and, when `hp <= 0`, `end('defeat', '血条归零')`. `applyEvent` is deleted. `enterNode` on `nextFloor` still returns `end('victory', '下层')`.

`legalPlays`, `legalActivates`, and `playerPlay` call `aimOf` and `cardsMatching`. `spellTargets` is deleted. `aim.count` and `aim.cells` replace the `swapChosen`, `spawnHalfCopy`, and `moveChosenAdjacent` tests in `playerPlay`.

`playerPlay` calls `fireReactions('played', card, events)` after `battle.cardPlayed` and before placement or `runEffects`. `removeCard` calls `fireReactions('left', card, events)` after leave effects and before `cell` is cleared. `resolveOp` calls `opHandlers[op.op](op, ctx, events)`.

## Types

`EventOptionDef` gains `steps`, optional `gate`, and optional `cardFilter`, beside `label`, `text`, `needsCard`, and `needsCard2`.

`EventStep` is `gainGold`, `payGold`, `changeHp`, `changeHpMaxRatio`, `relicOrGold`, `randomNegative`, `addDrawn`, `offerDrawn`, `chance`, `removePicked`, `bumpPicked`, `copyPicked`, `sellPicked`, `bumpNonNegative`, `perNegative`, `shopDiscount`, or `eventFight`. `chance` holds `p`, `then`, and `else`. `offerDrawn` holds `n` and either `exact` (calls `drawExact`) or `neutralsOnly` (calls `drawOne`). `perNegative` holds optional `hpEach`, optional `goldEach`, and `remove`. `EventGate` is `gold`, `goldPerNegative`, `boxAtMost`, or `boxAtLeast`. `cardFilter` is `negative` or `nonNegative`.

`offerDrawn` and `eventFight` halt. An empty offer emits no `run.rewardOffered`. `bumpPicked`, `bumpNonNegative`, and `shopDiscount` write state and emit nothing. `gainGold(n)` calls `payGold(-n, 'event')`. Step order is rng order. EV.02.1 is `chance` 0.5, EV.09 is `offerDrawn`, EV.11.0 pays 30 then `chance`, EV.16.0 is `eventFight`. Empty `steps` still emit `run.eventOffered`.

`Aim` on `CardEffect` is `{ cards: BoardFilter, count: 1 | 2, cells?: 'empty' | 'adjacentEmpty' }`. `BoardFilter` is enemy, enemy plus `marked`, any, player with avatar `allow` or `forbid`, `kind: 'occupy'`, or `zone: 'discard'`.

`Reaction` on `CardDef` has three shapes. PC.N11 is `{ on: 'played', sameOwner: true, causeOp: 'spellFeed', self: 1 }`. EC.21 is `{ on: 'played', foeSpell: true, causeOp: 'spellFeed', self: 2, randomFoe: 1 }`. PC.B07 is `{ on: 'left', leftKind: 'occupy', causeOp: 'leaveAdjSwing', self: 2 }`. PC.X01 sets `cannotPlay` and `onDraw: 'playThenDiscard'`.

## Signatures

`runEventSteps(steps: EventStep[], host: EventHost, pick: { card?: BoxCard; card2?: BoxCard }): boolean`

`eventOptionEnabled(ev: EventDef, index: number, ctx): boolean` reads `opt.gate` and the card filter.

`eventCardEligible(ev: EventDef, index: number, defId: string): boolean` reads `cardFilter`.

`aimOf(fx: CardEffect): Aim | undefined`

`cardsMatching(state: BattleState, filter: BoardFilter): string[]`

`fireReactions(hook: 'played' | 'left', subject: CardInst, events: BattleEvent[]): void`

`opHandlers: { [K in Op['op']]: (op: Extract<Op, { op: K }>, ctx: FxCtx, events: BattleEvent[]) => void }`

`EventHost` is the existing `payGold`, `changeHp`, `addToBox`, `removeBoxUid`, `grantRelicOrGold`, `grantRandomNegative`, `beginEventBattle`, and the reward-screen writes. Event names stay. `fireReactions` walks `boardCards` in today's order, skips sealed cards and the subject, and calls `changePoints` with cause `{ actor, defId, timing, op: causeOp }`. EC.21 still rolls `nextInt` after its own buff.

## Module map

`src/content/events.ts` stores the rows. The `EV.xx` tests inside `eventOptionEnabled` and `eventCardEligible` are deleted.

`src/domain/run/eventSteps.ts` exports `runEventSteps`. `eventOption` is the only caller.

`src/domain/effects.ts` exports `Aim`, `BoardFilter`, and `Reaction`. The `Op` union stays.

`src/domain/battle/aim.ts` exports `aimOf` and `cardsMatching`. `src/domain/battle/ops.ts` exports `opHandlers`. `applyOp` is deleted.

`src/content/cards.ts` sets `aim` on chosen effects, including PC.A00's active effect, and sets `reactions` on PC.N11, EC.21, and PC.B07. `firePlayWatchers` and `fireLeaveWatchers` are deleted.

A new option edits one `EventOptionDef` and does not edit `RunAggregate`. A new op adds one `Op` member and one handler. A targeted op also sets `aim` on the effect. `legalPlays` stays. An existing reaction shape edits only the card. A new reaction shape edits `fireReactions`.

## Special cases

`sellPicked` keeps rarity prices 45, 25, and 15. `perNegative` emits one hp or gold event for `count * each`, then removes. The two `spellFeed` bodies differ, so the numbers stay on the reaction. `opHandlers.spellFeed` and `opHandlers.coverFeed` return immediately. PC.B07's +2 reuses the label `leaveAdjSwing`. EC.03's handler still swings neighbors. `pick` still ignores `lowestCell`. `spawnHalfCopy` still requires a player non-avatar and an empty cell. `onDraw` stays so PC.X01 can run play effects, then discard. No step reads `card2`. `needsCard2` stays for the UI.

## Rejected

A `Record` from event id to a callback still selects on `EV.xx`. A new option would be another function in that record.

Running the three reactions through `runEffects` would append `battle.effectResolved` and move the sim sequence off 1965 events.

Reading the legal set off `sel: 'chosen'` would merge enemy, any, occupy, ally, and non-avatar. Current cards use different sets, so `aim` is stored on the effect.
