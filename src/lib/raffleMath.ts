import { giftById } from '../data/catalog'
import type { Minor } from './money'

/* --- Розыгрыш (6.4): билет-лотерея за билеты лояльности ---
 *
 * Один тираж = RAFFLE_TICKET_COST билетов; приз — подарок каталога
 * (зачисляется в инвентарь) или пусто. Веса — целые из 10000; EV тиража
 * рассчитан решателем: Σ w_i·price_i = 25,000,000 minor / 10000 = 2500 minor
 * (2.5 GRAM) — ровно 100 билетов × TICKET_VALUE_MINOR (0.025 GRAM) —
 * единая ценность билета во всей программе лояльности, раскрыто на экране.
 * Веса генерируются решателем под EV, а не «руками для красоты»;
 * тест проверяет тождество через цены каталога.
 */

export const RAFFLE_WEIGHT_TOTAL = 10_000

/** Стоимость одного тиража, билетов. */
export const RAFFLE_TICKET_COST = 100

export interface RafflePrize {
  /** null — пустой исход (без приза). */
  giftId: string | null
  weight: number
}

/** Приз-таблица: Σw = 10000; EV = 2500 minor (проверено тестом по каталогу). */
export const RAFFLE_PRIZES: readonly RafflePrize[] = [
  { giftId: 'golden-pepe', weight: 20 }, // 0.2%   · 200000
  { giftId: 'golden-trophy', weight: 250 }, // 2.5% · 60000
  { giftId: 'astral-shard', weight: 500 }, // 5%    · 5000
  { giftId: 'heart-locket', weight: 2900 }, // 29%  · 1000
  { giftId: 'scared-cat', weight: 4000 }, // 40%    · 150
  { giftId: null, weight: 2330 }, // 23.3% · пусто
]

/** Цена приза в минорных единицах (0 для пустого исхода). */
export function rafflePrizeMinor(giftId: string | null): Minor {
  if (giftId === null) return 0
  const gift = giftById.get(giftId)
  if (!gift) throw new Error(`Raffle prize references unknown gift: ${giftId}`)
  return gift.priceMinor
}

/** EV тиража: floor(Σ w·price / 10000) — целочисленно. */
export function raffleEvMinor(): Minor {
  let total = 0
  for (const prize of RAFFLE_PRIZES) {
    total += prize.weight * rafflePrizeMinor(prize.giftId)
  }
  return Math.floor(total / RAFFLE_WEIGHT_TOTAL)
}

/** Взвешенный выбор приза: ticket = floor(u·10000), префиксные суммы весов. */
export function rafflePickFromU(u: number, prizes: readonly RafflePrize[] = RAFFLE_PRIZES): RafflePrize {
  const ticket = Math.min(
    RAFFLE_WEIGHT_TOTAL - 1,
    Math.max(0, Math.floor(u * RAFFLE_WEIGHT_TOTAL)),
  )
  let cumulative = 0
  for (const prize of prizes) {
    cumulative += prize.weight
    if (ticket < cumulative) return prize
  }
  // Последний приз покрывает хвост (Σw = 10000 гарантируется тестом).
  const last = prizes[prizes.length - 1]
  if (!last) throw new Error('Raffle prize table is empty')
  return last
}
