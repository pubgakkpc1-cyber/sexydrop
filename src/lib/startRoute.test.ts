import { beforeEach, describe, expect, it } from 'vitest'
import { normalizeStartRoute } from './startRoute'

describe('normalizeStartRoute', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('служебный hash Telegram (tgWebAppData) заменяется на главную', () => {
    window.history.replaceState(null, '', '/#tgWebAppData=abc&tgWebAppVersion=8.0')
    normalizeStartRoute(true)
    expect(window.location.hash).toBe('#/')
  })

  it('в Telegram всегда стартуем с главной, даже если в hash другой экран', () => {
    window.history.replaceState(null, '', '/#/games/crash')
    normalizeStartRoute(true)
    expect(window.location.hash).toBe('#/')
  })

  it('в обычном браузере нормальный маршрут сохраняется (обновление страницы)', () => {
    window.history.replaceState(null, '', '/#/games/crash')
    normalizeStartRoute(false)
    expect(window.location.hash).toBe('#/games/crash')
  })

  it('пустой hash в браузере становится главной', () => {
    normalizeStartRoute(false)
    expect(window.location.hash).toBe('#/')
  })
})
