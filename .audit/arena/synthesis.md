# Synthesis

Base is candidate A for event settlement. Both sketches put option behavior in a step list and stop the "选了" line when a reward screen or an event fight opens. A stores that list on `EventOptionDef`. B stores a second record keyed by `eventId:index`. The second record can drift from the option the player sees, so it lost.

Not taken from B. A parallel `RUN_OPTION_PLANS` map. A `BattleKernel` that re-lists every mutator. Signal ops that might emit `battle.effectResolved` and move the 1965-event sim sequence.

Still open. Spell targeting (`aim` on the effect, from A) and the `applyOp` handler map. Those stay in `BattleAggregate` until the next unit. `nextFloor` still ends the run.

Landed. `src/content/events.ts` holds the steps and gates. `src/domain/run/eventSteps.ts` runs them. `RunAggregate.applyEvent` is gone. Pin: tests 80, lint, sim 1965.
