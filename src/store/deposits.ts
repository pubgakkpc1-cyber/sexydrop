import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { safeJsonStorage } from '../lib/persistStorage'
import type { Minor } from '../lib/money'

export interface PendingDeposit {
  /** Секрет платежа: по нему сервер подтверждает оплату, никому не показывается. */
  secret: string
  kind: 'ton' | 'crypto'
  /** Номер счёта CryptoBot (только для kind = crypto). */
  invoiceId?: number
  /** Сколько ожидаем, minor (для подсказки пользователю). */
  amount: Minor
  createdAt: number
}

/** Ожидание оплаты живёт 1 час — столько же действует счёт CryptoBot. */
export const PENDING_TTL_MS = 60 * 60 * 1000

interface DepositsState {
  pending: PendingDeposit[]
  /** Секреты уже зачисленных платежей: повторно не засчитываем. */
  credited: string[]
  add: (p: PendingDeposit) => void
  remove: (secret: string) => void
  /** Помечает платёж зачисленным; false — уже был зачислен раньше. */
  markCredited: (secret: string) => boolean
}

export const useDepositsStore = create<DepositsState>()(
  persist(
    (set, get) => ({
      pending: [],
      credited: [],
      add: (p) => set((s) => ({ pending: [...s.pending.filter((x) => x.secret !== p.secret), p] })),
      remove: (secret) => set((s) => ({ pending: s.pending.filter((x) => x.secret !== secret) })),
      markCredited: (secret) => {
        if (get().credited.includes(secret)) {
          set((s) => ({ pending: s.pending.filter((x) => x.secret !== secret) }))
          return false
        }
        set((s) => ({
          credited: [...s.credited, secret].slice(-200),
          pending: s.pending.filter((x) => x.secret !== secret),
        }))
        return true
      },
    }),
    {
      name: 'sexydrop.deposits',
      version: 1,
      storage: safeJsonStorage<Pick<DepositsState, 'pending' | 'credited'>>(),
      partialize: (s) => ({ pending: s.pending, credited: s.credited }),
    },
  ),
)
