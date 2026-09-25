/** Fast approach, short settle. The card is down as the move ends. */
export function landingEase(t: number) {
  const clamped = Math.min(1, Math.max(0, t))
  return 1 - (1 - clamped) ** 1.65
}

/** Hop follows the same clock as the slide, so it is finished when the card seats. */
export function landingHop(t: number, height: number) {
  return Math.sin(landingEase(t) * Math.PI) * height
}
