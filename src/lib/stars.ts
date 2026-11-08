import type { Minor } from './money'

/**
 * Единый курс Stars → TON (настройка продукта): 100 Stars = 1 TON, то есть 1 Star = 10 minor.
 * Действует и для пополнения платными Telegram Stars, и для обмена заработанных звёзд.
 * Округление вниз (в пользу казны, правило проекта).
 */
export const MINOR_PER_STAR = 10
export const STARS_PER_TON = 1000 / MINOR_PER_STAR // 100
export const STARS_MIN = 10
export const STARS_MAX = 10_000

/** Сколько TON даёт 1 Star, строкой до 4 знаков вниз: «0.0057». */
export const TON_PER_STAR_LABEL = (Math.floor((1 / STARS_PER_TON) * 10_000) / 10_000).toFixed(4)

/** Сколько minor TON даёт указанное число Stars (целое). */
export function starsToMinor(stars: number): Minor {
  if (!Number.isFinite(stars) || stars <= 0) return 0
  return Math.floor(stars) * MINOR_PER_STAR
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

/** Сколько Stars соответствует сумме в minor TON (округление вниз). */
export function minorToStars(minor: Minor): number {
  if (!Number.isFinite(minor) || minor <= 0) return 0
  return Math.floor(minor / MINOR_PER_STAR)
}

/**
 * Обмен ЗАРАБОТАННЫХ звёзд на TON (конвертер): 100 ★ = 1 TON, то есть 1 ★ = 10 minor.
 * Совпадает с курсом пополнения платными Telegram Stars.
 */
export const EXCHANGE_MINOR_PER_STAR = 10

export function exchangeStarsToMinor(stars: number): Minor {
  if (!Number.isFinite(stars) || stars <= 0) return 0
  return Math.floor(stars) * EXCHANGE_MINOR_PER_STAR
}
