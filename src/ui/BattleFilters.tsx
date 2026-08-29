type BattleFiltersProps = {
  fight?: boolean
  fightBlue?: boolean
}

/**
 * Reusable battle-screen color treatments. Each layer can be enabled alone,
 * or both can be composed in their original stacking order.
 */
export function BattleFilters({ fight = false, fightBlue = false }: BattleFiltersProps) {
  return (
    <>
      {fight && <div className="battle-filter" aria-hidden="true" />}
      {fightBlue && <div className="battle-filter-blue" aria-hidden="true" />}
    </>
  )
}
