import { binomial } from './plinkoMath'
import { GAME_RTP } from './gameConfig'

/**
 * Математика Мин (4.8, спека 10.8). Поле 5×5 = 25 клеток, m мин, игрок открывает
 * клетки по одной; в любой момент можно забрать.
 *
 * Шанс открыть k клеток без мины (гипергеометрическое распределение):
 *   P(k) = C(25 − m, k) / C(25, k)
 * Множитель выплаты при k открытых клетках — только формула, округление вниз
 * до сотых, целочисленно в сотых:
 *   m_hundredths = floor(RTP × 100 × C(25, k) / C(25 − m, k))
 *   ⇒ P(k) · m = C(25−m,k)/C(25,k) · floor(...) / 100 ≤ RTP всегда.
 *
 * Полный сбор (k = 25 − m): C(25−m, 25−m) = 1 ⇒
 *   m_hundredths = floor(RTP × 100 × C(25, 25−m)) = floor(98 × C(25, m)).
 * Пример: m = 24 → x24.5, P = 1/25, EV = 0.98 ровно.
 *
 * Выплата: floor(bet × m_hundredths / 100) — целое, в пользу казны.
 */

const RTP_PCT = Math.round(GAME_RTP * 100) // 98

export const MINES_TILES = 25
export const MINES_MIN_COUNT = 1
export const MINES_MAX_COUNT = 24

export function isValidMinesCount(minesCount: number): boolean {
  return (
    Number.isSafeInteger(minesCount) &&
    minesCount >= MINES_MIN_COUNT &&
    minesCount <= MINES_MAX_COUNT
  )
}

/**
 * Множитель выплаты при k открытых клетках, в сотых (integer).
 * k = 0 → 0 (забирать нечего); невалидные (m, k) → 0.
 */
export function minesMultiplierHundredths(minesCount: number, opened: number): number {
  if (!isValidMinesCount(minesCount)) return 0
  if (!Number.isSafeInteger(opened) || opened < 1 || opened > MINES_TILES - minesCount) return 0
  const safe = MINES_TILES - minesCount
  return Math.floor((RTP_PCT * binomial(MINES_TILES, opened)) / binomial(safe, opened))
}

/** Множитель как float (только для отображения; деньги считают сотые). */
export function minesMultiplier(minesCount: number, opened: number): number {
  return minesMultiplierHundredths(minesCount, opened) / 100
}

/**
 * Шанс дожить до k открытых клеток: C(25−m, k)/C(25, k) — float только
 * для отображения/тестов; деньги и исходы его не используют.
 */
export function minesSurviveProbability(minesCount: number, opened: number): number {
  if (!isValidMinesCount(minesCount)) return 0
  if (opened < 0 || opened > MINES_TILES - minesCount) return 0
  return binomial(MINES_TILES - minesCount, opened) / binomial(MINES_TILES, opened)
}

/**
 * Раскладка мин: частичный Fisher–Yates по колоде [0…24], первые m элементов.
 * Генерируется «сервером» (demo-сервис) при старте раунда и не попадает
 * в клиентское состояние до конца раунда (TIER 7, 7.6).
 */
export function minesPickPositions(minesCount: number, rng: () => number): number[] {
  if (!isValidMinesCount(minesCount)) {
    throw new Error(`invalid mines count: ${minesCount}`)
  }
  const deck = Array.from({ length: MINES_TILES }, (_, i) => i)
  for (let i = 0; i < minesCount; i += 1) {
    const j = i + Math.floor(rng() * (MINES_TILES - i))
    if (j < 0 || j >= MINES_TILES) throw new Error(`rng must return [0, 1)`)
    const a = deck[i]
    const b = deck[j]
    if (a === undefined || b === undefined) throw new Error('deck index out of range')
    deck[i] = b
    deck[j] = a
  }
  return deck.slice(0, minesCount).sort((a, b) => a - b)
}
