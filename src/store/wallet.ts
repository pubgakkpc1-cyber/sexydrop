import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeJsonStorage } from '../lib/persistStorage'
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

/** Бесплатных денег нет: новый игрок начинает с нуля. */
const DEFAULT_DEMO_START: Minor = 0

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
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
}),
    {
      name: 'sexydrop.wallet',
      // v2: обнуление всех накопленных балансов (устранены дыры с бесплатным TON)
      version: 2,
      migrate: () => ({ mode: 'demo' as WalletMode, balances: { demo: 0, real: 0 } }),
      storage: safeJsonStorage<{ mode: WalletState['mode']; balances: WalletState['balances'] }>(),
      partialize: (s) => ({ mode: s.mode, balances: s.balances }),
    },
  ),
)
