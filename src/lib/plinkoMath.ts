import { GAME_RTP } from './gameConfig'

/**
 * Математика Плинко (4.6, спека 10.7–10.10: коэффициенты только формулой).
 *
 * Шар проходит n «монеток»: P(карман k) = C(n, k) / 2^n (карманов n+1).
 *
 * Буквальная формула дорожной карты m_k = RTP / P(k) даёт
 * EV = Σ P(k)·m_k = (n+1)·RTP — это сломанная экономика, поэтому множители
 * нормируются на число карманов:
 *
 *   m_k = floor2( RTP / (P(k) · (n+1)) )
 *
 * Тогда EV ряда = Σ P(k)·m_k = (1/(n+1))·Σ RTP = RTP ровно до округления,
 * а округление вниз (floor2) смещает EV чуть ниже RTP — в пользу казны.
 * Максимумы (RTP = 0.98): n=8 → x27.87, n=12 → x308.77, n=16 → x3777.95.
 */

export const PLINKO_ROWS = [8, 12, 16] as const
export type PlinkoRows = (typeof PLINKO_ROWS)[number]

/** Целая сотая доля RTP для целочисленной формулы множителей (0.98 → 98). */
const RTP_PCT = Math.round(GAME_RTP * 100)

export function isPlinkoRows(value: unknown): value is PlinkoRows {
  return PLINKO_ROWS.includes(value as PlinkoRows)
}

/** C(n, k) — целое; при n ≤ 16 промежуточные произведения точны в float. */
export function binomial(n: number, k: number): number {
  if (!Number.isSafeInteger(n) || n < 0 || k < 0 || k > n) return 0
  let result = 1
  for (let i = 0; i < k; i += 1) {
    result = (result * (n - i)) / (i + 1)
  }
  return result
}

/** Вероятность кармана: путь шара — n независимых монеток. */
export function bucketProbability(n: number, k: number): number {
  return binomial(n, k) / 2 ** n
}

/**
 * Множитель кармана: floor2(RTP / (P(k)·(n+1))) — только целочисленно,
 * чтобы округление никогда не поднимало RTP выше настроенного.
 * Допустимо при RTP с не более чем двумя десятичными знаками (0.98).
 */
export function bucketMultiplier(n: number, k: number): number {
  const c = binomial(n, k)
  return Math.floor((RTP_PCT * 2 ** n) / (c * (n + 1))) / 100
}

/** Ряд множителей карманов k = 0…n (кэш формулы — проверяется тестом). */
export function plinkoMultipliers(n: number): number[] {
  return Array.from({ length: n + 1 }, (_, k) => bucketMultiplier(n, k))
}

/**
 * Точный RTP ряда в рациональной форме: numerator / (2^n · 100).
 * EV = Σ P(k)·m_k; floor2 смещает его ниже RTP ровно на (< 0.01).
 */
export function plinkoExactRtp(n: number): { numerator: bigint; denominator: bigint } {
  let numerator = 0n
  for (let k = 0; k <= n; k += 1) {
    const c = BigInt(binomial(n, k))
    const mScaled = BigInt(Math.floor((RTP_PCT * 2 ** n) / (Number(c) * (n + 1))))
    numerator += c * mScaled
  }
  return { numerator, denominator: BigInt(2 ** n * 100) }
}

/** Максимум ряда — крайний карман k=0; инвариант формулы (всегда существует). */
export function plinkoMaxMultiplier(n: number): number {
  const m = bucketMultiplier(n, 0)
  if (!Number.isFinite(m) || m <= 0) {
    throw new Error(`plinko invariant broken for n=${n}`)
  }
  return m
}

/** Цвет чипа кармана по референсу Plinko-кита: центр — синий, середина — золото, края — красный. */export type PlinkoChipColor = 'blue' | 'gold' | 'red'

export function plinkoChipColor(m: number): PlinkoChipColor {
  if (m > 3) return 'red'
  if (m > 1) return 'gold'
  return 'blue'
}

/** «x2», «x1.9», «x27.87» — без хвостовых нулей. */
export function formatMultiplier(m: number): string {
  return `x${m.toFixed(2).replace(/\.?0+$/, '')}`
}
