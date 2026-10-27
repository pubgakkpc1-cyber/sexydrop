import { create } from 'zustand'
import { addMinor, subMinor, type Minor } from '../lib/money'

export type WalletMode = 'demo' | 'real'

export interface WalletState {
  mode: WalletMode
  /** Балансы строго разделены по режимам — Demo не имеет доступа к real-балансу. */
  balances: Record<WalletMode, Minor>
  /** Стартовый демо-баланс для сброса. */
  readonly demoStartBalance: Minor

  setMode: (mode: WalletMode) => void
  getBalance: (mode?: WalletMode) => Minor
  credit: (amount: Minor, mode?: WalletMode) => void
  debit: (amount: Minor, mode?: WalletMode) => void
  resetDemo: () => void
}

const DEFAULT_DEMO_START: Minor = 100_000 // 100 GRAM

export const useWalletStore = create<WalletState>((set, get) => ({
  mode: 'demo',
  balances: { demo: DEFAULT_DEMO_START, real: 0 },
  demoStartBalance: DEFAULT_DEMO_START,

  setMode: (mode) => set({ mode }),

  getBalance: (mode) => {
    const { balances } = get()
    return balances[mode ?? get().mode]
  },

  credit: (amount, mode) => {
    const target = mode ?? get().mode
    set((state) => ({
      balances: { ...state.balances, [target]: addMinor(state.balances[target], amount) },
    }))
  },

  debit: (amount, mode) => {
    const target = mode ?? get().mode
    set((state) => ({
      balances: { ...state.balances, [target]: subMinor(state.balances[target], amount) },
    }))
  },

  resetDemo: () =>
    set((state) => ({
      balances: { ...state.balances, demo: state.demoStartBalance },
    })),
}))
