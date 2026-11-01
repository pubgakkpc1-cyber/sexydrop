import { apiGet, apiPost } from './api'
import type { Minor } from './money'

/** Ответ /api/deposits/config: какие способы реальной оплаты включены на сервере. */
export interface DepositConfig {
  ton_address: string | null
  cryptobot: boolean
  stars: boolean
  min_minor: Minor
  max_minor: Minor
}

export type PaymentStatus = { status: 'pending' | 'active' | 'expired' } | { status: 'paid'; amount_minor: Minor; balance_minor?: Minor }

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

/** Случайный секрет платежа: знает только это устройство, в блокчейн и в логи не попадает. */
export function newSecret(): string {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function createCryptoInvoice(
  amountMinor: Minor,
  secret: string,
): Promise<{ invoice_id: number; pay_url: string; mini_app_url?: string }> {
  return apiPost('/api/deposits/cryptobot/invoice', { amount_minor: amountMinor, secret })
}

export function cryptoInvoiceStatus(invoiceId: number, secret: string): Promise<PaymentStatus> {
  return apiGet(`/api/deposits/cryptobot/invoice/${invoiceId}?secret=${encodeURIComponent(secret)}`)
}

export function createStarsInvoice(stars: number, secret: string): Promise<{ invoice_url: string }> {
  return apiPost('/api/deposits/stars/invoice', { stars, secret })
}

export function starsPaymentStatus(secret: string): Promise<PaymentStatus> {
  return apiGet(`/api/deposits/stars/status?secret=${encodeURIComponent(secret)}`)
}

export async function tonComment(secret: string): Promise<string> {
  return (await apiGet<{ comment: string }>(`/api/deposits/ton/comment?secret=${encodeURIComponent(secret)}`)).comment
}

export function tonPaymentStatus(secret: string): Promise<PaymentStatus> {
  return apiGet(`/api/deposits/ton/status?secret=${encodeURIComponent(secret)}`)
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
