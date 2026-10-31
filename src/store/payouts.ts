import { create } from 'zustand'
import { minorToStars } from '../lib/stars'
import type { Minor } from '../lib/money'
import { useWalletStore } from './wallet'

/** Минимальная выплата: 1 TON (= 175 Stars). */
export const PAYOUT_MIN_MINOR: Minor = 1000

export interface PayoutRequest {
  id: string
  at: number
  minor: Minor
  stars: number
  status: 'pending'
}

interface PayoutsState {
  requests: PayoutRequest[]
  /** Заявка на выплату звёздами: сумма списывается с баланса, выплату проводит сервер (TIER 7). */
  request: (minor: Minor) => 'ok' | 'too_small' | 'insufficient'
}

export const usePayoutsStore = create<PayoutsState>((set) => ({
  requests: [],
  request: (minor) => {
    if (minor < PAYOUT_MIN_MINOR) return 'too_small'
    const wallet = useWalletStore.getState()
    if (wallet.getBalance() < minor) return 'insufficient'
    wallet.debit(minor)
    set((s) => ({
      requests: [
        { id: `po-${Date.now()}-${s.requests.length}`, at: Date.now(), minor, stars: minorToStars(minor), status: 'pending' as const },
        ...s.requests,
      ],
    }))
    return 'ok'
  },
}))
