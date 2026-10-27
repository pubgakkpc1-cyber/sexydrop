import type { Minor } from '../lib/money'
import { mulByMultiplier, formatMinor } from '../lib/money'
import {
  isValidMinesCount,
  minesMultiplierHundredths,
  minesPickPositions,
  MINES_TILES,
} from '../lib/minesMath'
import { useWalletStore } from '../store/wallet'
import { useGamesHistoryStore } from '../store/gamesHistory'
import { createRequestMemo } from '../lib/requestMemo'

/* --- Движок Мин (Demo Mode ONLY) ---
 *
 * Раунд живёт в модуле — роль «сервера»: раскладка мин генерируется при старте
 * (частичный Fisher–Yates, lib/minesMath) и НЕ выдаётся клиенту до конца
 * раунда. Клиент шлёт только индекс клетки; валидность решает сервис.
 * Все множители — формула minesMultiplierHundredths (округление только вниз).
 * В production раунды в БД с CSPRNG и Provably Fair — TIER 7 (7.6).
 *
 * Один активный раунд (один игрок в Demo Mode); новый старт возможен только
 * после конца предыдущего (потеря/забрать/полный сбор).
 */

export type MinesStartResult =
  | { status: 'ok'; minesCount: number; betMinor: Minor }
  | {
      status: 'rejected'
      reason:
        | 'duplicate'
        | 'invalid_amount'
        | 'invalid_mines'
        | 'insufficient_funds'
        | 'round_in_progress'
    }

export type MinesPickResult =
  | {
      status: 'ok'
      event: 'safe' | 'lost' | 'cleared'
      pickedCount: number
      multiplierHundredths: number
      payoutMinor: Minor
      minePositions: number[] | null
    }
  | {
      status: 'rejected'
      reason:
        | 'duplicate'
        | 'no_round'
        | 'round_finished'
        | 'invalid_tile'
        | 'tile_picked'
    }

export type MinesCashoutResult =
  | {
      status: 'ok'
      event: 'cashed'
      pickedCount: number
      multiplierHundredths: number
      payoutMinor: Minor
      minePositions: number[]
    }
  | {
      status: 'rejected'
      reason: 'duplicate' | 'no_round' | 'round_finished' | 'nothing_picked'
    }

interface MinesRound {
  betMinor: Minor
  minesCount: number
  minePositions: number[]
  picked: number[]
  finished: boolean
}

const startMemo = createRequestMemo<MinesStartResult>()
const pickMemo = createRequestMemo<MinesPickResult>()
const cashoutMemo = createRequestMemo<MinesCashoutResult>()

let rng: () => number = Math.random
let round: MinesRound | null = null

/** Подмена ГСЧ в тестах. Не для продукта. */
export function _setMinesRngForTests(next: () => number): void {
  rng = next
}

/** Полный сброс между тестами. Не использовать в продукте. */
export function _resetMinesForTests(): void {
  startMemo.clear()
  pickMemo.clear()
  cashoutMemo.clear()
  rng = Math.random
  round = null
}

/** Открыто безопасных клеток. */
export function minesOpenedCount(): number {
  return round === null || round.finished ? 0 : round.picked.length
}

/** Старт раунда: дебет ставки, генерация раскладки (не раскрывается). */
export function startMines(
  betMinor: Minor,
  minesCount: number,
  clientRequestId: string,
): MinesStartResult {
  const cached = startMemo.get(clientRequestId)
  if (cached) return cached

  const execute = (): MinesStartResult => {
    if (round !== null && !round.finished) {
      return { status: 'rejected', reason: 'round_in_progress' } as const
    }
    if (!Number.isSafeInteger(betMinor) || betMinor <= 0) {
      return { status: 'rejected', reason: 'invalid_amount' } as const
    }
    if (!isValidMinesCount(minesCount)) {
      return { status: 'rejected', reason: 'invalid_mines' } as const
    }
    const wallet = useWalletStore.getState()
    if (wallet.getBalance() < betMinor) {
      return { status: 'rejected', reason: 'insufficient_funds' } as const
    }

    wallet.debit(betMinor)
    const minePositions = minesPickPositions(minesCount, rng)
    round = { betMinor, minesCount, minePositions, picked: [], finished: false }
    return { status: 'ok', minesCount, betMinor } as const
  }

  const result = execute()
  startMemo.set(clientRequestId, result)
  return result
}

