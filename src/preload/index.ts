import { contextBridge, ipcRenderer } from 'electron'
import type { EmbedProgress, StockForgeApi } from '../shared/types'

const api: StockForgeApi = {
  pickImages: () => ipcRenderer.invoke('dialog:pickImages'),
  pickOutputFolder: () => ipcRenderer.invoke('dialog:pickOutputFolder'),
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text),
  exportCsv: (payload) => ipcRenderer.invoke('csv:export', payload),
  embedMetadata: (payload) => ipcRenderer.invoke('meta:embed', payload),
  onEmbedProgress: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: EmbedProgress): void => {
      listener(progress)
    }
    ipcRenderer.on('meta:embedProgress', handler)
    return () => ipcRenderer.removeListener('meta:embedProgress', handler)
  },
  showItemInFolder: (path) => ipcRenderer.invoke('shell:showItem', path),
  openPath: (path) => ipcRenderer.invoke('shell:openPath', path),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  platform: process.platform
}

contextBridge.exposeInMainWorld('stockforge', api)
