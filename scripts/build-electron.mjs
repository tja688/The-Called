import { spawnSync } from 'node:child_process'
import { cp, mkdir, rm, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const isWindows = process.platform === 'win32'
const npm = isWindows ? 'npm.cmd' : 'npm'

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: isWindows,
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const publishDir = resolve(root, 'src/Pcd.Wasm/bin/Release/net10.0/browser-wasm/AppBundle/_framework')
const frameworkDest = resolve(root, 'dist/kernel/_framework')

run('dotnet', ['publish', 'src/Pcd.Wasm/Pcd.Wasm.csproj', '-c', 'Release'])
run(npm, ['run', 'build:web'])

try {
  await stat(publishDir)
} catch {
  throw new Error(`WebAssembly output was not created: ${publishDir}`)
}

await rm(resolve(root, 'dist/kernel'), { recursive: true, force: true })
await mkdir(dirname(frameworkDest), { recursive: true })
await cp(publishDir, frameworkDest, { recursive: true })

run(npm, ['exec', '--', 'electron-builder', '--win', 'nsis', '--x64'])
run(npm, ['exec', '--', 'electron-builder', '--win', 'portable', '--x64'])
