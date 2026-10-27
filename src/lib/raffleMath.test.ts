import { describe, expect, it } from 'vitest'
import {
  RAFFLE_PRIZES,
  RAFFLE_TICKET_COST,
  RAFFLE_WEIGHT_TOTAL,
  raffleEvMinor,
  rafflePickFromU,
  rafflePrizeMinor,
} from './raffleMath'
import { giftById } from '../data/catalog'
import { TICKET_VALUE_MINOR } from '../store/tickets'

describe('raffleMath (6.4: решатель приз-таблицы, EV = ценность билетов)', () => {
  it('Σ весов = 10000 (билет покрывает весь диапазон)', () => {
    const total = RAFFLE_PRIZES.reduce((sum, prize) => sum + prize.weight, 0)
    expect(total).toBe(RAFFLE_WEIGHT_TOTAL)
  })

  it('EV тиража ровно 2500 minor = 100 билетов × 25 minor (единая ценность билета)', () => {
    // тождество через цены каталога (один источник правды)
    const exact = RAFFLE_PRIZES.reduce(
      (sum, prize) => sum + prize.weight * rafflePrizeMinor(prize.giftId),
      0,
    )
    expect(exact).toBe(25_000_000)
    expect(raffleEvMinor()).toBe(2500)
    expect(raffleEvMinor()).toBe(RAFFLE_TICKET_COST * TICKET_VALUE_MINOR)
  })

  it('цены призов совпадают с каталогом (один источник правды)', () => {
    for (const prize of RAFFLE_PRIZES) {
      if (prize.giftId === null) {
        expect(rafflePrizeMinor(null)).toBe(0)
        continue
      }
      const gift = giftById.get(prize.giftId)
      expect(gift).toBeDefined()
      expect(rafflePrizeMinor(prize.giftId)).toBe(gift?.priceMinor ?? -1)
    }
  })

  it('взвешенный выбор: границы и шансы (p = w/10000)', () => {
    expect(rafflePickFromU(0).giftId).toBe('golden-pepe') // [0, 20)
    expect(rafflePickFromU(0.0019).giftId).toBe('golden-pepe')
    expect(rafflePickFromU(0.002).giftId).toBe('golden-trophy') // [20, 270)
    expect(rafflePickFromU(0.0269).giftId).toBe('golden-trophy')
    expect(rafflePickFromU(0.027).giftId).toBe('astral-shard') // [270, 770)
    expect(rafflePickFromU(0.0769).giftId).toBe('astral-shard')
    expect(rafflePickFromU(0.077).giftId).toBe('heart-locket') // [770, 3670)
    expect(rafflePickFromU(0.3669).giftId).toBe('heart-locket')
    expect(rafflePickFromU(0.367).giftId).toBe('scared-cat') // [3670, 7670)
    expect(rafflePickFromU(0.7669).giftId).toBe('scared-cat')
    expect(rafflePickFromU(0.767).giftId).toBeNull() // [7670, 10000)
    expect(rafflePickFromU(0.9999).giftId).toBeNull()
    expect(rafflePickFromU(1).giftId).toBeNull() // зажим
  })

  it('запрет «пустых» призов: у всех непустых призов цена > 0', () => {
    for (const prize of RAFFLE_PRIZES) {
      if (prize.giftId !== null) {
        expect(rafflePrizeMinor(prize.giftId)).toBeGreaterThan(0)
      }
    }
  })
})
