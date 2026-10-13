import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { app, BrowserWindow } from 'electron'

const mimeTypes = {
  '.avif': 'image/avif',
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function serveBuild() {
  const root = resolve(app.getAppPath(), 'dist')
  const rootPrefix = `${root}${sep}`

  return createServer((request, response) => {
    let pathname
    try {
      pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
    } catch {
      response.writeHead(400).end('Bad request')
      return
    }

    const requestedPath = resolve(root, `.${pathname}`)
    if (requestedPath !== root && !requestedPath.startsWith(rootPrefix)) {
      response.writeHead(403).end('Forbidden')
      return
    }

    const filePath = existsSync(requestedPath) && statSync(requestedPath).isFile()
      ? requestedPath
      : pathname === '/' ? resolve(root, 'index.html') : null

    if (!filePath || !existsSync(filePath)) {
      response.writeHead(404).end('Not found')
      return
    }

    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    })
    createReadStream(filePath).pipe(response)
  })
}

async function createWindow(url) {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#020105',
    title: 'The Called',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  await window.loadURL(url)
}

let server

app.whenReady().then(() => {
  server = serveBuild()
  server.listen(0, '127.0.0.1', () => {
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Could not start the local game server')
    void createWindow(`http://127.0.0.1:${address.port}/`)
  })
})

app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => server?.close())
