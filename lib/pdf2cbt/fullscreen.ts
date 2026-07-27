type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }
type WebkitDocument = Document & { webkitExitFullscreen?: () => Promise<void> | void; webkitFullscreenElement?: Element }

export async function toggleFullscreen(element: HTMLElement = document.documentElement) {
  const doc = document as WebkitDocument
  const active = document.fullscreenElement || doc.webkitFullscreenElement
  if (active) {
    if (document.exitFullscreen) return document.exitFullscreen()
    if (doc.webkitExitFullscreen) return doc.webkitExitFullscreen()
    throw new Error('Fullscreen exit is not supported on this device.')
  }
  const target = element as WebkitElement
  if (target.requestFullscreen) return target.requestFullscreen()
  if (target.webkitRequestFullscreen) return target.webkitRequestFullscreen()
  throw new Error('Fullscreen is not supported on this device.')
}
