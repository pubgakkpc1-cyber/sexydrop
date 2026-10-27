import { create } from 'zustand'
import type { Minor } from '../lib/money'
import { useProfileStore } from './profile'

/** Игры, попадающие в общую историю ставок (4.3). */
export type GameName = 'Ракетка' | 'Апгрейд' | 'Крафт' | 'Плинко' | 'Дайс' | 'Мины' | 'Спины'

export interface GameHistoryEntry {
  at: number
  game: GameName
  /** Что было поставлено: «0.1 GRAM» или название подарка. */
  stakeLabel: string
  /**
   * Ставка в минорных единицах GRAM — для кумулятивной статистики (6.1/6.2).
   * Ставки подарками (Апгрейд/Крафт) поле не заполняют: оборот GRAM их не
   * включает (честно помечено на экране Рейтинга).
   */
  stakeMinor?: Minor
  outcome: 'won' | 'lost'
  /** Чистое изменение баланса в минорных единицах (может быть отрицательным). */
  deltaMinor: Minor
  /** Детали раунда: «x2.18», «краш», «выпал: …». */
  detail?: string
}

const MAX_ENTRIES = 20

interface GamesHistoryState {
  entries: GameHistoryEntry[]
  /** Новые записи добавляются в начало; хранится не более MAX_ENTRIES. */
  push: (entry: Omit<GameHistoryEntry, 'at'>) => void
}

/**
 * Общая история ставок по мини-играм (4.3). Demo Mode: записи создают
 * локальные demo-сервисы — только реальные результаты пользователя,
 * никакой синтетики. Серверная история раундов — TIER 7 (7.6).
 */
export const useGamesHistoryStore = create<GamesHistoryState>((set) => ({
  entries: [],
  push: (entry) => {
    // Кумулятивная статистика реальной игры (6.1/6.2) — одна запись на раунд.
    useProfileStore.getState().record({
      stakeMinor: entry.stakeMinor,
      deltaMinor: entry.deltaMinor,
    })
    set((state) => ({
      entries: [{ ...entry, at: Date.now() }, ...state.entries].slice(0, MAX_ENTRIES),
    }))
  },
}))
