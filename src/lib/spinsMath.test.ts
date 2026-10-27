import { describe, expect, it } from 'vitest'
import { GAME_RTP } from './gameConfig'
import {
  SPINS_BONUS_WEIGHT,
  SPINS_CELLS,
  SPINS_GIFTS,
  SPINS_SYMBOLS,
  bonusBuyPriceMinor,
  bonusEvNumerator,
  bonusFreeStakeMinor,
  bonusMultiplierHundredths,
  pickGiftIndex,
  pickSpinsIndex,
  spinsMultiplierHundredths,
  weightsTotal,
} from './spinsMath'

/** Точный EV ставки B в рациональных числах (BigInt): числитель и знаменатель. */
function exactEvRtp(bet: number, doubleChance: boolean): { num: bigint; den: bigint } {
  const W = BigInt(weightsTotal(doubleChance))
  const wBonus = BigInt(doubleChance ? SPINS_BONUS_WEIGHT * 2 : SPINS_BONUS_WEIGHT)
  let giftSum = 0n
  for (let i = 0; i < SPINS_GIFTS.length; i += 1) {
    const symbol = SPINS_GIFTS[i]
    if (!symbol) throw new Error('symbol table corrupted')
    giftSum += BigInt(symbol.weight) * BigInt(spinsMultiplierHundredths(i, doubleChance))
  }
  const freeStake = BigInt(bonusFreeStakeMinor(bet, doubleChance))
  // EV = B·Σw·m_h/(100·W) + (w_b/W)·E2num/(7200)·fs
  // × (100·W·7200): num = 7200·B·Σw·m_h + 100·w_b·E2num·fs; den = 100·W·7200·B
  const num = 7200n * BigInt(bet) * giftSum + 100n * wBonus * BigInt(bonusEvNumerator()) * freeStake
  const den = 100n * W * 7200n * BigInt(bet)
  return { num, den }
}

describe('spinsMath (4.9: нормализация как в Плинко, бонус-машина M2)', () => {
  it('RTP конфига — 0.98; структура колеса: 9 подарков + бонус', () => {
    expect(GAME_RTP).toBe(0.98)
    expect(SPINS_GIFTS).toHaveLength(9)
    expect(SPINS_SYMBOLS).toBe(10)
    expect(SPINS_CELLS).toBe(25)
    expect(SPINS_BONUS_WEIGHT).toBe(8)
    expect(weightsTotal(false)).toBe(80)
    expect(weightsTotal(true)).toBe(88)
  })

  it('множители основного колеса: floor(784/w) обычный, floor(862.4/w) двойной', () => {
    // обычный: m_i_h = floor(98·80/(w·10)) = floor(784/w)
    expect(spinsMultiplierHundredths(0, false)).toBe(784) // plush-pepe x7.84
    expect(spinsMultiplierHundredths(1, false)).toBe(392) // crystal-ball x3.92
    expect(spinsMultiplierHundredths(2, false)).toBe(261) // astral x2.61
    expect(spinsMultiplierHundredths(4, false)).toBe(112) // heart-locket x1.12
    expect(spinsMultiplierHundredths(8, false)).toBe(43) // chill-flame x0.43
    // двойной шанс: W = 88 → m_i_h = floor(8624/(w·10))
    expect(spinsMultiplierHundredths(0, true)).toBe(862)
    expect(spinsMultiplierHundredths(3, true)).toBe(172)
    expect(spinsMultiplierHundredths(8, true)).toBe(47)
  })

  it('машина M2 бонусного спина: floor(784/w), EV ≤ 0.98', () => {
    expect(bonusMultiplierHundredths(0)).toBe(784)
    expect(bonusMultiplierHundredths(5)).toBe(87) // magic-potion
    expect(bonusEvNumerator()).toBe(7032)
    const ev = bonusEvNumerator() / (72 * 100)
    expect(ev).toBeLessThanOrEqual(0.98)
    expect(ev).toBeGreaterThan(0.97)
  })

  it('EV полного колеса ≤ RTP точно (BigInt) и в окне [0.97, 0.98] — оба режима', () => {
    for (const doubleChance of [false, true]) {
      const { num, den } = exactEvRtp(1000, doubleChance)
      // num/den ≤ 0.98 ⇔ num·100 ≤ den·98
      expect(num * 100n).toBeLessThanOrEqual(den * 98n)
      const ev = Number(num) / Number(den)
      expect(ev).toBeGreaterThan(0.97)
      expect(ev).toBeLessThanOrEqual(0.98)
    }
    // контрольные значения: 0.976667 обычный, 0.974261 двойной
    expect(Number(exactEvRtp(1000, false).num) / Number(exactEvRtp(1000, false).den)).toBeCloseTo(
      7032 / 7200,
      6,
    )
  })

  it('свободная ставка бонусного спина: обычный = bet, двойной = floor(0.55·bet)', () => {
    expect(bonusFreeStakeMinor(1000, false)).toBe(1000)
    expect(bonusFreeStakeMinor(1000, true)).toBe(550)
    expect(bonusFreeStakeMinor(1001, true)).toBe(550)
    expect(bonusFreeStakeMinor(100, true)).toBe(55)
    expect(bonusFreeStakeMinor(100, false)).toBe(100)
  })

  it('цена покупки бонуса: ceil(7032·bet/7056) — вверх, RTP покупки ≤ 0.98', () => {
    expect(bonusBuyPriceMinor(1000)).toBe(997) // ceil(996.598)
    expect(bonusBuyPriceMinor(100)).toBe(100) // ceil(99.6598)
    expect(bonusBuyPriceMinor(0)).toBe(0)
    // RTP покупки = E2·bet/цена ≤ 0.98 для диапазона ставок
    const e2 = bonusEvNumerator() / 7200
    for (const bet of [100, 333, 500, 1000, 5000]) {
      const price = bonusBuyPriceMinor(bet)
      expect((e2 * bet) / price).toBeLessThanOrEqual(0.98 + 1e-12)
      expect((e2 * bet) / price).toBeGreaterThan(0.965)
    }
  })

  it('взвешенный выбор: границы кумулятивы, бонус на хвосте', () => {
    // обычный: кумулятива подарков [1,3,6,11,18,27,39,54,72], бонус 72..79
    expect(pickSpinsIndex(false, () => 0)).toBe(0)
    expect(pickSpinsIndex(false, () => 0.9)).toBe(9) // r = 72 → бонус
    expect(pickSpinsIndex(false, () => 0.89)).toBe(8) // r = 71 → chill-flame
    expect(pickSpinsIndex(false, () => 0.999999)).toBe(9) // r = 79
    // двойной: бонус 72..87
    expect(pickSpinsIndex(true, () => 0.9)).toBe(9) // r = 79 → бонус
    expect(pickSpinsIndex(true, () => 0.999999)).toBe(9) // r = 87
    // M2: только подарки
    expect(pickGiftIndex(() => 0.99)).toBe(8) // r = 71 → chill-flame
    expect(pickGiftIndex(() => 0)).toBe(0)
  })
})
