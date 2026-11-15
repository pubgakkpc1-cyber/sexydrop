import { getWebApp } from '../../lib/telegram'

/** ПК: Telegram Desktop, macOS, Unigram, веб-версии или просто широкое окно. */
export function isDesktopLaunch(): boolean {
  if (typeof window === 'undefined') return false
  const platform = String((getWebApp() as unknown as { platform?: string } | undefined)?.platform ?? '')
  return ['tdesktop', 'macos', 'unigram', 'weba', 'webk'].includes(platform) || window.innerWidth >= 1000
}

/**
 * Ждём, пока окно готово: шрифты загружены и (на ПК) Telegram закончил разворачивать мини-приложение
 * на весь экран. Иначе анимация начинается «не с нуля» — первые кадры уходят на разворот окна.
 */
export async function waitUntilReady(desktop: boolean): Promise<void> {
  const fonts = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready ?? Promise.resolve()
  const fullscreen = new Promise<void>((resolve) => {
    const wa = getWebApp() as unknown as {
      isFullscreen?: boolean
      onEvent?: (e: string, cb: () => void) => void
      offEvent?: (e: string, cb: () => void) => void
    } | undefined
    if (!desktop || !wa || wa.isFullscreen) return resolve()
    const done = () => {
      wa.offEvent?.('fullscreenChanged', done)
      resolve()
    }
    wa.onEvent?.('fullscreenChanged', done)
    window.setTimeout(done, 700)
  })
  await Promise.race([Promise.all([fonts, fullscreen]), new Promise((r) => window.setTimeout(r, 1200))])
  const frame = () =>
    new Promise<void>((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : window.setTimeout(r, 16)))
  await frame()
  await frame()
}
