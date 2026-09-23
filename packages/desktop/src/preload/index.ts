import { contextBridge, ipcRenderer } from 'electron'
import type { ServerConfig } from '@perf-appraisal-app/shared'

const api = {
  getServerConfig: (): Promise<ServerConfig> =>
    ipcRenderer.invoke('server-config:get'),
  printHtml: (
    html: string,
    options?: { landscape?: boolean },
  ): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('report:print-html', html, options),
  saveFile: (input: {
    defaultName: string
    data: Uint8Array
  }): Promise<{ cancelled: true } | { ok: true; path: string }> =>
    ipcRenderer.invoke('file:save', {
      defaultName: input.defaultName,
      data: Buffer.from(input.data),
    }),
}

contextBridge.exposeInMainWorld('api', api)

export type DesktopApi = typeof api
