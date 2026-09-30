import { kernelAnswer, kernelCatalog, kernelStart, kernelValidate } from './browserKernel'
import type { PcdAdvance, PcdCatalog, PcdDeckReport } from './types'

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

export function kernelOfflineMessage(reason: unknown) {
  if (import.meta.env.DEV) return '内核没有连上。请用 start-game.bat 同时启动对局服务和网页。'
  return reason instanceof Error && reason.message ? reason.message : '浏览器里的对局内核没有启动。'
}

export function fetchCatalog() {
  return import.meta.env.DEV ? request<PcdCatalog>('/api/catalog') : kernelCatalog()
}

export function startMatch(body: {
  monsterId: string
  seed: number
  deckId?: string
  buildDeck?: string[]
  buildBacks?: string[]
}) {
  if (!import.meta.env.DEV) return kernelStart(body)
  return request<PcdAdvance>('/api/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function validateDeck(cards: string[], backs: string[]) {
  if (!import.meta.env.DEV) return kernelValidate(cards, backs)
  return request<PcdDeckReport>('/api/deck/validate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cards, backs }),
  })
}

export function answerMatch(snapshot: string, option: string) {
  if (!import.meta.env.DEV) return kernelAnswer(snapshot, option)
  return request<PcdAdvance>('/api/answer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ snapshot, option }),
  })
}
