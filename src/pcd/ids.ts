export function instanceKey(instance: number) {
  return `pcd-${instance}`
}

export function intentKey(index: number, cardId: string) {
  return `intent:${index}:${cardId}`
}

export function readInstance(instanceId: string): number | null {
  const matched = /^pcd-(\d+)$/.exec(instanceId)
  if (!matched) return null
  return Number(matched[1])
}
