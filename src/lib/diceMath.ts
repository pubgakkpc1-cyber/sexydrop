import { GAME_RTP } from './gameConfig'

/**
 * Математика Дайса (4.7, спека 10.7).
 *
 * Ролл: целое `roll ∈ [0, 9999]` (10 000 равновероятных значений).
 * Ставка «больше X»: `p = (9999 − X) / 10000`; «меньше X»: `p = X / 10000`.
 * Границы шанса [0.01, 0.98] (спека) → допустимые X:
 *   over: X ∈ [199, 9899] (c = 9999 − X ∈ [100, 9800]);
 *   under: X ∈ [100, 9800] (c = X).
 *
 * Множитель: `multiplier = RTP / p`, округление ТОЛЬКО вниз до 4 знаков —
 * целочисленно: m4 = floor(RTP × 10^4 / c × 10^4 ... ) → m4 = floor(98 000 000 / c),
 * m = m4 / 10^4. Тогда p·m = c·m4 / 10^8 ≤ 0.98 — округление не может поднять RTP.
 * EV = (RTP − 1)·bet (house edge 2%) до округления; floor2 смещает в пользу казны.
 *
 * Выплата: floor(bet × m4 / 10^4) — целое, в пользу казны.
 */

const RTP_PCT = Math.round(GAME_RTP * 100) // 98

export type DiceDirection = 'over' | 'under'

export const DICE_MIN_TARGET = 1
export const DICE_MAX_TARGET = 9999
/** Минимальный/максимальный размер «стороны» (шанс 0.01–0.98). */
const MIN_COUNT = 100
const MAX_COUNT = 9800

export function isDiceDirection(value: unknown): value is DiceDirection {
  return value === 'over' || value === 'under'
}

/** Число выигрывающих значений ролла: over → 9999−X, under → X. */
export function diceCount(target: number, direction: DiceDirection): number {
  return direction === 'over' ? DICE_MAX_TARGET - target : target
}

/** Допустимость цели: X ∈ [1, 9999] и шанс в [0.01, 0.98]. */
export function isValidDiceTarget(target: number, direction: DiceDirection): boolean {
  if (!Number.isSafeInteger(target)) return false
  if (target < DICE_MIN_TARGET || target > DICE_MAX_TARGET) return false
  const c = diceCount(target, direction)
  return c >= MIN_COUNT && c <= MAX_COUNT
}

/** Ближайшая допустимая цель к запрошенной (для ползунка/инпута). */
export function clampDiceTarget(target: number, direction: DiceDirection): number {
  const lo = direction === 'over' ? DICE_MAX_TARGET - MAX_COUNT : MIN_COUNT
  const hi = direction === 'over' ? DICE_MAX_TARGET - MIN_COUNT : MAX_COUNT
  return Math.min(hi, Math.max(lo, Math.round(target)))
}

/**
 * Множитель в десятитысячных (floor до 4 знаков, только вниз).
 * Требует валидной цели; для невалидной возвращает 0.
 */
export function diceMultiplierScaled4(target: number, direction: DiceDirection): number {
  if (!isValidDiceTarget(target, direction)) return 0
  return Math.floor((RTP_PCT * 1_000_000) / diceCount(target, direction))
}

/** Множитель как float (только для отображения; деньги считают scaled-функции). */
export function diceMultiplier(target: number, direction: DiceDirection): number {
  return diceMultiplierScaled4(target, direction) / 10_000
}

/** Шанс выигрыша в сотых процента: c/100 % — целочисленно (c целое). */
export function diceWinChancePercentScaled(target: number, direction: DiceDirection): number {
  if (!isValidDiceTarget(target, direction)) return 0
  return diceCount(target, direction) // процентов = c/100
}

/**
 * Пересчёт цели из запрошенного множителя (изменение любого поля пересчитывает
 * остальные): p ≤ RTP/m ⇔ c ≤ RTP×10^4/m × 10^4... целочисленно
 * c = floor(RTP_PCT × 1_000_000 / m4), зажим в [100, 9800].
 */
export function diceTargetFromMultiplier(mScaled4: number, direction: DiceDirection): number {
  if (!Number.isSafeInteger(mScaled4) || mScaled4 < 10_000) {
    // m < 1 → p > 0.98: максимум шанса
    return direction === 'over' ? DICE_MAX_TARGET - MAX_COUNT : MAX_COUNT
  }
  const capped = Math.min(mScaled4, (RTP_PCT * 1_000_000) / MIN_COUNT) // m ≤ 98 (p ≥ 0.01)
  const c = Math.floor((RTP_PCT * 1_000_000) / capped)
  const clamped = Math.min(MAX_COUNT, Math.max(MIN_COUNT, c))
  return direction === 'over' ? DICE_MAX_TARGET - clamped : clamped
}

/** Ролл из u ∈ [0, 1): floor(u × 10^4) — 10 000 равновероятных значений. */
export function diceRollFromU(u: number): number {
  if (u < 0 || u >= 1) throw new Error(`rng must return [0, 1), got: ${u}`)
  return Math.floor(u * 10_000)
}

export function isDiceWin(roll: number, target: number, direction: DiceDirection): boolean {
  return direction === 'over' ? roll > target : roll < target
}
