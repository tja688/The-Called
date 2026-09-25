/** Runs a search coroutine one slice per frame so the canvas can paint in between. */
export function driveThink<T>(
  gen: Generator<void, T>,
  apply: (value: T) => void,
  schedule: (step: () => void) => void = (step) => requestAnimationFrame(step),
): () => void {
  let stopped = false
  const pump = () => {
    if (stopped) return
    const step = gen.next()
    if (stopped) return
    if (step.done) apply(step.value)
    else schedule(pump)
  }
  schedule(pump)
  return () => {
    stopped = true
  }
}

export function thinkCanYield(): boolean {
  return typeof requestAnimationFrame === 'function'
}
