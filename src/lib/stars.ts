import type { Minor } from './money'

/**
 * Курс Telegram Stars → TON (настройка продукта). 1 TON = 200 Stars.
 * Сумма в minor (1 TON = 1000 minor): minor = stars × 1000 / 200 = stars × 5.
 * Округление вниз — в пользу казны (правило проекта).
 */
export const STARS_PER_TON = 200
export const STARS_MIN = 10
export const STARS_MAX = 10_000

/** Сколько minor TON даёт указанное число Stars (целое). */
export function starsToMinor(stars: number): Minor {
  if (!Number.isFinite(stars) || stars <= 0) return 0
  return Math.floor((Math.floor(stars) * 1000) / STARS_PER_TON)
}

/** Парсинг ввода Stars: только целые цифры. */
export function parseStars(input: string): number | null {
  const clean = input.replace(/\s/g, '')
  if (!/^\d+$/.test(clean)) return null
  const value = Number(clean)
  return Number.isSafeInteger(value) ? value : null
}

export function isValidStars(stars: number | null): stars is number {
  return stars !== null && stars >= STARS_MIN && stars <= STARS_MAX
}
