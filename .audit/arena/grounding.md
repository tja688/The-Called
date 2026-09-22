# Grounding for the rules-table sketch

Repo: C:\Users\jinji\Documents\GitHub\The-Called

Behavior pin, already green before this sketch: `npm test` (80) and `npm run sim:compare` (event type sequence, 1965 events, seed 1, deck DK.A). Event payloads are not in the baseline. Tests assert gold, hp, and outcomes.

Do not implement floor 2 or 3. `RunState.floor` is the literal `1`. `enterNode` on `nextFloor` calls `end('victory')` at `src/domain/run/RunAggregate.ts` around the nextFloor branch. Changing that is new play, out of scope.

## Event settlement

`src/content/events.ts` holds `EventDef` text, floors, and option flags (`needsCard`, `needsCard2`, thresholds). `eventOptionEnabled` already decides whether an option can be picked.

`RunAggregate.applyEvent` is a chain of `ev.id === 'EV.xx' && index === n` from about line 490. It calls `payGold`, `changeHp`, `addToBox`, `removeBoxUid`, `grantRelicOrGold`, `grantRandomNegative`, opens a reward screen, or starts `beginEventBattle`. Some options mutate `baseBonus` or `shopDiscount`.

## Battle targets and ops

`src/domain/effects.ts` defines `Op`, `Sel`, `Timing`, `Amt`. Comment says each op is implemented once.

`BattleAggregate.applyOp` is a switch on `op.op` (search `private applyOp`). `spellTargets` and `legalPlays` still branch on `defId` strings such as `PC.A02`, `PC.B03`, `PC.C05`. A few cards have empty `effects` and run in `firePlayWatchers` / `fireLeaveWatchers`.

`coverFeed` and `spellFeed` are in the `Op` union. `applyOp` default returns. `spellFeed` is also a cause label inside the watchers. Do not drop those labels unless the sketch shows the watcher becomes a normal op with the same events.

## Out of scope for the sketch

Presentation scenes. Pixel. Implementing a real second floor. New cards. Deleting `needsCard2` (the UI already reads it). `ME.09` `coveredAdj` has no battle branch. Leave it unimplemented.
