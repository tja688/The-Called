import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

const out = (process.env.CALLED_PACK_OUT ?? path.join(homedir(), 'Documents', 'The-Called-Play')).replaceAll('\\', '/')
const cfgPath = path.join(process.cwd(), 'electron-builder.local.json')

writeFileSync(cfgPath, JSON.stringify({
  extends: null,
  appId: 'local.thecalled.prototype',
  productName: 'The Called',
  directories: { output: out },
  files: ['dist/**/*', 'electron/**/*'],
  asar: true,
  win: {
    signAndEditExecutable: false,
    target: [{ target: 'zip', arch: ['x64'] }],
    artifactName: 'The-Called-${version}-win.${ext}',
  },
}, null, 2))

try {
  const result = spawnSync(
    'npx',
    ['electron-builder', '--win', 'zip', '--x64', '--config', cfgPath],
    {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        ELECTRON_MIRROR: process.env.ELECTRON_MIRROR ?? 'https://npmmirror.com/mirrors/electron/',
        ELECTRON_BUILDER_BINARIES_MIRROR:
          process.env.ELECTRON_BUILDER_BINARIES_MIRROR ?? 'https://npmmirror.com/mirrors/electron-builder-binaries/',
      },
    },
  )
  process.exit(result.status ?? 1)
} finally {
  try { unlinkSync(cfgPath) } catch { /* ignore */ }
}
