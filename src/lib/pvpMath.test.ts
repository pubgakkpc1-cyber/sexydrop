import { describe, expect, it } from 'vitest'
import { mulByMultiplier } from './money'
import {
  JACKPOT_HOUSE_MULT,
  jackpotChanceTickets,
  jackpotEvMinor,
  jackpotHouseStake,
  jackpotPoolMinor,
  jackpotRollFromU,
  jackpotShareParts,
  isJackpotWin,
  isTvtSide,
  TVT_MULT_HUNDREDTHS,
  tvtFlipFromU,
  tvtPayoutMinor,
} from './pvpMath'

describe('pvpMath — Solo Jackpot (5.2: шанс = доля ставки в банке)', () => {
  it('одиночная ставка: казино добивает 9×, шанс 9.8%, банк 10×', () => {
    const b = 1000
    const house = jackpotHouseStake(b)
    expect(house).toBe(9_000)
    expect(jackpotPoolMinor(b, house)).toBe(10_000)
    // p = floor(9800·1000/10000) = 980 билетов из 10000 = 9.8%
    expect(jackpotChanceTickets(b, house)).toBe(980)
    // доля игрока в банке: floor(10000·1000/10000) = 1000 = 10.00%
    expect(jackpotShareParts(b, house)).toBe(1000)
  })

  it('докидывания растят долю и шанс: s=2000 при h=9000 → 17.81%', () => {
    // первый вклад 1000 + докинули 1000; h фиксирован с момента старта
    expect(jackpotChanceTickets(2000, 9000)).toBe(1781) // floor(9800·2000/11000)
    expect(jackpotShareParts(2000, 9000)).toBe(1818) // floor(10000·2000/11000) = 18.18%
    expect(jackpotPoolMinor(2000, 9000)).toBe(11_000)
  })

  it('инвариант EV: chance·банк ≤ 9800·s (полный перебор s, h ∈ [1..300])', () => {
    for (let s = 1; s <= 300; s += 1) {
      for (let h = 1; h <= 300; h += 1) {
        const tickets = jackpotChanceTickets(s, h)
        // floor не может поднять шанс выше RTP·доли:
        expect(tickets * (s + h)).toBeLessThanOrEqual(9800 * s)
        // EV (в минорных) не лучше −2% внесённого:
        expect(jackpotEvMinor(s, h)).toBeLessThanOrEqual(-Math.floor(s * 0.02))
      }
    }
  })

  it('билет тиража: floor(u·10⁴) с зажимом в [0, 9999]; выигрыш строго roll < chance', () => {
    expect(jackpotRollFromU(0)).toBe(0)
    expect(jackpotRollFromU(0.04999)).toBe(499)
    expect(jackpotRollFromU(0.99999)).toBe(9999)
    expect(jackpotRollFromU(1)).toBe(9999) // зажим (u вне [0,1) — защита)
    expect(isJackpotWin(979, 980)).toBe(true)
    expect(isJackpotWin(980, 980)).toBe(false) // граница — не выигрыш
    expect(isJackpotWin(0, 0)).toBe(false)
  })

  it('house stake — целочисленный 9× при любом вкладе', () => {
    expect(jackpotHouseStake(1)).toBe(JACKPOT_HOUSE_MULT)
    expect(jackpotHouseStake(123)).toBe(1107)
  })
})

describe('pvpMath — TVT Ice vs Fire (5.3: монета 50/50 ×1.96)', () => {
  it('монета строго 50/50: границы 0.4999/0.5', () => {
    expect(tvtFlipFromU(0)).toBe('ice')
    expect(tvtFlipFromU(0.4999)).toBe('ice')
    expect(tvtFlipFromU(0.5)).toBe('fire')
    expect(tvtFlipFromU(0.9999)).toBe('fire')
  })

  it('множитель 196 сотых и выплата floor(ставка × 1.96) — только вниз', () => {
    expect(TVT_MULT_HUNDREDTHS).toBe(196)
    expect(tvtPayoutMinor(1000)).toBe(1960)
    expect(tvtPayoutMinor(999)).toBe(1958) // 999·1.96 = 1958.04 → 1958
    expect(tvtPayoutMinor(100)).toBe(196)
    expect(tvtPayoutMinor(2500)).toBe(4900)
    // совпадает с mulByMultiplier:
    expect(tvtPayoutMinor(777)).toBe(mulByMultiplier(777, 1.96))
  })

  it('isTvtSide — только два валидных значения', () => {
    expect(isTvtSide('ice')).toBe(true)
    expect(isTvtSide('fire')).toBe(true)
    expect(isTvtSide('coin')).toBe(false)
    expect(isTvtSide(null)).toBe(false)
  })

  it('EV монеты = 0.5·payout − bet ≤ −0.02·bet (проверка на выборке ставок)', () => {
    for (const bet of [1, 100, 999, 1000, 2500, 10_000, 100_000]) {
      const payout = tvtPayoutMinor(bet)
      // floor может дать payout = 1.96·bet ровно или чуть меньше (только вниз):
      // payout ≤ 1.96·bet ⇔ payout·25 ≤ 49·bet — целочисленно, без float
      expect(payout * 25).toBeLessThanOrEqual(49 * bet)
      // EV = 0.5·payout − bet ≤ −0.02·bet ⇔ payout·50 ≤ 98·bet... точнее:
      // 0.5·payout ≤ 0.98·bet ⇔ payout·25 ≤ 49·bet (уже проверено выше)
    }
  })
})
