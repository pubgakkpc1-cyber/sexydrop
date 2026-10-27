import type { Minor } from '../lib/money'
import { GAME_RTP } from '../lib/gameConfig'
import { giftById, gifts } from '../data/catalog'
import { useInventoryStore } from '../store/inventory'
import { useGamesHistoryStore } from '../store/gamesHistory'
import { createRequestMemo } from '../lib/requestMemo'

/* --- Математика крафта (4.5) ---
 *
 * Вход: n ≥ 2 предметов суммарной стоимостью S (каталог-цены).
 * Цели крафта — предметы каталога дороже порога RTP: v_i > RTP · S.
 * Шанс крафта в цель v_i: p_i = (RTP · S) / v_i  (≤ 1 по построению).
 * Цель выбирается равномерно из списка кандидатов.
 *
 * Тождество EV (точное, без округлений):
 *   E = (1/|C|) · Σ p_i · v_i = (1/|C|) · Σ RTP·S = RTP · S.
 * Проигрыш сжигает все входные предметы; выигрыш — один целевой предмет.
 * В production расчёт и бросок исполняются сервером (TIER 7, 7.6).
 */

export const CRAFT_MIN_ITEMS = 2
export const CRAFT_MAX_CANDIDATES = 8

export interface CraftCandidate {
  giftId: string
  priceMinor: Minor
  /** Шанс крафта в эту цель p_i = RTP·S / v_i (доля от 1). */
  chance: number
}

export type CraftResult =
  | {
      status: 'ok'
      won: boolean
      targetGiftId: string
      /** Шанс у выбранной цели (для показа в журнале). */
      chance: number
      /** Суммарная стоимость входных предметов (S). */
      inputsMinor: Minor
    }
  | {
      status: 'rejected'
      reason: 'duplicate' | 'too_few_items' | 'unknown_item' | 'no_candidates'
    }

/**
 * Кандидаты крафта для суммы S: предметы каталога с v > RTP·S,
 * отсортированные по возрастанию цены, не более CRAFT_MAX_CANDIDATES.
 * Сравнение целочисленное: v·100 > 98·S ⇔ v > 0.98·S (без float-погрешности).
 */
export function craftCandidates(inputsMinor: Minor): CraftCandidate[] {
  const thresholdScaled = Math.round(GAME_RTP * 100) * inputsMinor // 98·S
  return gifts
    .filter((gift) => gift.available && gift.priceMinor * 100 > thresholdScaled)
    .sort((a, b) => a.priceMinor - b.priceMinor)
    .slice(0, CRAFT_MAX_CANDIDATES)
    .map((gift) => ({
      giftId: gift.id,
      priceMinor: gift.priceMinor,
      chance: (GAME_RTP * inputsMinor) / gift.priceMinor,
    }))
}

/** Идемпотентность операций: тот же client_request_id → тот же результат. */
const processedRequests = createRequestMemo<CraftResult>()

function processOnce(clientRequestId: string, execute: () => CraftResult): CraftResult {
  const cached = processedRequests.get(clientRequestId)
  if (cached) return cached
  const result = execute()
  processedRequests.set(clientRequestId, result)
  return result
}

let rng: () => number = Math.random

/** Подмена ГСЧ в тестах (паттерн caseMath/demoCrashService). Не для продукта. */
export function _setCraftRngForTests(next: () => number): void {
  rng = next
}

function assertRngValue(u: number): void {
  if (u < 0 || u >= 1) throw new Error(`rng must return [0, 1), got: ${u}`)
}

/**
 * Крафт (Demo Mode ONLY): несколько предметов инвентаря в один новый.
 * Иденпотентно по client_request_id; проигрыш сжигает входные предметы.
 */
export function craft(uids: readonly string[], clientRequestId: string): CraftResult {
  return processOnce(clientRequestId, () => {
    const uniqueUids = new Set(uids)
    if (uids.length < CRAFT_MIN_ITEMS || uniqueUids.size !== uids.length) {
      return { status: 'rejected', reason: 'too_few_items' } as const
    }
    const inventory = useInventoryStore.getState()
    const prices: Minor[] = []
    for (const uid of uids) {
      const item = inventory.items.find((candidate) => candidate.uid === uid)
      const price = item ? giftById.get(item.giftId)?.priceMinor : undefined
      if (!item || price === undefined) {
        return { status: 'rejected', reason: 'unknown_item' } as const
      }
      prices.push(price)
    }
    const inputsMinor = prices.reduce((sum, price) => sum + price, 0)

    const candidates = craftCandidates(inputsMinor)
    if (candidates.length === 0) {
      return { status: 'rejected', reason: 'no_candidates' } as const
    }

    // Цель — равномерно; затем одна монетка на шанс выбранной цели.
    const candidateIndex = Math.min(
      candidates.length - 1,
      Math.floor(rng() * candidates.length),
    )
    const target = candidates[candidateIndex]
    if (target === undefined) {
      // Инвариант: список непуст (проверено выше), индекс зажат в границы.
      throw new Error('craft invariant broken: candidate vanished')
    }
    const u = rng()
    assertRngValue(u)
    const won = u < target.chance

    // Входные предметы уходят со стола сразу; при выигрыше зачисляется цель.
    inventory.removeUids([...uids], 'craft-bet')
    if (won) {
      inventory.addGifts([target.giftId], 'craft')
    }

    const targetGift = giftById.get(target.giftId)
    const percent = Math.floor(target.chance * 100)
    useGamesHistoryStore.getState().push({
      game: 'Крафт',
      stakeLabel: `${uids.length} предм. · ${formatCraftSum(inputsMinor)} TON`,
      outcome: won ? 'won' : 'lost',
      deltaMinor: won ? target.priceMinor - inputsMinor : -inputsMinor,
      detail: won
        ? `выпал: ${targetGift?.name ?? target.giftId}`
        : `шанс ${percent}%`,
    })

    return {
      status: 'ok',
      won,
      targetGiftId: target.giftId,
      chance: target.chance,
      inputsMinor,
    } as const
  })
}

function formatCraftSum(minor: Minor): string {
  // Простое форматирование для журнала: целые + до 3 знаков, без фиктивной точности.
  const intPart = Math.floor(minor / 1000)
  const frac = String(minor % 1000).padStart(3, '0').replace(/0+$/, '')
  return frac ? `${intPart}.${frac}` : `${intPart}`
}

/** Полный сброс между тестами. Не использовать в продукте. */
export function _resetCraftForTests(): void {
  processedRequests.clear()
  rng = Math.random
}
