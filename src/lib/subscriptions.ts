import { getWebApp } from './telegram'

export interface SubChannel {
  key: string
  title: string
  url: string
  /** true — подписан, false — нет, null — сервер не смог проверить (бот не админ канала). */
  subscribed: boolean | null
}

export interface SubCheck {
  ok: boolean
  channels: SubChannel[]
}

/** Подтверждённая подписка живёт 5 минут, чтобы не дёргать Telegram на каждый клик. */
const OK_TTL_MS = 5 * 60 * 1000
let okUntil = 0

/**
 * Проверяет обязательные подписки перед бесплатным кейсом. Личность берётся из подписанного
 * initData на сервере. Вне Telegram (нет initData) и при недоступном сервере проверка пропускается:
 * подтвердить подписку там нечем, и это не должно блокировать игру.
 */
export async function checkSubscriptions(force = false): Promise<SubCheck> {
  if (!force && Date.now() < okUntil) return { ok: true, channels: [] }
  const initData = (getWebApp() as unknown as { initData?: string } | undefined)?.initData
  if (!initData) return { ok: true, channels: [] }
  try {
    const res = await fetch('/api/subscriptions/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ init_data: initData }),
    })
    if (!res.ok) return { ok: true, channels: [] }
    const data = (await res.json()) as SubCheck
    if (data.ok) okUntil = Date.now() + OK_TTL_MS
    return data
  } catch {
    return { ok: true, channels: [] }
  }
}
