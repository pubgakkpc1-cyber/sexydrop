import { create } from 'zustand'
import type { Minor } from '../lib/money'
import type { TvtSide } from '../lib/pvpMath'

export interface JackpotRoundState {
  /** Первый вклад — база добивки казино (h = 9·базы, фиксируется при старте). */
  baseStakeMinor: Minor
  /** Все вклады игрока раунда. */
  stakedMinor: Minor
  houseMinor: Minor
  poolMinor: Minor
  /** Шанс победы, билетов из 10000. */
  chanceTickets: number
  /** Доля игрока в банке, из 10000. */
  shareParts: number
  finished: boolean
  result: { roll: number; won: boolean; payoutMinor: Minor } | null
}

export interface TvtRoundState {
  betMinor: Minor
  side: TvtSide
  finished: boolean
  result: { flip: TvtSide; won: boolean; payoutMinor: Minor } | null
}

interface PvpRoundsState {
  jackpot: JackpotRoundState | null
  tvt: TvtRoundState | null
  setJackpot: (round: JackpotRoundState | null) => void
  setTvt: (round: TvtRoundState | null) => void
}

/**
 * Реактивное состояние PVP-раундов (5.4 — синхронизация игровых раундов).
 * Пишут его demo-сервисы (роль «сервера»), читают экраны и хаб: возврат
 * на экран восстанавливает открытый раунд/последний результат, хаб показывает
 * активный раунд баннером, TVT-операции блокируются, пока открыт раунд
 * Джекпота (round_in_progress). Серверная синхронизация раундов (реальные
 * оппоненты, real-time) — TIER 7 (7.6/7.8); в Demo Mode раунды локальные.
 */
export const usePvpRoundsStore = create<PvpRoundsState>((set) => ({
  jackpot: null,
  tvt: null,
  setJackpot: (jackpot) => set({ jackpot }),
  setTvt: (tvt) => set({ tvt }),
}))
