import { giftById, paidCases, type Gift } from '../data/catalog'
import { pickWeighted } from '../lib/caseMath'

/** Длительность одного «слота» ленты. Новый дроп появляется каждые SLOT_MS у всех одновременно. */
export const LIVE_SLOT_MS = 6000
/** Сколько последних дропов показывает лента. */
export const LIVE_VISIBLE = 14

export interface LiveDrop {
  /** Номер слота (мс эпохи / LIVE_SLOT_MS) — стабильный id дропа. */
  slot: number
  caseId: string
  caseName: string
  gift: Gift
  /** Дорогой дроп (стоимость ≥ 3 цен кейса) — подсвечивается. */
  isHit: boolean
}

/** mulberry32 — маленький детерминированный генератор. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Дроп конкретного слота. Результат зависит ТОЛЬКО от номера слота и каталога, поэтому у всех
 * устройств лента совпадает в каждый момент, а история восстанавливается заново в любой момент
 * (ничего не теряется при перезапуске). Кейс и подарок берутся из реальных весов кейсов.
 */
export function liveDropForSlot(slot: number): LiveDrop {
  const rng = seeded(slot * 2654435761 + 12345)
  const cases = paidCases
  let best: LiveDrop | null = null
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const gameCase = cases[Math.floor(rng() * cases.length)]!
    const entry = pickWeighted(gameCase.entries, rng)
    const gift = giftById.get(entry.itemId)
    if (!gift) continue
    const drop: LiveDrop = {
      slot,
      caseId: gameCase.id,
      caseName: gameCase.name,
      gift,
      isHit: gift.priceMinor >= gameCase.priceMinor * 3,
    }
    best = drop
    // в ленте интереснее дропы не дешевле половины цены кейса — иначе пробуем ещё раз
    if (gift.priceMinor * 2 >= gameCase.priceMinor) break
  }
  if (!best) throw new Error('liveDropForSlot: каталог пуст')
  return best
}

/** Текущий слот по времени. */
export function currentSlot(now: number): number {
  return Math.floor(now / LIVE_SLOT_MS)
}

/** Последние дропы, новейший первым. */
export function liveFeed(now: number, count = LIVE_VISIBLE): LiveDrop[] {
  const slot = currentSlot(now)
  return Array.from({ length: count }, (_, i) => liveDropForSlot(slot - i))
}

/** Через сколько мс начнётся следующий слот. */
export function msToNextSlot(now: number): number {
  return LIVE_SLOT_MS - (now % LIVE_SLOT_MS)
}
