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
  history: [],
  myBet: null,
}))
