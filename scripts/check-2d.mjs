import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const visited = new Set()
const forbidden = []
const missing = []
function visit(file) {
    if (visited.has(file)) return
    visited.add(file)
    const text = readFileSync(file, 'utf8')
    const imports = [
        ...text.matchAll(
            /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(['"])([^'"\n]+)\1/g,
        ),
    ].map((match) => match[2])
    for (const specifier of imports) {
        if (specifier === 'three' || specifier.startsWith('@react-three/'))
            forbidden.push({ file: relative(root, file), import: specifier })
        if (!specifier.startsWith('.')) continue
        const path = resolve(dirname(file), specifier)
        const target = [
            path,
            `${path}.ts`,
            `${path}.tsx`,
            `${path}.css`,
            resolve(path, 'index.ts'),
            resolve(path, 'index.tsx'),
        ].find((candidate) => existsSync(candidate))
        if (!target) {
            missing.push({ file: relative(root, file), import: specifier })
            continue
        }
        if (/\.(?:ts|tsx|css)$/.test(target)) visit(target)
    }
}
visit(resolve(root, 'src/main.tsx'))
const report = {
    status: forbidden.length || missing.length ? 'failed' : 'passed',
    reachableFiles: visited.size,
    forbiddenImports: forbidden,
    missingImports: missing,
}
console.log(JSON.stringify(report, null, 2))
if (report.status === 'failed') process.exitCode = 1
