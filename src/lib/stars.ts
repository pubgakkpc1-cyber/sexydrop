import type { Minor } from './money'

/**
 * Курс Telegram Stars → TON (настройка продукта): 175 Stars = 1 TON.
 * 1 TON = 1000 minor ⇒ minor = floor(stars × 1000 / 175). Округление вниз
 * (в пользу казны, правило проекта).
 */
export const STARS_PER_TON = 175
export const STARS_MIN = 10
export const STARS_MAX = 10_000

/** Сколько TON даёт 1 Star, строкой до 4 знаков вниз: «0.0057». */
export const TON_PER_STAR_LABEL = (Math.floor((1 / STARS_PER_TON) * 10_000) / 10_000).toFixed(4)

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
