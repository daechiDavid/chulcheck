import { contextBridge, ipcRenderer } from 'electron'

const api = {
  platform: process.platform,
  invoke(action: string, payload?: unknown) {
    return ipcRenderer.invoke('chulcheck', action, payload)
  },
  onOpenRequest(callback: (id: string) => void) {
    const listener = (_event: unknown, id: string) => callback(id)
    ipcRenderer.on('open-request', listener)
    return () => ipcRenderer.removeListener('open-request', listener)
  },
  onSnapshot(callback: (snap: unknown) => void) {
    const listener = (_event: unknown, snap: unknown) => callback(snap)
    ipcRenderer.on('snapshot', listener)
    return () => ipcRenderer.removeListener('snapshot', listener)
  },
}

contextBridge.exposeInMainWorld('chulcheck', api)
