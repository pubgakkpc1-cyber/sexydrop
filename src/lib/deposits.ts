import type { Minor } from './money'

/** Ответ /api/deposits/config: какие способы реальной оплаты включены на сервере. */
export interface DepositConfig {
  ton_address: string | null
  cryptobot: boolean
  stars: boolean
  min_minor: Minor
  max_minor: Minor
}

export type PaymentStatus = { status: 'pending' | 'active' | 'expired' } | { status: 'paid'; amount_minor: Minor }

let cached: Promise<DepositConfig | null> | null = null

/** Конфиг способов пополнения; null — сервер недоступен (остаётся демо-режим). Кэшируется. */
export function loadDepositConfig(): Promise<DepositConfig | null> {
  if (!cached) {
    cached = Promise.resolve()
      .then(() => fetch('/api/deposits/config', { cache: 'no-store' }))
      .then((r) => (r.ok ? (r.json() as Promise<DepositConfig>) : null))
      .catch(() => null)
  }
  return cached
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = 'Ошибка сервера'
    try {
      detail = ((await res.json()) as { detail?: string }).detail ?? detail
    } catch {
      /* тело не JSON */
    }
    throw new Error(detail)
  }
  return (await res.json()) as T
}

/** Случайный секрет платежа: знает только это устройство, в блокчейн и в логи не попадает. */
export function newSecret(): string {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function createCryptoInvoice(
  amountMinor: Minor,
  secret: string,
): Promise<{ invoice_id: number; pay_url: string; mini_app_url?: string }> {
  const res = await fetch('/api/deposits/cryptobot/invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount_minor: amountMinor, secret }),
  })
  return json(res)
}

export async function cryptoInvoiceStatus(invoiceId: number, secret: string): Promise<PaymentStatus> {
  const res = await fetch(`/api/deposits/cryptobot/invoice/${invoiceId}?secret=${encodeURIComponent(secret)}`, {
    cache: 'no-store',
  })
  return json(res)
}

export async function createStarsInvoice(stars: number, secret: string): Promise<{ invoice_url: string }> {
  const res = await fetch('/api/deposits/stars/invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stars, secret }),
  })
  return json(res)
}

export async function starsPaymentStatus(secret: string): Promise<PaymentStatus> {
  const res = await fetch(`/api/deposits/stars/status?secret=${encodeURIComponent(secret)}`, { cache: 'no-store' })
  return json(res)
}

export async function tonComment(secret: string): Promise<string> {
  const res = await fetch(`/api/deposits/ton/comment?secret=${encodeURIComponent(secret)}`)
  return (await json<{ comment: string }>(res)).comment
}

export async function tonPaymentStatus(secret: string): Promise<PaymentStatus> {
  const res = await fetch(`/api/deposits/ton/status?secret=${encodeURIComponent(secret)}`, { cache: 'no-store' })
  return json(res)
}

/**
 * BOC ячейки с текстовым комментарием (0x00000000 + utf8), base64 — поле payload в TON Connect.
 * Только ASCII и до 123 байт: хватает для нашего комментария «sd-…».
 */
export function commentPayload(comment: string): string {
  if (!/^[\x20-\x7e]{1,123}$/.test(comment)) throw new Error('Некорректный комментарий')
  const data = [0, 0, 0, 0, ...Array.from(comment, (c) => c.charCodeAt(0))]
  const cell = [0x00, data.length * 2, ...data] // d1 = 0 ссылок, d2 = 2 * байт
  const boc = [0xb5, 0xee, 0x9c, 0x72, 0x01, 0x01, 0x01, 0x01, 0x00, cell.length, 0x00, ...cell]
  return btoa(String.fromCharCode(...boc))
}

/** Сумма в нанотонах строкой (1 TON = 1000 minor = 1e9 нано). */
export function minorToNano(minor: Minor): string {
  return (BigInt(minor) * 1_000_000n).toString()
}
