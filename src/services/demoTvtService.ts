import type { Minor } from '../lib/money'
import {
  isTvtSide,
  tvtFlipFromU,
  tvtPayoutMinor,
  TVT_MULT_HUNDREDTHS,
  type TvtSide,
} from '../lib/pvpMath'
import { useWalletStore } from '../store/wallet'
import { usePvpRoundsStore, type TvtRoundState } from '../store/pvpRounds'
import { usePvpMatchesStore } from '../store/pvpMatches'
import { createRequestMemo } from '../lib/requestMemo'

/* --- TVT: Ice vs Fire (Demo Mode ONLY) ---
 *
 * Монета 50/50: выпал Лёд или Огонь; игрок выбирает сторону до броска.
 * Соперник — «казино-контрагент»: вторую сторону всегда держит казино,
 * никаких фиктивных игроков. Выплата победителю floor(ставка × 1.96),
 * EV = 0.98·ставки. Пока открыт раунд Джекпота, бросок блокируется
 * (5.4 — синхронизация раундов). В production бросок делает сервер
 * с CSPRNG — TIER 7 (7.6); реальные противники — 7.8.
 */

export type TvtFlipResult =
  | {
      status: 'ok'
      flip: TvtSide
      won: boolean
      payoutMinor: Minor
      betMinor: Minor
      multiplierHundredths: number
    }
  | {
      status: 'rejected'
      reason:
        | 'duplicate'
        | 'invalid_amount'
        | 'invalid_side'
        | 'insufficient_funds'
        | 'round_in_progress'
    }

const flipMemo = createRequestMemo<TvtFlipResult>()

let rng: () => number = Math.random

/** Подмена ГСЧ в тестах. Не для продукта. */
export function _setTvtRngForTests(next: () => number): void {
  rng = next
}

/** Полный сброс между тестами. Не использовать в продукте. */
export function _resetTvtForTests(): void {
  flipMemo.clear()
  rng = Math.random
  usePvpRoundsStore.getState().setTvt(null)
}

/** Один бросок монеты. Идемпотентно по client_request_id. */
export function flipTvt(
  side: TvtSide,
  betMinor: Minor,
  clientRequestId: string,
): TvtFlipResult {
  const cached = flipMemo.get(clientRequestId)
  if (cached) return cached

  const execute = (): TvtFlipResult => {
    // 5.4: пока открыт раунд Джекпота, TVT недоступен (один активный раунд).
    const jackpot = usePvpRoundsStore.getState().jackpot
    if (jackpot !== null && !jackpot.finished) {
      return { status: 'rejected', reason: 'round_in_progress' } as const
    }
    if (!isTvtSide(side)) {
      return { status: 'rejected', reason: 'invalid_side' } as const
    }
    if (!Number.isSafeInteger(betMinor) || betMinor <= 0) {
      return { status: 'rejected', reason: 'invalid_amount' } as const
    }
    const wallet = useWalletStore.getState()
    if (wallet.getBalance() < betMinor) {
      return { status: 'rejected', reason: 'insufficient_funds' } as const
    }

    wallet.debit(betMinor)
    const flip = tvtFlipFromU(rng())
    const won = flip === side
    const payoutMinor = won ? tvtPayoutMinor(betMinor) : 0
    if (payoutMinor > 0) wallet.credit(payoutMinor)

    const round: TvtRoundState = {
      betMinor,
      side,
      finished: true,
      result: { flip, won, payoutMinor },
    }
    usePvpRoundsStore.getState().setTvt(round)

    usePvpMatchesStore.getState().push({
      mode: 'tvt',
      stakeMinor: betMinor,
      outcome: won ? 'won' : 'lost',
      deltaMinor: won ? payoutMinor - betMinor : -betMinor,
      detail: `${flip === 'ice' ? 'Лёд' : 'Огонь'} · ×${(TVT_MULT_HUNDREDTHS / 100).toFixed(2)}`,
    })

    return {
      status: 'ok',
      flip,
      won,
      payoutMinor,
      betMinor,
      multiplierHundredths: TVT_MULT_HUNDREDTHS,
    }
  }

  const result = execute()
  flipMemo.set(clientRequestId, result)
  return result
}
