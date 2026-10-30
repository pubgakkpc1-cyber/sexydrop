/**
 * Тонкая обёртка над Telegram WebApp SDK (telegram.org/js/telegram-web-app.js).
 * Вне Telegram (обычный браузер) все функции безопасно no-op — приложение
 * остаётся полноценным веб-приложением. Валидация initData — задача backend
 * (TIER 7); клиент использует только косметические данные пользователя.
 */

export interface TelegramUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
}

interface TelegramWebApp {
  initDataUnsafe: { user?: TelegramUser }
  ready: () => void
  expand: () => void
  setHeaderColor: (color: string) => void
  setBackgroundColor: (color: string) => void
  disableVerticalSwipes?: () => void
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void
  }
  BackButton?: {
    show: () => void
    hide: () => void
    onClick: (cb: () => void) => void
    offClick: (cb: () => void) => void
  }
  close: () => void
  platform?: string
  isFullscreen?: boolean
  isVersionAtLeast?: (version: string) => boolean
  requestFullscreen?: () => void
  safeAreaInset?: { top: number; bottom: number; left: number; right: number }
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number }
  onEvent?: (event: string, cb: () => void) => void
  openTelegramLink?: (url: string) => void
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

export function getWebApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp
}

export function isTelegramEnv(): boolean {
  const webApp = getWebApp()
  if (!webApp) return false
  const platform = (webApp as unknown as { platform?: string }).platform
  const hasInitData = Boolean(webApp.initDataUnsafe?.user || (webApp as unknown as { initData?: string }).initData)
  return Boolean(platform && platform !== 'unknown') || hasInitData
}

/** Вызвать один раз при старте приложения (main.tsx). */
export function initTelegram(): void {
  const webApp = getWebApp()
  if (!webApp) return
  try {
    webApp.ready()
    webApp.expand()
    webApp.setHeaderColor('#141414')
    webApp.setBackgroundColor('#141414')
    webApp.disableVerticalSwipes?.()
  } catch {
    /* старые клиенты могут не поддерживать часть методов */
  }

  // Полноэкранный режим на телефоне: убирает родную шапку Telegram («← Название ⌄ ⋮»).
  try {
    const mobile = webApp.platform === 'android' || webApp.platform === 'ios'
    if (mobile && webApp.isVersionAtLeast?.('8.0') && webApp.requestFullscreen && !webApp.isFullscreen) {
      webApp.requestFullscreen()
    }
    applyTelegramInsets()
    for (const ev of ['fullscreenChanged', 'safeAreaChanged', 'contentSafeAreaChanged', 'viewportChanged']) {
      webApp.onEvent?.(ev, applyTelegramInsets)
    }
  } catch {
    /* клиенты без Bot API 8.0 остаются в обычном режиме */
  }
}

/**
 * В полноэкранном режиме контент рисуется под системной строкой состояния и под
 * кнопками Telegram (закрыть / меню): прокидываем их высоту в CSS-переменные.
 */
function applyTelegramInsets(): void {
  const webApp = getWebApp()
  if (!webApp) return
  const root = document.documentElement
  const full = webApp.isFullscreen === true
  const top = full ? (webApp.safeAreaInset?.top ?? 0) + (webApp.contentSafeAreaInset?.top ?? 0) : 0
  const bottom = full ? (webApp.safeAreaInset?.bottom ?? 0) : 0
  root.style.setProperty('--tg-top', `${top}px`)
  root.style.setProperty('--tg-bottom', `${bottom}px`)
}

export function getTelegramUser(): TelegramUser | undefined {
  return getWebApp()?.initDataUnsafe?.user
}

/** Лёгкая тактильная отдача на нажатия. */
export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  try {
    getWebApp()?.HapticFeedback?.impactOccurred(style)
  } catch {
    /* вне Telegram — no-op */
  }
}

/** Тактильное уведомление об исходе действия. */
export function hapticNotify(type: 'success' | 'error' | 'warning'): void {
  try {
    getWebApp()?.HapticFeedback?.notificationOccurred(type)
  } catch {
    /* вне Telegram — no-op */
  }
}

/** Окно «Поделиться» Telegram со ссылкой; вне Telegram открывается в новой вкладке. */
export function shareTelegramLink(link: string, text: string): void {
  const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`
  const webApp = getWebApp()
  if (webApp?.openTelegramLink) webApp.openTelegramLink(url)
  else window.open(url, '_blank', 'noopener')
}
