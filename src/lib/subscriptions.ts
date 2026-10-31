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

const OPENED_KEY = 'sexydrop.subOpened'

function readOpened(): string[] {
  try {
    const raw = window.localStorage.getItem(OPENED_KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** Канал, который сервер проверить не может, считается выполненным после перехода по ссылке «Подписаться». */
export function markChannelOpened(key: string): void {
  try {
    const list = readOpened()
    if (!list.includes(key)) window.localStorage.setItem(OPENED_KEY, JSON.stringify([...list, key]))
  } catch {
    /* без localStorage придётся нажимать «Подписаться» каждый раз */
  }
}

export function isChannelOpened(key: string): boolean {
  return readOpened().includes(key)
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
    // непроверяемые каналы (бот не админ) обязательны «по честному слову»: нужно хотя бы открыть ссылку
    const ok = data.ok && data.channels.every((c) => c.subscribed !== null || isChannelOpened(c.key))
    if (ok) okUntil = Date.now() + OK_TTL_MS
    return { ok, channels: data.channels }
  } catch {
    return { ok: true, channels: [] }
  }
}
