import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/**
 * Экраны грузятся отдельными файлами (lazy). После деплоя у файлов новые имена, а старые с
 * сервера пропадают: открытое (или закэшированное Telegram) приложение просит файл, которого
 * уже нет, — загрузка падает и без защиты остаётся серый экран. Тогда один раз перезагружаемся
 * со свежей версией.
 */

const KEY = 'sexydrop_chunk_reload_at'
const COOLDOWN_MS = 30_000

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading (CSS )?chunk|ChunkLoadError|MIME type/i

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '')
  return CHUNK_ERROR.test(message)
}

/**
 * Перезагрузка за свежей версией (с меткой в адресе, чтобы обойти кэш WebView).
 * Не чаще раза в 30 секунд, иначе — false (чтобы не уйти в бесконечную перезагрузку).
 */
export function reloadForNewVersion(force = false): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(KEY) || 0)
    if (!force && Date.now() - last < COOLDOWN_MS) return false
    window.sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    /* без sessionStorage просто перезагружаемся */
  }
  const url = new URL(window.location.href)
  url.searchParams.set('v', String(Date.now()))
  window.location.replace(url.toString())
  return true
}

/** lazy() с защитой: файл экрана не загрузился из-за нового деплоя — перезагрузка за новой версией. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- как у самого React.lazy
export function lazyScreen<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((error: unknown) => {
      if (isChunkLoadError(error) && reloadForNewVersion()) {
        // страница уже перезагружается — не показываем ошибку
        return new Promise<{ default: T }>(() => undefined)
      }
      throw error
    }),
  )
}