/** Открытие клетки. Мина — конец раунда; последняя безопасная — автозабор. */
export function pickMines(tileIndex: number, clientRequestId: string): MinesPickResult {
  const cached = pickMemo.get(clientRequestId)
  if (cached) return cached

  const execute = (): MinesPickResult => {
    if (round === null) {
      return { status: 'rejected', reason: 'no_round' } as const
    }
    if (round.finished) {
      return { status: 'rejected', reason: 'round_finished' } as const
    }
    if (!Number.isSafeInteger(tileIndex) || tileIndex < 0 || tileIndex >= MINES_TILES) {
      return { status: 'rejected', reason: 'invalid_tile' } as const
    }
    if (round.picked.includes(tileIndex)) {
      return { status: 'rejected', reason: 'tile_picked' } as const
    }

    if (round.minePositions.includes(tileIndex)) {
      // Мина: раунд проигран, раскладка раскрывается, ставка сгорела.
      round.finished = true
      useGamesHistoryStore.getState().push({
        game: 'Мины',
        stakeLabel: `${formatMinor(round.betMinor)} TON`,
        stakeMinor: round.betMinor,
        outcome: 'lost',
        deltaMinor: -round.betMinor,
        detail: `${round.minesCount} мин · мина на ходу ${round.picked.length + 1}`,
      })
      const result: MinesPickResult = {
        status: 'ok',
        event: 'lost',
        pickedCount: round.picked.length,
        multiplierHundredths: 0,
        payoutMinor: 0,
        minePositions: [...round.minePositions],
      }
      pickMemo.set(clientRequestId, result)
      return result
    }

    round.picked.push(tileIndex)
    const opened = round.picked.length
    const multiplierHundredths = minesMultiplierHundredths(round.minesCount, opened)

    if (opened === MINES_TILES - round.minesCount) {
      // Полный сбор: все безопасные клетки открыты — автозабор.
      round.finished = true
      const payoutMinor = mulByMultiplier(round.betMinor, multiplierHundredths / 100)
      useWalletStore.getState().credit(payoutMinor)
      useGamesHistoryStore.getState().push({
        game: 'Мины',
        stakeLabel: `${formatMinor(round.betMinor)} TON`,
        stakeMinor: round.betMinor,
        outcome: 'won',
        deltaMinor: payoutMinor - round.betMinor,
        detail: `${round.minesCount} мин · полный сбор x${(multiplierHundredths / 100).toFixed(2)}`,
      })
      const result: MinesPickResult = {
        status: 'ok',
        event: 'cleared',
        pickedCount: opened,
        multiplierHundredths,
        payoutMinor,
        minePositions: [...round.minePositions],
      }
      pickMemo.set(clientRequestId, result)
      return result
    }

    const result: MinesPickResult = {
      status: 'ok',
      event: 'safe',
      pickedCount: opened,
      multiplierHundredths,
      payoutMinor: 0,
      minePositions: null,
    }
    pickMemo.set(clientRequestId, result)
    return result
  }

  const result = execute()
  pickMemo.set(clientRequestId, result)
  return result
}

/** «Забрать»: выплата floor(ставка × m_h/100), раскладка раскрывается. */
export function cashoutMines(clientRequestId: string): MinesCashoutResult {
  const cached = cashoutMemo.get(clientRequestId)
  if (cached) return cached

  const execute = (): MinesCashoutResult => {
    if (round === null) {
      return { status: 'rejected', reason: 'no_round' } as const
    }
    if (round.finished) {
      return { status: 'rejected', reason: 'round_finished' } as const
    }
    if (round.picked.length === 0) {
      return { status: 'rejected', reason: 'nothing_picked' } as const
    }

    const opened = round.picked.length
    const multiplierHundredths = minesMultiplierHundredths(round.minesCount, opened)
    const payoutMinor = mulByMultiplier(round.betMinor, multiplierHundredths / 100)
    round.finished = true
    useWalletStore.getState().credit(payoutMinor)
    useGamesHistoryStore.getState().push({
      game: 'Мины',
      stakeLabel: `${formatMinor(round.betMinor)} TON`,
      stakeMinor: round.betMinor,
      outcome: 'won',
      deltaMinor: payoutMinor - round.betMinor,
      detail: `${round.minesCount} мин · забрал ${opened} · x${(multiplierHundredths / 100).toFixed(2)}`,
    })

    const result: MinesCashoutResult = {
      status: 'ok',
      event: 'cashed',
      pickedCount: opened,
      multiplierHundredths,
      payoutMinor,
      minePositions: [...round.minePositions],
    }
    cashoutMemo.set(clientRequestId, result)
    return result
  }

  const result = execute()
  cashoutMemo.set(clientRequestId, result)
  return result
}
