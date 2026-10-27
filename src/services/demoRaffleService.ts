import type { Minor } from '../lib/money'
import {
  RAFFLE_TICKET_COST,
  raffleEvMinor,
  rafflePickFromU,
  rafflePrizeMinor,
} from '../lib/raffleMath'
import { useInventoryStore } from '../store/inventory'
import { useTicketsStore } from '../store/tickets'
import { createRequestMemo } from '../lib/requestMemo'

/* --- Розыгрыш (Demo Mode ONLY) ---
 *
 * Тираж за билеты лояльности: списание билетов → взвешенный выбор приза
 * (lib/raffleMath, EV = 2500 minor = 100 билетов × 25 minor) → зачисление
 * подарка в инвентарь (source 'raffle'). ГРAM не списывается и не начисляется:
 * экономика тиража — только в билетах. В production тираж делает сервер
 * с CSPRNG по билетам из журнала — TIER 7 (6.4/7.6).
 */

export type RaffleDrawResult =
  | {
      status: 'ok'
      prizeGiftId: string | null
      prizeMinor: Minor
      ticketsSpent: number
    }
  | { status: 'rejected'; reason: 'duplicate' | 'not_enough_tickets' }

export interface RaffleDrawRecord {
  at: number
  prizeGiftId: string | null
  prizeMinor: Minor
}

const drawMemo = createRequestMemo<RaffleDrawResult>()

let rng: () => number = Math.random

const recentDraws: RaffleDrawRecord[] = []

/** Последние тиражи (для отображения; максимум 10). */
export function raffleRecentDraws(): readonly RaffleDrawRecord[] {
  return recentDraws
}

/** Подмена ГСЧ в тестах. Не для продукта. */
export function _setRaffleRngForTests(next: () => number): void {
  rng = next
}

/** Полный сброс между тестами. Не использовать в продукте. */
export function _resetRaffleForTests(): void {
  drawMemo.clear()
  rng = Math.random
  recentDraws.length = 0
}

/** Один тираж розыгрыша. Идемпотентно по client_request_id. */
export function drawRaffle(clientRequestId: string): RaffleDrawResult {
  const cached = drawMemo.get(clientRequestId)
  if (cached) return cached

  const execute = (): RaffleDrawResult => {
    const spent = useTicketsStore.getState().spend(RAFFLE_TICKET_COST)
    if (!spent) {
      return { status: 'rejected', reason: 'not_enough_tickets' } as const
    }

    const prize = rafflePickFromU(rng())
    const prizeMinor = rafflePrizeMinor(prize.giftId)
    if (prize.giftId !== null) {
      useInventoryStore.getState().addGifts([prize.giftId], 'raffle')
    }

    recentDraws.unshift({ at: Date.now(), prizeGiftId: prize.giftId, prizeMinor })
    if (recentDraws.length > 10) recentDraws.length = 10

    return {
      status: 'ok',
      prizeGiftId: prize.giftId,
      prizeMinor,
      ticketsSpent: RAFFLE_TICKET_COST,
    }
  }

  const result = execute()
  drawMemo.set(clientRequestId, result)
  return result
}

/** EV тиража для отображения (2.5 GRAM). */
export function rafflePublishedEvMinor(): Minor {
  return raffleEvMinor()
}
