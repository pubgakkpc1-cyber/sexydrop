import type { Minor } from '../lib/money'
import { mulByMultiplier, formatMinor } from '../lib/money'
import {
  SPINS_CELLS,
  SPINS_GIFTS,
  bonusBuyPriceMinor,
  bonusFreeStakeMinor,
  bonusMultiplierHundredths,
  pickGiftIndex,
  pickSpinsIndex,
  spinsMultiplierHundredths,
} from '../lib/spinsMath'
import { useWalletStore } from '../store/wallet'
import { useGamesHistoryStore } from '../store/gamesHistory'
import { createRequestMemo } from '../lib/requestMemo'

/* --- Движок Спинов (Demo Mode ONLY) ---
 *
 * Один запрос = один полный цикл спина: взвешенный выбор символа основного
 * колеса (10 символов, lib/spinsMath); бонус-символ сам не платит — в том же
 * запросе разыгрывается бесплатный спин машины M2 (только подарки) со ставкой
 * bonusFreeStakeMinor. Исход и выплата решаются здесь, как на сервере; все
 * множители — формулы (округление только вниз). TIER 7 (7.6) — CSPRNG.
 */

export type SpinsSpinResult =
  | {
      status: 'ok'
      kind: 'gift'
      symbolIndex: number
      winnerIndex: number
      multiplierHundredths: number
      payoutMinor: Minor
      betMinor: Minor
    }
  | {
      status: 'ok'
      kind: 'bonus'
      winnerIndex: number
      freeStakeMinor: Minor
      bonusSymbolIndex: number
      bonusMultiplierHundredths: number
      bonusPayoutMinor: Minor
      betMinor: Minor
    }
  | {
      status: 'rejected'
      reason: 'duplicate' | 'invalid_amount' | 'insufficient_funds'
    }

/** Успешный исход спина (для экрана). */
export type SpinsSpinOk = Extract<SpinsSpinResult, { status: 'ok' }>

export type SpinsBuyResult =
  | {
      status: 'ok'
      kind: 'bonus-buy'
      priceMinor: Minor
      bonusSymbolIndex: number
      bonusMultiplierHundredths: number
      payoutMinor: Minor
    }
  | {
      status: 'rejected'
      reason: 'duplicate' | 'invalid_amount' | 'insufficient_funds'
    }

const spinMemo = createRequestMemo<SpinsSpinResult>()
const buyMemo = createRequestMemo<SpinsBuyResult>()

let rng: () => number = Math.random

/** Подмена ГСЧ в тестах. Не для продукта. */
export function _setSpinsRngForTests(next: () => number): void {
  rng = next
}

/** Полный сброс между тестами. Не использовать в продукте. */
export function _resetSpinsForTests(): void {
  spinMemo.clear()
  buyMemo.clear()
  rng = Math.random
}

