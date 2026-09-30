import type { PcdAdvance, PcdCatalog } from './types'

async function readError(response: Response) {
  try {
    const body = await response.json() as { error?: string }
    if (body?.error) return body.error
  } catch {
    /* The body was not JSON. */
  }
  return `请求失败（${response.status}）`
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<T>
}

export function fetchCatalog() {
  return request<PcdCatalog>('/api/catalog')
}

export function startMatch(monsterId: string, deckId: string, seed: number) {
  return request<PcdAdvance>('/api/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ monsterId, deckId, seed }),
  })
}

export function answerMatch(snapshot: string, option: string) {
  return request<PcdAdvance>('/api/answer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ snapshot, option }),
  })
}
