import type { Minor } from '../lib/money'
import { formatMinor } from '../lib/money'
import {
  jackpotChanceTickets,
  jackpotHouseStake,
  jackpotPoolMinor,
  jackpotRollFromU,
  jackpotShareParts,
  isJackpotWin,
} from '../lib/pvpMath'
import { useWalletStore } from '../store/wallet'
import { usePvpRoundsStore, type JackpotRoundState } from '../store/pvpRounds'
import { usePvpMatchesStore } from '../store/pvpMatches'
import { createRequestMemo } from '../lib/requestMemo'

/* --- Solo Jackpot (Demo Mode ONLY) ---
 *
 * Раунд живёт в store/pvpRounds — роль «сервера»: старт открывает банк
 * (вклад игрока + добивка казино h = 9·вклада), до тиража можно докидывать,
 * тираж решает исход: билет roll из 10000, выигрыш при roll < chance
 * (chance = floor(9800·s/(s+h))). Выплата = весь банк; каждое внесённое
 * имеет EV = −2% (floor — в пользу казны). В production раунды в БД
 * с CSPRNG и Provably Fair — TIER 7 (7.6); реальные соперники — 7.8.
 */

export type JackpotStartResult =
  | { status: 'ok'; stakedMinor: Minor; poolMinor: Minor; chanceTickets: number }
  | {
      status: 'rejected'
      reason:
        | 'duplicate'
        | 'invalid_amount'
        | 'insufficient_funds'
        | 'round_in_progress'
    }

export type JackpotAddResult =
  | {
      status: 'ok'
      stakedMinor: Minor
      poolMinor: Minor
      chanceTickets: number
      shareParts: number
    }
  | {
      status: 'rejected'
      reason:
        | 'duplicate'
        | 'no_round'
        | 'round_finished'
        | 'invalid_amount'
        | 'insufficient_funds'
    }

export type JackpotDrawResult =
  | {
      status: 'ok'
      roll: number
      won: boolean
      chanceTickets: number
      stakedMinor: Minor
      poolMinor: Minor
      payoutMinor: Minor
    }
  | { status: 'rejected'; reason: 'duplicate' | 'no_round' | 'round_finished' }

const startMemo = createRequestMemo<JackpotStartResult>()
const addMemo = createRequestMemo<JackpotAddResult>()
const drawMemo = createRequestMemo<JackpotDrawResult>()

let rng: () => number = Math.random

/** Подмена ГСЧ в тестах. Не для продукта. */
export function _setJackpotRngForTests(next: () => number): void {
  rng = next
}

/** Полный сброс между тестами. Не использовать в продукте. */
export function _resetJackpotForTests(): void {
  startMemo.clear()
  addMemo.clear()
  drawMemo.clear()
  rng = Math.random
  usePvpRoundsStore.getState().setJackpot(null)
}

/** Пересчёт производных полей раунда после изменения вкладов. */
function withStaked(round: JackpotRoundState, stakedMinor: Minor): JackpotRoundState {
  const poolMinor = jackpotPoolMinor(stakedMinor, round.houseMinor)
  return {
    ...round,
    stakedMinor,
    poolMinor,
    chanceTickets: jackpotChanceTickets(stakedMinor, round.houseMinor),
    shareParts: jackpotShareParts(stakedMinor, round.houseMinor),
  }
}