/** Порядок вызовов rng: базовый символ → ячейка победителя → (бонус: символ M2). */
export function spinSpins(
  betMinor: Minor,
  doubleChance: boolean,
  clientRequestId: string,
): SpinsSpinResult {
  const cached = spinMemo.get(clientRequestId)
  if (cached) return cached

  const execute = (): SpinsSpinResult => {
    if (!Number.isSafeInteger(betMinor) || betMinor <= 0) {
      return { status: 'rejected', reason: 'invalid_amount' } as const
    }
    const wallet = useWalletStore.getState()
    if (wallet.getBalance() < betMinor) {
      return { status: 'rejected', reason: 'insufficient_funds' } as const
    }

    wallet.debit(betMinor)
    const symbolIndex = pickSpinsIndex(doubleChance, rng)
    const winnerIndex = Math.floor(rng() * SPINS_CELLS)

    if (symbolIndex < SPINS_GIFTS.length) {
      const multiplierHundredths = spinsMultiplierHundredths(symbolIndex, doubleChance)
      const payoutMinor = mulByMultiplier(betMinor, multiplierHundredths / 100)
      if (payoutMinor > 0) wallet.credit(payoutMinor)
      const symbol = SPINS_GIFTS[symbolIndex]
      if (!symbol) throw new Error('symbol table corrupted')
      useGamesHistoryStore.getState().push({
        game: 'Спины',
        stakeLabel: `${formatMinor(betMinor)} TON`,
        stakeMinor: betMinor,
        outcome: payoutMinor >= betMinor ? 'won' : 'lost',
        deltaMinor: payoutMinor - betMinor,
        detail: `${symbol.name} · x${(multiplierHundredths / 100).toFixed(2)}`,
      })
      return {
        status: 'ok',
        kind: 'gift',
        symbolIndex,
        winnerIndex,
        multiplierHundredths,
        payoutMinor,
        betMinor,
      }
    }

    // Бонус-символ: бесплатный спин машины M2 в том же запросе.
    const freeStakeMinor = bonusFreeStakeMinor(betMinor, doubleChance)
    const bonusSymbolIndex = pickGiftIndex(rng)
    const bonusMultiplierHundredthsValue = bonusMultiplierHundredths(bonusSymbolIndex)
    const bonusPayoutMinor = mulByMultiplier(freeStakeMinor, bonusMultiplierHundredthsValue / 100)
    if (bonusPayoutMinor > 0) wallet.credit(bonusPayoutMinor)
    const symbol = SPINS_GIFTS[bonusSymbolIndex]
    if (!symbol) throw new Error('symbol table corrupted')
    useGamesHistoryStore.getState().push({
      game: 'Спины',
      stakeLabel: `${formatMinor(betMinor)} TON`,
      stakeMinor: betMinor,
      outcome: bonusPayoutMinor >= betMinor ? 'won' : 'lost',
      deltaMinor: bonusPayoutMinor - betMinor,
      detail: `бонус · ${symbol.name} x${(bonusMultiplierHundredthsValue / 100).toFixed(2)}`,
    })
    return {
      status: 'ok',
      kind: 'bonus',
      winnerIndex,
      freeStakeMinor,
      bonusSymbolIndex,
      bonusMultiplierHundredths: bonusMultiplierHundredthsValue,
      bonusPayoutMinor,
      betMinor,
    }
  }

  const result = execute()
  spinMemo.set(clientRequestId, result)
  return result
}

/** Покупка бонуса: цена ceil(E2num·bet/7056), спин M2 со полной ставкой bet. */
export function buyBonus(betMinor: Minor, clientRequestId: string): SpinsBuyResult {
  const cached = buyMemo.get(clientRequestId)
  if (cached) return cached

  const execute = (): SpinsBuyResult => {
    const priceMinor = bonusBuyPriceMinor(betMinor)
    if (!Number.isSafeInteger(betMinor) || betMinor <= 0 || priceMinor === 0) {
      return { status: 'rejected', reason: 'invalid_amount' } as const
    }
    const wallet = useWalletStore.getState()
    if (wallet.getBalance() < priceMinor) {
      return { status: 'rejected', reason: 'insufficient_funds' } as const
    }

    wallet.debit(priceMinor)
    const bonusSymbolIndex = pickGiftIndex(rng)
    const bonusMultiplierHundredthsValue = bonusMultiplierHundredths(bonusSymbolIndex)
    const payoutMinor = mulByMultiplier(betMinor, bonusMultiplierHundredthsValue / 100)
    if (payoutMinor > 0) wallet.credit(payoutMinor)
    const symbol = SPINS_GIFTS[bonusSymbolIndex]
    if (!symbol) throw new Error('symbol table corrupted')
    useGamesHistoryStore.getState().push({
      game: 'Спины',
      stakeLabel: `${formatMinor(priceMinor)} TON`,
      stakeMinor: priceMinor,
      outcome: payoutMinor >= priceMinor ? 'won' : 'lost',
      deltaMinor: payoutMinor - priceMinor,
      detail: `бонус куплен · ${symbol.name} x${(bonusMultiplierHundredthsValue / 100).toFixed(2)}`,
    })
    return {
      status: 'ok',
      kind: 'bonus-buy',
      priceMinor,
      bonusSymbolIndex,
      bonusMultiplierHundredths: bonusMultiplierHundredthsValue,
      payoutMinor,
    }
  }

  const result = execute()
  buyMemo.set(clientRequestId, result)
  return result
}
