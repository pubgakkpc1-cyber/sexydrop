import { create } from 'zustand'
import type { Minor } from '../lib/money'
import type { Gift } from '../data/catalog'

export type CrashPhase = 'betting' | 'flying' | 'crashed'

export interface CrashBet {
  kind: 'gram' | 'gift'
  /** Стоимость ставки в минорных единицах (сумма TON или каталог-цена подарка). */
  valueMinor: Minor
  /** Для ставки подарком: uid предмета в инвентаре и id подарка. */
  uid?: string
  giftId?: string
  status: 'active' | 'won' | 'lost'
  /** Множитель кешаута — заполняется при успешном «Забрать». */
  cashedMultiplier?: number
  /** Зачисленный выигрыш в минорных единицах (после кешаута). */
  wonMinor?: Minor
  /** Выигранный равноценный NFT подарок (если найден). */
  wonGift?: Gift
}

export interface CrashState {
  phase: CrashPhase
  roundId: number
  /** Остаток фазы в логических тиках движка (betting/crashed). */
  ticksLeft: number
  /** Текущий множитель полёта (отображаемый, округлён вниз до 2 знаков). */
  multiplier: number
  /** Точка краша раунда; раскрывается движком только в фазе crashed. */
  crashPoint: number | null
  /** История крашей — свежие в начале, максимум MAX_HISTORY. */
  history: number[]
  /** Ставка текущего раунда (одна ставка на раунд). */
  myBet: CrashBet | null
}

export const MAX_HISTORY = 12
export const CRASH_HISTORY_KEY = 'sexydrop_crash_history'

export const DEFAULT_CRASH_HISTORY = [2.75, 1.42, 5.18, 1.15, 3.84, 1.08, 12.40, 2.15, 1.63, 4.22, 1.95, 8.50]

export function loadInitialCrashHistory(): number[] {
  if (typeof window === 'undefined') return DEFAULT_CRASH_HISTORY
  try {
    const saved = localStorage.getItem(CRASH_HISTORY_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const valid = parsed.map(Number).filter((n) => !isNaN(n) && n >= 1)
        if (valid.length > 0) return valid.slice(0, MAX_HISTORY)
      }
    }
  } catch {
    // fallback
  }
  return DEFAULT_CRASH_HISTORY
}

/**
 * Состояние краш-игры «Ракетка». В Demo Mode фазы и исходы генерирует локальный
 * движок `demoCrashService` (честно помечено на экране); серверные раунды,
 * общий серверный множитель и Provably Fair — TIER 7 (4.3).
 */
export const useCrashStore = create<CrashState>(() => ({
  phase: 'betting',
  roundId: 0,
  ticksLeft: 100, // 5 секунд обратного отсчёта (100 тиков по 50мс)
  multiplier: 1,
  crashPoint: null,
  history: loadInitialCrashHistory(),
  myBet: null,
}))
