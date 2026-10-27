import { create } from 'zustand'
import type { Minor } from '../lib/money'
import { useProfileStore } from './profile'

export type PvpMode = 'jackpot' | 'tvt'

export interface PvpMatchEntry {
  at: number
  mode: PvpMode
  stakeMinor: Minor
  outcome: 'won' | 'lost'
  /** Чистое изменение баланса в минорных единицах (может быть отрицательным). */
  deltaMinor: Minor
  /** Детали матча: «билет 500 из 10000 · доля 10.00%», «Лёд · ×1.96». */
  detail?: string
}

const MAX_ENTRIES = 20

interface PvpMatchesState {
  entries: PvpMatchEntry[]
  /** Новые записи добавляются в начало; хранится не более MAX_ENTRIES. */
  push: (entry: Omit<PvpMatchEntry, 'at'>) => void
}

/**
 * История PVP-матчей (5.5). Пишут только demo-сервисы PVP — исключительно
 * реальные матчи пользователя, никакой синтетики (фиктивные матчи/игроки
 * запрещены спецификацией). Серверная история матчей и общая лента — TIER 7 (7.6).
 */
export const usePvpMatchesStore = create<PvpMatchesState>((set) => ({
  entries: [],
  push: (entry) => {
    // Кумулятивная статистика реальной игры (6.1/6.2) — одна запись на матч.
    useProfileStore.getState().record({
      stakeMinor: entry.stakeMinor,
      deltaMinor: entry.deltaMinor,
      isPvp: true,
    })
    set((state) => ({
      entries: [{ ...entry, at: Date.now() }, ...state.entries].slice(0, MAX_ENTRIES),
    }))
  },
}))
