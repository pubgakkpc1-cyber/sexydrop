import type { Minor } from '../lib/money'
import { GAME_RTP } from '../lib/gameConfig'
import { createRequestMemo } from '../lib/requestMemo'
import { giftById } from '../data/catalog'
import { useInventoryStore } from '../store/inventory'
import { useGamesHistoryStore } from '../store/gamesHistory'

/* --- Математика апгрейда (4.4) ---
 *
 * Шанс апгрейда предмета ценой s в предмет ценой t:
 *   p = min(1, (s / t) · RTP), RTP = 0.98 (конфиг игры).
 * Исход — одна монетка: выигрыш с вероятностью p, иначе предмет сгорает.
 * EV (в стоимости) = p · t ≤ s · RTP всегда:
 *   — при p < 1: EV = s · RTP ровно;
 *   — при p = 1 (t ≤ s · RTP): EV = t ≤ s · RTP.
 * Множители/шансы на экране НЕ рисуются руками — считаются этой формулой.
 * В production расчёт и бросок исполняются сервером (TIER 7, 7.6).
 */

export type UpgradeResult =
  | {
      status: 'ok'
      won: boolean
      /** Шанс, который был у попытки (для показа в журнале). */
      chance: number
      sourcePriceMinor: Minor
      targetPriceMinor: Minor
    }
  | {
      status: 'rejected'
      reason: 'duplicate' | 'unknown_item' | 'unknown_target'
    }

/** Шанс апгрейда s → t (доля от 1). Для показа — upgradeChancePercent. */
export function upgradeChance(sourcePriceMinor: Minor, targetPriceMinor: Minor): number {
  if (sourcePriceMinor <= 0 || targetPriceMinor <= 0) return 0
  return Math.min(1, (sourcePriceMinor / targetPriceMinor) * GAME_RTP)
}

/**
 * Процент для показа: floor2(p × 100) — целочисленно
 * (floor(9800·s/t)/100), без float-погрешности умножения chance×10000.
 * При p = 1 показывает 100%.
 */
export function upgradeChancePercent(sourcePriceMinor: Minor, targetPriceMinor: Minor): number {
  if (sourcePriceMinor <= 0 || targetPriceMinor <= 0) return 0
  const p = upgradeChance(sourcePriceMinor, targetPriceMinor)
  if (p >= 1) return 100
  return Math.floor((Math.round(GAME_RTP * 10000) * sourcePriceMinor) / targetPriceMinor) / 100
}

/** Идемпотентность операций: тот же client_request_id → тот же результат. */
const processedRequests = createRequestMemo<UpgradeResult>()

function processOnce(clientRequestId: string, execute: () => UpgradeResult): UpgradeResult {
  const cached = processedRequests.get(clientRequestId)
  if (cached) return cached
  const result = execute()
  processedRequests.set(clientRequestId, result)
  return result
}

let rng: () => number = Math.random

/** Подмена ГСЧ в тестах (паттерн caseMath/demoCrashService). Не для продукта. */
export function _setUpgradeRngForTests(next: () => number): void {
  rng = next
}

function assertRngValue(u: number): void {
  if (u < 0 || u >= 1) throw new Error(`rng must return [0, 1), got: ${u}`)
}

/**
 * Апгрейд (Demo Mode ONLY): предмет инвентаря против цели из каталога.
 * Иденпотентно по client_request_id; проигрыш сжигает предмет без компенсации.
 */
export function placeUpgrade(
  uid: string,
  targetGiftId: string,
  clientRequestId: string,
): UpgradeResult {
  return processOnce(clientRequestId, () => {
    const inventory = useInventoryStore.getState()
    const item = inventory.items.find((candidate) => candidate.uid === uid)
    const sourcePrice = item ? giftById.get(item.giftId)?.priceMinor : undefined
    if (!item || sourcePrice === undefined) {
      return { status: 'rejected', reason: 'unknown_item' } as const
    }
    const target = giftById.get(targetGiftId)
    if (!target || !target.available || target.priceMinor <= 0) {
      return { status: 'rejected', reason: 'unknown_target' } as const
    }

    const chance = upgradeChance(sourcePrice, target.priceMinor)
    const u = rng()
    assertRngValue(u)
    const won = u < chance

    // Предмет уходит со стола сразу; при выигрыше зачисляется целевой предмет.
    inventory.removeUids([uid], 'upgrade-bet')
    if (won) {
      inventory.addGifts([target.id], 'upgrade')
    }

    // Процент — целочисленно: floor(9800·s/t)/100 = floor2(p·100), без float-погрешности.
    const percent = upgradeChancePercent(sourcePrice, target.priceMinor)
    useGamesHistoryStore.getState().push({
      game: 'Апгрейд',
      stakeLabel: giftById.get(item.giftId)?.name ?? 'Подарок',
      outcome: won ? 'won' : 'lost',
      deltaMinor: won ? target.priceMinor - sourcePrice : -sourcePrice,
      detail: won ? `выпал: ${target.name}` : `шанс ${percent.toFixed(2).replace(/\.?0+$/, '')}%`,
    })

    return {
      status: 'ok',
      won,
      chance,
      sourcePriceMinor: sourcePrice,
      targetPriceMinor: target.priceMinor,
    } as const
  })
}

/** Полный сброс между тестами. Не использовать в продукте. */
export function _resetUpgradeForTests(): void {
  processedRequests.clear()
  rng = Math.random
}