/** Старт раунда: дебет первого вклада, казино добивает h = 9·вклада. */
export function startJackpotRound(
  stakeMinor: Minor,
  clientRequestId: string,
): JackpotStartResult {
  const cached = startMemo.get(clientRequestId)
  if (cached) return cached

  const execute = (): JackpotStartResult => {
    const pvp = usePvpRoundsStore.getState()
    if (pvp.jackpot !== null && !pvp.jackpot.finished) {
      return { status: 'rejected', reason: 'round_in_progress' } as const
    }
    if (!Number.isSafeInteger(stakeMinor) || stakeMinor <= 0) {
      return { status: 'rejected', reason: 'invalid_amount' } as const
    }
    const wallet = useWalletStore.getState()
    if (wallet.getBalance() < stakeMinor) {
      return { status: 'rejected', reason: 'insufficient_funds' } as const
    }

    wallet.debit(stakeMinor)
    const houseMinor = jackpotHouseStake(stakeMinor)
    const round = withStaked(
      {
        baseStakeMinor: stakeMinor,
        stakedMinor: stakeMinor,
        houseMinor,
        poolMinor: 0,
        chanceTickets: 0,
        shareParts: 0,
        finished: false,
        result: null,
      },
      stakeMinor,
    )
    pvp.setJackpot(round)

    return {
      status: 'ok',
      stakedMinor: round.stakedMinor,
      poolMinor: round.poolMinor,
      chanceTickets: round.chanceTickets,
    }
  }

  const result = execute()
  startMemo.set(clientRequestId, result)
  return result
}

/** Докидывание в открытый банк: доля и шанс пересчитываются (спека 5.2). */
export function addJackpotStake(
  addMinor: Minor,
  clientRequestId: string,
): JackpotAddResult {
  const cached = addMemo.get(clientRequestId)
  if (cached) return cached

  const execute = (): JackpotAddResult => {
    const pvp = usePvpRoundsStore.getState()
    const round = pvp.jackpot
    if (round === null) {
      return { status: 'rejected', reason: 'no_round' } as const
    }
    if (round.finished) {
      return { status: 'rejected', reason: 'round_finished' } as const
    }
    if (!Number.isSafeInteger(addMinor) || addMinor <= 0) {
      return { status: 'rejected', reason: 'invalid_amount' } as const
    }
    const wallet = useWalletStore.getState()
    if (wallet.getBalance() < addMinor) {
      return { status: 'rejected', reason: 'insufficient_funds' } as const
    }

    wallet.debit(addMinor)
    const updated = withStaked(round, round.stakedMinor + addMinor)
    pvp.setJackpot(updated)

    return {
      status: 'ok',
      stakedMinor: updated.stakedMinor,
      poolMinor: updated.poolMinor,
      chanceTickets: updated.chanceTickets,
      shareParts: updated.shareParts,
    }
  }

  const result = execute()
  addMemo.set(clientRequestId, result)
  return result
}

/** Тираж: билет из 10000; выигрыш — весь банк. Завершает раунд. */
export function drawJackpot(clientRequestId: string): JackpotDrawResult {
  const cached = drawMemo.get(clientRequestId)
  if (cached) return cached

  const execute = (): JackpotDrawResult => {
    const pvp = usePvpRoundsStore.getState()
    const round = pvp.jackpot
    if (round === null) {
      return { status: 'rejected', reason: 'no_round' } as const
    }
    if (round.finished) {
      return { status: 'rejected', reason: 'round_finished' } as const
    }

    const roll = jackpotRollFromU(rng())
    const won = isJackpotWin(roll, round.chanceTickets)
    const payoutMinor = won ? round.poolMinor : 0
    if (payoutMinor > 0) {
      useWalletStore.getState().credit(payoutMinor)
    }

    pvp.setJackpot({
      ...round,
      finished: true,
      result: { roll, won, payoutMinor },
    })

    usePvpMatchesStore.getState().push({
      mode: 'jackpot',
      stakeMinor: round.stakedMinor,
      outcome: won ? 'won' : 'lost',
      deltaMinor: won ? round.poolMinor - round.stakedMinor : -round.stakedMinor,
      detail: `билет ${roll} из 10000 · доля ${(round.shareParts / 100).toFixed(2)}% · банк ${formatMinor(round.poolMinor)} TON`,
    })

    return {
      status: 'ok',
      roll,
      won,
      chanceTickets: round.chanceTickets,
      stakedMinor: round.stakedMinor,
      poolMinor: round.poolMinor,
      payoutMinor,
    }
  }

  const result = execute()
  drawMemo.set(clientRequestId, result)
  return result
}
