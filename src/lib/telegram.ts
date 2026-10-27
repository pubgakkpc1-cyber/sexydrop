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
    webApp.setHeaderColor('#0d0b14')
    webApp.setBackgroundColor('#0d0b14')
    webApp.disableVerticalSwipes?.()
  } catch {
    /* старые клиенты могут не поддерживать часть методов */
  }
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
