import { getWebApp } from './telegram'

/** Запрос к админ-API: личность админа берётся на сервере из подписанного initData. */
export async function adminFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const initData = (getWebApp() as unknown as { initData?: string } | undefined)?.initData
  if (!initData) return { ok: false, error: 'Откройте приложение из Telegram' }
  try {
    const res = await fetch(path, {
      method: init.method ?? 'GET',
      headers: { 'X-Telegram-Init-Data': initData, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    })
    const data = (await res.json().catch(() => null)) as (T & { detail?: string }) | null
    if (!res.ok) return { ok: false, error: data?.detail ?? `Ошибка ${res.status}` }
    return { ok: true, data: data as T }
  } catch {
    return { ok: false, error: 'Нет связи с сервером' }
  }
}
