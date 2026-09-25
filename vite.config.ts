import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { Plugin } from 'vite'

const PUBLIC_ASSETS_ID = 'virtual:public-assets'
const RESOLVED_PUBLIC_ASSETS_ID = `\0${PUBLIC_ASSETS_ID}`
const PRELOADABLE_EXTENSIONS = new Set([
  '.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp',
  '.aac', '.flac', '.m4a', '.mp3', '.ogg', '.wav', '.webm',
  '.otf', '.ttf', '.woff', '.woff2',
  '.bin', '.glb', '.gltf', '.hdr', '.wasm',
])

function collectPublicAssets(publicDir: string, directory = publicDir): string[] {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.')) return []

    const absolutePath = join(directory, entry.name)
    if (entry.isDirectory()) return collectPublicAssets(publicDir, absolutePath)

    const extensionIndex = entry.name.lastIndexOf('.')
    const extension = extensionIndex === -1 ? '' : entry.name.slice(extensionIndex).toLowerCase()
    if (!PRELOADABLE_EXTENSIONS.has(extension)) return []

    return relative(publicDir, absolutePath).split(sep).join('/')
  })
}

function publicAssetsPlugin(): Plugin {
  let publicDir = ''

  return {
    name: 'strix-public-assets',
    configResolved(config) {
      publicDir = config.publicDir
    },
    resolveId(id) {
      return id === PUBLIC_ASSETS_ID ? RESOLVED_PUBLIC_ASSETS_ID : undefined
    },
    load(id) {
      if (id !== RESOLVED_PUBLIC_ASSETS_ID) return undefined
      return `export default ${JSON.stringify(collectPublicAssets(publicDir).sort())}`
    },
    configureServer(server) {
      const reloadManifest = (file: string) => {
        if (!file.startsWith(publicDir)) return
        const module = server.moduleGraph.getModuleById(RESOLVED_PUBLIC_ASSETS_ID)
        if (module) server.moduleGraph.invalidateModule(module)
        server.ws.send({ type: 'full-reload' })
      }

      server.watcher.on('add', reloadManifest)
      server.watcher.on('unlink', reloadManifest)
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), publicAssetsPlugin()],
  server: { port: 4174, strictPort: true },
})
