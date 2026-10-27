import { describe, expect, it } from 'vitest'
import { GAME_RTP } from './gameConfig'
import { binomial } from './plinkoMath'
import {
  MINES_TILES,
  minesMultiplier,
  minesMultiplierHundredths,
  minesPickPositions,
  minesSurviveProbability,
  isValidMinesCount,
} from './minesMath'

describe('minesMath (4.8: множитель формулой, гипергеометрия)', () => {
  it('RTP конфига — 0.98', () => {
    expect(GAME_RTP).toBe(0.98)
  })

  it('валидное число мин: 1–24, ноль и 25 отвергаются', () => {
    expect(isValidMinesCount(1)).toBe(true)
    expect(isValidMinesCount(24)).toBe(true)
    expect(isValidMinesCount(0)).toBe(false)
    expect(isValidMinesCount(25)).toBe(false)
    expect(isValidMinesCount(3.5)).toBe(false)
  })

  it('множитель: m_h = floor(98·C(25,k)/C(25−m,k)) — примеры вручную', () => {
    // m=3, k=1: C(25,1)=25, C(22,1)=22 → floor(98·25/22) = floor(111.36) = 111
    expect(minesMultiplierHundredths(3, 1)).toBe(111)
    // m=3, k=2: C(25,2)=300, C(22,2)=231 → floor(98·300/231) = floor(127.27) = 127
    expect(minesMultiplierHundredths(3, 2)).toBe(127)
    // m=3, k=3: C(25,3)=2300, C(22,3)=1540 → floor(146.23) = 146
    expect(minesMultiplierHundredths(3, 3)).toBe(146)
    // полный сбор m=24, k=1: floor(98·25) = 2450 → x24.5
    expect(minesMultiplierHundredths(24, 1)).toBe(2450)
    expect(minesMultiplier(24, 1)).toBe(24.5)
    // невалидные: k=0, k > 25−m, m вне диапазона
    expect(minesMultiplierHundredths(3, 0)).toBe(0)
    expect(minesMultiplierHundredths(3, 23)).toBe(0)
    expect(minesMultiplierHundredths(0, 1)).toBe(0)
  })

  it('полный сбор согласован с формулой: k = 25−m даёт floor(98·C(25,m))', () => {
    for (let m = 1; m <= 24; m += 1) {
      const k = MINES_TILES - m
      expect(minesMultiplierHundredths(m, k)).toBe(
        Math.floor(98 * binomial(MINES_TILES, m)),
      )
    }
  })

  it('P(k) дожития = C(25−m,k)/C(25,k); сумма по ветвям согласована', () => {
    // m=3: P(1) = 22/25 = 0.88
    expect(minesSurviveProbability(3, 1)).toBeCloseTo(22 / 25, 12)
    // m=3: P(3) = C(22,3)/C(25,3) = 1540/2300
    expect(minesSurviveProbability(3, 3)).toBeCloseTo(1540 / 2300, 12)
    // P(0) = 1 — начало раунда
    expect(minesSurviveProbability(3, 0)).toBe(1)
    // монотонность по k
    for (let k = 1; k < 22; k += 1) {
      expect(minesSurviveProbability(3, k)).toBeGreaterThan(minesSurviveProbability(3, k + 1))
    }
  })

  it('EV любого кешаута ≤ RTP для всех пар (m, k) — полный перебор', () => {
    for (let m = 1; m <= 24; m += 1) {
      for (let k = 1; k <= MINES_TILES - m; k += 1) {
        const ev = minesSurviveProbability(m, k) * minesMultiplier(m, k)
        expect(ev).toBeLessThanOrEqual(GAME_RTP + 1e-12)
      }
    }
  })

  it('раскладка мин: детерминизм по rng, уникальность, размер, границы', () => {
    // rng = () => 0 → j = i → мины [0..m−1]
    expect(minesPickPositions(3, () => 0)).toEqual([0, 1, 2])
    // rng = () => 0.999999 → j = i + floor(rng·(25−i)) = конец колоды → [0, 1, 24]
    expect(minesPickPositions(3, () => 0.999999)).toEqual([0, 1, 24])
    // уникальность и размер при живом ГСЧ
    const positions = minesPickPositions(10, Math.random)
    expect(positions).toHaveLength(10)
    expect(new Set(positions).size).toBe(10)
    for (const p of positions) {
      expect(p).toBeGreaterThanOrEqual(0)
      expect(p).toBeLessThanOrEqual(24)
    }
    // одна и та же последовательность rng → одна и та же раскладка
    let counter = 0
    const seq = () => (counter += 1) / 100 // 0.01, 0.02, …
    const a = minesPickPositions(5, seq)
    counter = 0
    expect(minesPickPositions(5, seq)).toEqual(a)
    // невалидное число мин — ошибка
    expect(() => minesPickPositions(0, Math.random)).toThrow()
    expect(() => minesPickPositions(25, Math.random)).toThrow()
  })
})
