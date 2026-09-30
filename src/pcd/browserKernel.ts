import type { PcdAdvance, PcdCatalog, PcdDeckReport } from './types'

type HostSuccess<T> = { ok: true; data: T }
type HostFailure = { ok: false; error?: string }

type KernelRuntime = {
  getConfig: () => { mainAssemblyName: string }
  getAssemblyExports: (assemblyName: string) => Promise<{
    KernelBridge: { Host: (requestJson: string) => string }
  }>
}

type DotnetApi = {
  withDiagnosticTracing: (enabled: boolean) => { create: () => Promise<KernelRuntime> }
}

let booting: Promise<(requestJson: string) => string> | null = null

function kernelScriptUrl() {
  const root = new URL(import.meta.env.BASE_URL, window.location.href)
  return new URL('kernel/_framework/dotnet.js', root).href
}

async function boot() {
  const scriptUrl = kernelScriptUrl()
  let imported: { dotnet: DotnetApi }
  try {
    imported = await import(/* @vite-ignore */ scriptUrl)
  } catch (error) {
    const detail = error instanceof Error ? error.message : ''
    throw new Error(detail ? `浏览器里的对局内核没有加载：${detail}` : '浏览器里的对局内核没有加载。')
  }

  const runtime = await imported.dotnet.withDiagnosticTracing(false).create()
  const exports = await runtime.getAssemblyExports(runtime.getConfig().mainAssemblyName)
  return (requestJson: string) => exports.KernelBridge.Host(requestJson)
}

function kernel() {
  if (!booting) {
    booting = boot().catch((error: unknown) => {
      booting = null
      throw error
    })
  }
  return booting
}

export function warmKernel() {
  if (import.meta.env.DEV) return
  void kernel().catch(() => undefined)
}

export async function kernelRequest<T>(body: unknown): Promise<T> {
  const invoke = await kernel()
  const parsed = JSON.parse(invoke(JSON.stringify(body))) as HostSuccess<T> | HostFailure
  if (!parsed.ok) throw new Error(parsed.error || '对局内核拒绝了这次请求')
  return parsed.data
}

export function kernelCatalog() {
  return kernelRequest<PcdCatalog>({ op: 'catalog' })
}

export function kernelStart(body: {
  monsterId: string
  seed: number
  deckId?: string
  buildDeck?: string[]
  buildBacks?: string[]
}) {
  return kernelRequest<PcdAdvance>({ op: 'start', ...body })
}

export function kernelValidate(cards: string[], backs: string[]) {
  return kernelRequest<PcdDeckReport>({ op: 'validate', cards, backs })
}

export function kernelAnswer(snapshot: string, option: string) {
  return kernelRequest<PcdAdvance>({ op: 'answer', snapshot, option })
}
