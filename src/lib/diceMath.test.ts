import { describe, expect, it } from 'vitest'
import { GAME_RTP } from './gameConfig'
import {
  clampDiceTarget,
  diceCount,
  diceMultiplier,
  diceMultiplierScaled4,
  diceRollFromU,
  diceTargetFromMultiplier,
  diceWinChancePercentScaled,
  isDiceWin,
  isValidDiceTarget,
} from './diceMath'

describe('diceMath (4.7: множитель формулой, границы спеки)', () => {
  it('RTP конфига — 0.98', () => {
    expect(GAME_RTP).toBe(0.98)
  })

  it('шанс: over p = (9999−X)/10000, under p = X/10000 (сотые процента целочисленно)', () => {
    expect(diceCount(5099, 'over')).toBe(4900)
    expect(diceCount(4900, 'under')).toBe(4900)
    expect(diceWinChancePercentScaled(5099, 'over')).toBe(4900) // 49.00%
    expect(diceWinChancePercentScaled(4900, 'under')).toBe(4900)
  })

  it('границы шанса [0.01, 0.98]: over [199, 9899], under [100, 9800]', () => {
    expect(isValidDiceTarget(5099, 'over')).toBe(true)
    expect(isValidDiceTarget(9899, 'over')).toBe(true) // p = 0.01
    expect(isValidDiceTarget(9900, 'over')).toBe(false) // p < 0.01
    expect(isValidDiceTarget(199, 'over')).toBe(true) // p = 0.98
    expect(isValidDiceTarget(198, 'over')).toBe(false) // p > 0.98
    expect(isValidDiceTarget(100, 'under')).toBe(true) // p = 0.01
    expect(isValidDiceTarget(99, 'under')).toBe(false)
    expect(isValidDiceTarget(9800, 'under')).toBe(true) // p = 0.98
    expect(isValidDiceTarget(9801, 'under')).toBe(false)
  })

  it('множитель: m4 = floor(98 000 000 / c), округление только вниз', () => {
    // p = 0.49 → RTP/p = 2.00 ровно
    expect(diceMultiplierScaled4(5099, 'over')).toBe(20_000)
    expect(diceMultiplier(5099, 'over')).toBe(2)
    // p = 0.6533 → 0.98/0.6533 = 1.50007… → floor4 = 1.5000 (не вверх!)
    expect(diceMultiplierScaled4(3466, 'over')).toBe(15_000)
    // p = 0.01 → x98 ровно: c = 100 → floor(98e6/100) = 980000
    expect(diceMultiplierScaled4(9899, 'over')).toBe(980_000)
    // c = 4901 → 98e6/4901 = 19995.9… → floor = 19995 (вниз)
    expect(diceMultiplierScaled4(5098, 'over')).toBe(19_995)
  })

  it('EV не поднимается выше RTP ни для одной цели (полный перебор границ)', () => {
    for (let x = 100; x <= 9800; x += 1) {
      const p = x / 10_000
      const m = diceMultiplierScaled4(x, 'under') / 10_000
      expect(p * m).toBeLessThanOrEqual(GAME_RTP + 1e-12)
    }
    for (let x = 199; x <= 9899; x += 1) {
      const p = (9999 - x) / 10_000
      const m = diceMultiplierScaled4(x, 'over') / 10_000
      expect(p * m).toBeLessThanOrEqual(GAME_RTP + 1e-12)
    }
  })

  it('пересчёт цели из множителя: изменение поля пересчитывает остальные', () => {
    // m = 2 → p = 0.49 → over X = 5099, under X = 4900
    expect(diceTargetFromMultiplier(20_000, 'over')).toBe(5099)
    expect(diceTargetFromMultiplier(20_000, 'under')).toBe(4900)
    // m = 98 → p = 0.01 → граница
    expect(diceTargetFromMultiplier(980_000, 'over')).toBe(9899)
    // m < 1 → максимум шанса (p = 0.98)
    expect(diceTargetFromMultiplier(5_000, 'over')).toBe(199)
    // round-trip: target → multiplier → target
    const m4 = diceMultiplierScaled4(7777, 'under')
    expect(diceTargetFromMultiplier(m4, 'under')).toBe(7777)
  })

  it('clamp цели зажимает в допустимые границы направления', () => {
    expect(clampDiceTarget(50, 'over')).toBe(199)
    expect(clampDiceTarget(9999, 'over')).toBe(9899)
    expect(clampDiceTarget(50, 'under')).toBe(100)
    expect(clampDiceTarget(9999, 'under')).toBe(9800)
    expect(clampDiceTarget(5099.4, 'over')).toBe(5099)
  })

  it('ролл: floor(u × 10^4) ∈ [0, 9999]; выигрыш строго больше/меньше', () => {
    expect(diceRollFromU(0)).toBe(0)
    expect(diceRollFromU(0.9999)).toBe(9999)
    expect(() => diceRollFromU(1)).toThrow()
    expect(isDiceWin(5100, 5099, 'over')).toBe(true)
    expect(isDiceWin(5099, 5099, 'over')).toBe(false) // ровно X — не выигрыш
    expect(isDiceWin(4899, 4900, 'under')).toBe(true)
    expect(isDiceWin(4900, 4900, 'under')).toBe(false)
  })
})
