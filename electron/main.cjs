const { app, BrowserWindow, Menu, shell } = require('electron')
const path = require('path')

/** 内容区对齐 640×360 的 2 倍，方便整数放大 */
const CONTENT_W = 1280
const CONTENT_H = 720

function createWindow() {
  const win = new BrowserWindow({
    width: CONTENT_W,
    height: CONTENT_H,
    useContentSize: true,
    minWidth: 640,
    minHeight: 360,
    backgroundColor: '#0a0810',
    title: 'TheCall · 深渊的呼唤',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  win.setMenuBarVisibility(false)
  win.once('ready-to-show', () => win.show())

  const index = path.join(__dirname, '..', 'dist', 'index.html')
  void win.loadFile(index)

  win.webContents.on('did-fail-load', (_event, code, desc, url) => {
    console.error(`load failed ${code} ${desc} ${url}`)
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('file:')) return
    event.preventDefault()
    void shell.openExternal(url)
  })

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen())
      event.preventDefault()
    }
  })
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})
