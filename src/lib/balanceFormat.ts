import { formatMinor } from './money'
import { minorToStars } from './stars'

/** Баланс TON для шапок: больше 0.1 — одна цифра после точки (вниз), иначе как есть (0.023). */
export function formatBalanceTon(minor: number): string {
  if (minor <= 100) return formatMinor(minor)
  const tenths = Math.floor(minor / 100)
  return tenths % 10 === 0 ? String(tenths / 10) : `${Math.floor(tenths / 10)}.${tenths % 10}`
}

/** Баланс в Stars с пробелами-разделителями. */
export function formatBalanceStars(minor: number): string {
  return minorToStars(minor).toLocaleString('ru-RU').replace(/\u00a0/g, ' ')
}
