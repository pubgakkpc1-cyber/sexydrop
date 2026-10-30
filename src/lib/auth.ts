/**
 * Вход через Telegram WebApp initData → JWT backend'а (POST /api/auth/telegram).
 * Токен живёт только в памяти вкладки. Вне Telegram (нет initData) токена нет —
 * защищённые запросы (например админ-панель) честно недоступны.
 */

import { getWebApp } from './telegram'

let token: string | null = null
let pending: Promise<string | null> | null = null

async function login(): Promise<string | null> {
  const initData = (getWebApp() as unknown as { initData?: string } | undefined)?.initData
  if (!initData) return null

  try {
    const res = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ init_data: initData }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { token?: string }
    token = data.token ?? null
    return token
  } catch {
    return null
  }
}

/** Возвращает JWT (логинится при первом вызове) или null, если вход невозможен. */
export function getAuthToken(): Promise<string | null> {
  if (token) return Promise.resolve(token)
  pending ??= login().finally(() => {
    pending = null
  })
  return pending
}

/** Заголовки с Bearer-токеном; пустой объект, если токена нет. */
export async function authHeaders(): Promise<Record<string, string>> {
  const t = await getAuthToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}
