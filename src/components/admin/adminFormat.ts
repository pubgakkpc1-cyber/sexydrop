import { formatMinor } from '../../lib/money'

/**
 * Сумма для админки, которая никогда не падает: нет значения / дробное / минус — тоже показываем.
 * (formatMinor бросает исключение на минус и не-целые числа, а одна ошибка рендера даёт серый экран.)
 */
export function safeAmount(minor: unknown): string {
  const n = typeof minor === 'number' && Number.isFinite(minor) ? Math.trunc(minor) : 0
  return `${n < 0 ? '−' : ''}${formatMinor(Math.abs(n))}`
}

/** «12.5 TON» — суммы в админке. */
export const ton = (minor: unknown) => `${safeAmount(minor)} TON`

/** «+1.2 TON» / «−0.5 TON» — для итогов и движений по балансу. */
export function signedTon(minor: unknown): string {
  const n = typeof minor === 'number' && Number.isFinite(minor) ? Math.trunc(minor) : 0
  return `${n >= 0 ? '+' : '−'}${formatMinor(Math.abs(n))} TON`
}

/** «сейчас», «5 мин назад», «3 ч назад», «2 дн назад». */
export function ago(ts: number | null | undefined): string {
  if (!ts) return '—'
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts)
  if (s < 90) return 'сейчас'
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`
  return `${Math.floor(s / 86400)} дн назад`
}

/** «07.11.2026, 14:05». */
export function dateTime(ts: number | null | undefined): string {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
