import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { dotnet } from './_framework/dotnet.js'

const request = process.argv[2]
if (request === undefined) {
  process.stderr.write('用法：node main.mjs <request-json>\n')
  process.exit(1)
}

function repoRoot() {
  let dir = path.dirname(fileURLToPath(import.meta.url))
  while (true) {
    if (existsSync(path.join(dir, 'global.json'))) {
      return dir
    }
    const parent = path.dirname(dir)
    if (parent === dir) {
      process.stderr.write('找不到仓库根目录。\n')
      process.exit(1)
    }
    dir = parent
  }
}

function expandCatalog(raw) {
  if (!raw.includes('"catalogFile"')) {
    return raw
  }
  const obj = JSON.parse(raw)
  if (typeof obj.catalogFile !== 'string') {
    return raw
  }
  let text = readFileSync(path.join(repoRoot(), obj.catalogFile), 'utf8')
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1)
  }
  obj.catalog = text
  delete obj.catalogFile
  return JSON.stringify(obj)
}

function writeStderr(args) {
  process.stderr.write(args.map((part) => String(part)).join(' ') + '\n')
}

// The runtime logs with console.info, which Node sends to stdout.
// Keep stdout for the probe JSON only.
console.log = (...args) => writeStderr(args)
console.info = (...args) => writeStderr(args)
console.debug = (...args) => writeStderr(args)

const { getAssemblyExports, getConfig, runMainAndExit } = await dotnet
  .withDiagnosticTracing(false)
  .create()

const config = getConfig()
const exports = await getAssemblyExports(config.mainAssemblyName)
const result = exports.KernelBridge.Invoke(expandCatalog(request))
await new Promise((resolve, reject) => {
  process.stdout.write(result + '\n', (error) => (error ? reject(error) : resolve()))
})

await runMainAndExit()
