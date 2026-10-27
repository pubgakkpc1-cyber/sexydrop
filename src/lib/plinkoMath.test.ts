import { describe, expect, it } from 'vitest'
import { GAME_RTP } from './gameConfig'
import {
  binomial,
  bucketMultiplier,
  bucketProbability,
  plinkoChipColor,
  plinkoExactRtp,
  plinkoMultipliers,
  PLINKO_ROWS,
} from './plinkoMath'

/** Точное EV ряда в виде BigInt-рационали уже нормировано к единице. */
function assertRtpWindow(n: number): void {
  const { numerator, denominator } = plinkoExactRtp(n)
  // EV = numerator / denominator; требуем 0.97 ≤ EV ≤ 0.98:
  //   numerator ≤ 98·2^n   (не выше RTP),
  //   numerator ≥ 97·2^n   (floor2 съедает меньше 0.01).
  const twoPowN = BigInt(2 ** n)
  expect(numerator).toBeLessThanOrEqual(98n * twoPowN)
  expect(numerator).toBeGreaterThanOrEqual(97n * twoPowN)
  expect(denominator).toBe(BigInt(2 ** n * 100))
}

describe('plinkoMath (4.6: коэффициенты только формулой)', () => {
  it('RTP конфига — 0.98 (формула целочисленная, привязана к этому значению)', () => {
    expect(GAME_RTP).toBe(0.98)
    expect(PLINKO_ROWS).toEqual([8, 12, 16])
  })

  it('биномиальные коэффициенты и вероятности карманов: Σ P = 1', () => {
    for (const n of PLINKO_ROWS) {
      let sum = 0
      for (let k = 0; k <= n; k += 1) {
        sum += bucketProbability(n, k)
        expect(bucketProbability(n, k)).toBeCloseTo(binomial(n, k) / 2 ** n, 12)
      }
      expect(sum).toBeCloseTo(1, 12)
    }
    expect(binomial(8, 4)).toBe(70)
    expect(binomial(12, 6)).toBe(924)
    expect(binomial(16, 8)).toBe(12870)
  })

  it.each(PLINKO_ROWS)('ряд %i: EV точного рационала в окне [0.97, 0.98]', (n) => {
    assertRtpWindow(n)
  })

  it('максимумы множителей (крайние карманы): x27.87 / x308.77 / x3777.95', () => {
    expect(plinkoMultipliers(8)[0]).toBe(27.87)
    expect(plinkoMultipliers(12)[0]).toBe(308.77)
    expect(plinkoMultipliers(16)[0]).toBe(3777.95)
  })

  it('центральные карманы ниже 1 (край кармана резко растёт)', () => {
    const m8 = plinkoMultipliers(8)
    expect(m8[4] ?? NaN).toBeLessThan(1)
    expect(m8[3] ?? NaN).toBeLessThan(1)
    expect(m8[2] ?? NaN).toBeLessThan(1)
  })

  it.each(PLINKO_ROWS)('ряд %i: множитель — кэш формулы, пересчёт совпадает', (n) => {
    const row = plinkoMultipliers(n)
    for (let k = 0; k <= n; k += 1) {
      const mk = row[k] ?? Number.NaN
      expect(mk).toBe(bucketMultiplier(n, k))
      // Каждое слагаемое P(k)·m_k ≤ RTP/(n+1) — округление вниз в пользу казны.
      expect(bucketProbability(n, k) * mk).toBeLessThanOrEqual(GAME_RTP / (n + 1) + 1e-12)
    }
  })

  it('цвет чипа кармана: ≤1 синий, ≤3 золото, выше — красный', () => {
    expect(plinkoChipColor(0.5)).toBe('blue')
    expect(plinkoChipColor(1)).toBe('blue')
    expect(plinkoChipColor(1.2)).toBe('gold')
    expect(plinkoChipColor(3)).toBe('gold')
    expect(plinkoChipColor(4)).toBe('red')
    expect(plinkoChipColor(3777.95)).toBe('red')
  })
})
