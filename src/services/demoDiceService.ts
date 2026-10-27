import type { Minor } from '../lib/money'
import { mulByMultiplier, formatMinor } from '../lib/money'
import {
  diceMultiplierScaled4,
  diceRollFromU,
  isDiceWin,
  isDiceDirection,
  isValidDiceTarget,
  type DiceDirection,
} from '../lib/diceMath'
import { useWalletStore } from '../store/wallet'
import { useGamesHistoryStore } from '../store/gamesHistory'
import { createRequestMemo } from '../lib/requestMemo'

/* --- Движок Дайса (Demo Mode ONLY) ---
 *
 * Ролл — 10 000 равновероятных значений из ГСЧ; множитель — только формула
 * (lib/diceMath): m4 = floor(98e6 / c), выплата floor(bet × m4 / 10^4).
 * Округления везде вниз — в пользу казны. В production ролл исполняет сервер
 * с CSPRNG (TIER 7, 7.6).
 */

export type DiceRollResult =
  | {
      status: 'ok'
      roll: number
      won: boolean
      multiplierScaled4: number
      winMinor: Minor
      betMinor: Minor
    }
  | {
      status: 'rejected'
      reason:
        | 'duplicate'
        | 'invalid_amount'
        | 'invalid_target'
        | 'invalid_direction'
        | 'insufficient_funds'
    }

const memo = createRequestMemo<DiceRollResult>()

let rng: () => number = Math.random

/** Подмена ГСЧ в тестах. Не для продукта. */
export function _setDiceRngForTests(next: () => number): void {
  rng = next
}

/** Один ролл. Идемпотентно по client_request_id. */
export function rollDice(
  betMinor: Minor,
  target: number,
  direction: DiceDirection,
  clientRequestId: string,
): DiceRollResult {
  const cached = memo.get(clientRequestId)
  if (cached) return cached

  const execute = (): DiceRollResult => {
    if (!isDiceDirection(direction)) {
      return { status: 'rejected', reason: 'invalid_direction' } as const
    }
    if (!Number.isSafeInteger(betMinor) || betMinor <= 0) {
      return { status: 'rejected', reason: 'invalid_amount' } as const
    }
    if (!isValidDiceTarget(target, direction)) {
      return { status: 'rejected', reason: 'invalid_target' } as const
    }
    const wallet = useWalletStore.getState()
    if (wallet.getBalance() < betMinor) {
      return { status: 'rejected', reason: 'insufficient_funds' } as const
    }

    wallet.debit(betMinor)

    const roll = diceRollFromU(rng())
    const won = isDiceWin(roll, target, direction)
    const m4 = diceMultiplierScaled4(target, direction)
    const winMinor = won ? mulByMultiplier(betMinor, m4 / 10_000) : 0
    if (winMinor > 0) wallet.credit(winMinor)

    useGamesHistoryStore.getState().push({
      game: 'Дайс',
      stakeLabel: `${formatMinor(betMinor)} TON`,
      stakeMinor: betMinor,
      outcome: won ? 'won' : 'lost',
      deltaMinor: winMinor - betMinor,
      detail: `ролл ${roll} · ${(m4 / 10_000).toFixed(2)}`,
    })

    return { status: 'ok', roll, won, multiplierScaled4: m4, winMinor, betMinor } as const
  }

  const result = execute()
  memo.set(clientRequestId, result)
  return result
}

/** Полный сброс между тестами. Не использовать в продукте. */
export function _resetDiceForTests(): void {
  memo.clear()
  rng = Math.random
}
