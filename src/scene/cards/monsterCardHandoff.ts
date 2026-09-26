type Release = (instanceId: string) => void

let releaseFlight: Release | null = null

export function bindMonsterFlightRelease(release: Release) {
  releaseFlight = release
  return () => {
    if (releaseFlight === release) releaseFlight = null
  }
}

/** Called once the board mesh has its settled transform and a painted face. */
export function presentMonsterBoardCard(instanceId: string) {
  releaseFlight?.(instanceId)
}
