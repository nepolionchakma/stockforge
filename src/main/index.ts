import { promises as fs } from 'node:fs'
import { basename, dirname, extname, join, normalize } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  net,
  protocol,
  shell
} from 'electron'
import { exiftool } from 'exiftool-vendored'
import type { EmbedItem, EmbedOptions, PickedImageResult } from '../shared/types'
import { embedAll } from './embedder'

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png'])
const allowedImagePaths = new Set<string>()

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'stockforge',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
])

function normalized(path: string): string {
  return normalize(path)
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1460,
    height: 940,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    backgroundColor: '#0a0b0e',
    title: 'StockForge Studio',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  })

  window.on('ready-to-show', () => window.show())

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  const developmentUrl = process.env.ELECTRON_RENDERER_URL
  if (developmentUrl) {
    void window.loadURL(developmentUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('dialog:pickImages', async (): Promise<PickedImageResult> => {
    const mainWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const selection = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose images',
      buttonLabel: 'Add images',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'JPEG and PNG images', extensions: ['jpg', 'jpeg', 'png'] }]
    })

    if (selection.canceled) return { files: [], rejected: [] }

    const files: PickedImageResult['files'] = []
    const rejected: string[] = []

    for (const filePath of selection.filePaths) {
      try {
        const extension = extname(filePath).toLowerCase()
        if (!IMAGE_EXTENSIONS.has(extension)) {
          rejected.push(basename(filePath))
          continue
        }
        const stats = await fs.stat(filePath)
        if (!stats.isFile()) {
          rejected.push(basename(filePath))
          continue
        }
        const path = normalized(filePath)
        allowedImagePaths.add(path)
        files.push({
          path,
          fileName: basename(path),
          dir: dirname(path),
          ext: extension.slice(1),
          bytes: stats.size
        })
      } catch {
        rejected.push(basename(filePath))
      }
    }

    return { files, rejected }
  })

  ipcMain.handle('dialog:pickOutputFolder', async (): Promise<string | null> => {
    const mainWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const selection = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose an output folder for the metadata copies',
      buttonLabel: 'Use this folder',
      properties: ['openDirectory', 'createDirectory']
    })
    if (selection.canceled || selection.filePaths.length === 0) return null
    return normalized(selection.filePaths[0])
  })

  ipcMain.handle('clipboard:write', (_event, text: string) => {
    clipboard.writeText(text)
  })

  ipcMain.handle(
    'csv:export',
    async (_event, payload: { fileName: string; csv: string }): Promise<{ path: string } | null> => {
      const mainWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
      const safeName = `${basename(payload.fileName).replace(/\.csv$/i, '')}.csv`
      const selection = await dialog.showSaveDialog(mainWindow, {
        title: 'Export Adobe Stock CSV',
        defaultPath: join(app.getPath('documents'), safeName),
        filters: [{ name: 'CSV file', extensions: ['csv'] }]
      })
      if (selection.canceled || !selection.filePath) return null
      const target = selection.filePath.toLowerCase().endsWith('.csv')
        ? selection.filePath
        : `${selection.filePath}.csv`
      await fs.writeFile(target, payload.csv, 'utf8')
      return { path: target }
    }
  )

  ipcMain.handle(
    'meta:embed',
    async (event, payload: { items: EmbedItem[]; outputDir: string; options: EmbedOptions }) => {
      return embedAll(event.sender, payload.items, payload.outputDir, payload.options)
    }
  )

  ipcMain.handle('shell:showItem', (_event, path: string) => {
    shell.showItemInFolder(path)
  })

  ipcMain.handle('shell:openPath', async (_event, path: string) => {
    return shell.openPath(path)
  })

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    if (url.startsWith('https://')) await shell.openExternal(url)
  })
}

app.whenReady().then(() => {
  nativeTheme.themeSource = 'dark'
  Menu.setApplicationMenu(null)

  protocol.handle('stockforge', async (request) => {
    try {
      const url = new URL(request.url)
      const requestedPath = url.searchParams.get('path')
      if (!requestedPath) return new Response('Not found', { status: 404 })

      const imagePath = normalized(decodeURIComponent(requestedPath))
      if (!allowedImagePaths.has(imagePath)) {
        return new Response('Not found', { status: 404 })
      }

      const response = await net.fetch(pathToFileURL(imagePath).toString())
      const headers = new Headers(response.headers)
      headers.set('Access-Control-Allow-Origin', '*')
      headers.set('Cache-Control', 'no-store')
      return new Response(response.body, { status: response.status, headers })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })

  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  void exiftool.end()
})
