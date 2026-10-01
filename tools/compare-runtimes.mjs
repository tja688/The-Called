import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const requests = process.argv[2]
  ? [process.argv[2]]
  : [
      '{"seed":1234567,"count":5}',
      '{"seed":42,"count":1}',
      '{"command":"playout","seed":7,"catalogFile":"content/blank/catalog.yaml"}',
      '{"command":"playout","seed":7,"catalogFile":"content/rules/catalog.yaml","max":80}',
    ]

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
  })
  if (result.error) {
    process.stderr.write(String(result.error) + '\n')
    process.exit(1)
  }
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '')
    process.stderr.write(result.stderr ?? '')
    process.exit(result.status ?? 1)
  }
  return result
}

run('dotnet', ['build', 'src/Pcd.ProbeHost/Pcd.ProbeHost.csproj', '-c', 'Release', '--nologo', '-v', 'q'])
run('dotnet', ['build', 'src/Pcd.Wasm/Pcd.Wasm.csproj', '-c', 'Release', '--nologo', '-v', 'q'])

const probeDll = path.join(root, 'src', 'Pcd.ProbeHost', 'bin', 'Release', 'net10.0', 'Pcd.ProbeHost.dll')
const mainMjs = path.join(
  root,
  'src',
  'Pcd.Wasm',
  'bin',
  'Release',
  'net10.0',
  'browser-wasm',
  'AppBundle',
  'main.mjs',
)

if (!existsSync(probeDll) || !existsSync(mainMjs)) {
  process.stderr.write('Build outputs were not found.\n')
  process.stderr.write(probeDll + '\n')
  process.stderr.write(mainMjs + '\n')
  process.exit(1)
}

function compare(request) {
  const dotnetResult = run('dotnet', ['exec', probeDll, request])
  const wasmResult = run(process.execPath, [mainMjs, request])
  if (dotnetResult.stdout !== wasmResult.stdout) {
    process.stderr.write('Runtime outputs differ for ' + request + '\n')
    process.stderr.write('--- dotnet ---\n')
    process.stderr.write(dotnetResult.stdout ?? '')
    process.stderr.write('--- wasm ---\n')
    process.stderr.write(wasmResult.stdout ?? '')
    process.exit(1)
  }
  return dotnetResult.stdout ?? ''
}

for (const request of requests) {
  process.stdout.write(compare(request))
}

const recorded = JSON.parse(compare('{"command":"record","seed":7,"catalogFile":"content/blank/catalog.yaml"}'))
const replayRequest = JSON.stringify({
  command: 'replay',
  replay: recorded.replay,
  catalogFile: 'content/blank/catalog.yaml',
})
const replayed = JSON.parse(compare(replayRequest))
if (replayed.hash !== recorded.hash) {
  process.stderr.write('Replay hash does not match the recording.\n')
  process.stderr.write(recorded.hash + '\n')
  process.stderr.write(replayed.hash + '\n')
  process.exit(1)
}
