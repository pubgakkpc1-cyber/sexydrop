import type { Minor } from '../lib/money'
import { mulByMultiplier, formatMinor } from '../lib/money'
import {
  bucketMultiplier,
  isPlinkoRows,
  formatMultiplier,
  type PlinkoRows,
} from '../lib/plinkoMath'
import { createRequestMemo } from '../lib/requestMemo'
import { useWalletStore } from '../store/wallet'
import { useGamesHistoryStore } from '../store/gamesHistory'

/* --- Движок Плинко (Demo Mode ONLY) ---
 *
 * Путь шара — n независимых монеток (влево/вправо), итоговый карман
 * k = число монеток вправо; P(k) = C(n,k)/2^n. Множители карманов — только
 * формулой (lib/plinkoMath): m_k = floor2(RTP/(P(k)·(n+1))).
 * Выплата floor(bet × m_k) — округление вниз, в пользу казны.
 * В production бросок исполняется сервером с CSPRNG (TIER 7, 7.6).
 */

export type PlinkoDropResult =
  | {
      status: 'ok'
      /** Путь шара: n бит (0 — влево, 1 — вправо). */
      path: readonly (0 | 1)[]
      /** Итоговый карман k = Σ пути (0…n). */
      bucket: number
      multiplier: number
      winMinor: Minor
      betMinor: Minor
    }
  | {
      status: 'rejected'
      reason: 'duplicate' | 'invalid_amount' | 'invalid_rows' | 'insufficient_funds'
    }

/** Идемпотентность операций: тот же client_request_id → тот же результат. */
const processedRequests = createRequestMemo<PlinkoDropResult>()

function processOnce(clientRequestId: string, execute: () => PlinkoDropResult): PlinkoDropResult {
  const cached = processedRequests.get(clientRequestId)
  if (cached) return cached
  const result = execute()
  processedRequests.set(clientRequestId, result)
  return result
}

let rng: () => number = Math.random

/** Подмена ГСЧ в тестах (паттерн caseMath/demoCrashService). Не для продукта. */
export function _setPlinkoRngForTests(next: () => number): void {
  rng = next
}

/** Один бросок шара. Иденпотентно по client_request_id. */
export function dropPlinko(
  betMinor: Minor,
  rows: PlinkoRows,
  clientRequestId: string,
): PlinkoDropResult {
  return processOnce(clientRequestId, () => {
    if (!isPlinkoRows(rows)) {
      return { status: 'rejected', reason: 'invalid_rows' } as const
    }
    if (!Number.isSafeInteger(betMinor) || betMinor <= 0) {
      return { status: 'rejected', reason: 'invalid_amount' } as const
    }
    const wallet = useWalletStore.getState()
    if (wallet.getBalance() < betMinor) {
      return { status: 'rejected', reason: 'insufficient_funds' } as const
    }

    wallet.debit(betMinor)

    const path: (0 | 1)[] = []
    for (let step = 0; step < rows; step += 1) {
      const u = rng()
      if (u < 0 || u >= 1) throw new Error(`rng must return [0, 1), got: ${u}`)
      path.push(u < 0.5 ? 0 : 1)
    }
    const bucket = path.reduce<number>((sum, bit) => sum + bit, 0)
    const multiplier = bucketMultiplier(rows, bucket)
    const winMinor = mulByMultiplier(betMinor, multiplier)
    if (winMinor > 0) {
      wallet.credit(winMinor)
    }

    useGamesHistoryStore.getState().push({
      game: 'Плинко',
      stakeLabel: `${formatMinor(betMinor)} TON`,
      stakeMinor: betMinor,
      outcome: winMinor > betMinor ? 'won' : 'lost',
      deltaMinor: winMinor - betMinor,
      detail: `карман ${bucket + 1}/${rows + 1} · ${formatMultiplier(multiplier)}`,
    })

    return {
      status: 'ok',
      path,
      bucket,
      multiplier,
      winMinor,
      betMinor,
    } as const
  })
}

/** Полный сброс между тестами. Не использовать в продукте. */
export function _resetPlinkoForTests(): void {
  processedRequests.clear()
  rng = Math.random
}
