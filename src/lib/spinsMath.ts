import { GAME_RTP } from './gameConfig'

/**
 * Математика Спинов (4.9, спека 10.9). Колесо из 10 символов: 9 подарков
 * (весами 1…18) + бонус-символ (вес 8; «двойной шанс» — 16).
 *
 * Нормализация как в Плинко: у каждого из N символов честная доля RTP/N,
 * поэтому множитель m_i = RTP / (p_i · N) даёт Σ p_i·m_i = RTP точно.
 * Округление только вниз, целочисленно в сотых:
 *   m_i_hundredths = floor(RTP × 100 · W / (w_i · N)),
 * где W — суммарный вес, N = 10. Тогда p_i·m_i ≤ RTP/N ⇒ EV ≤ RTP всегда.
 *
 * Бонус-символ сам не платит: даёт один бесплатный спин на машине M2
 * (только подарки, N' = 9, W' = 72): m'_i_h = floor(98·72/(w_i·9)) = floor(784/w_i).
 * Свободная ставка спина масштабируется так, чтобы вклад бонуса в EV был
 * честной долей RTP/N: freeStake = floor(bet · W / (N · w_b))
 *   — обычный: floor(bet·80/80) = bet; двойной: floor(bet·88/160) = floor(0.55·bet).
 *
 * Покупка бонуса: цена = ceil(E2num · bet / (98 · 72)) — округление ВВЕРХ,
 * в пользу казны (floor дал бы RTP покупки > 0.98): RTP_покупки ≤ 0.98.
 */

const RTP_PCT = Math.round(GAME_RTP * 100) // 98

export interface SpinsSymbolDef {
  giftId: string
  name: string
  weight: number
}

export const SPINS_GIFTS: readonly SpinsSymbolDef[] = [
  { giftId: 'plush-pepe', name: 'Plush Pepe', weight: 1 },
  { giftId: 'crystal-ball', name: 'Crystal Ball', weight: 2 },
  { giftId: 'astral-shard', name: 'Astral Shard', weight: 3 },
  { giftId: 'neon-dream', name: 'Neon Dream', weight: 5 },
  { giftId: 'heart-locket', name: 'Heart Locket', weight: 7 },
  { giftId: 'magic-potion', name: 'Magic Potion', weight: 9 },
  { giftId: 'holiday-gift', name: 'Holiday Gift', weight: 12 },
  { giftId: 'xmas-stocking', name: 'Xmas Stocking', weight: 15 },
  { giftId: 'chill-flame', name: 'Chill Flame', weight: 18 },
]

export const SPINS_BONUS_WEIGHT = 8
export const SPINS_BONUS_WEIGHT_DOUBLE = SPINS_BONUS_WEIGHT * 2
export const SPINS_SYMBOLS = SPINS_GIFTS.length + 1 // 10
export const SPINS_CELLS = 25

/** Суммарный вес колеса: 72 + 8 (обычный) или 72 + 16 (двойной шанс). */
export function weightsTotal(doubleChance: boolean): number {
  const bonus = doubleChance ? SPINS_BONUS_WEIGHT_DOUBLE : SPINS_BONUS_WEIGHT
  return SPINS_GIFTS.reduce((sum, symbol) => sum + symbol.weight, 0) + bonus
}

/** Множитель подарка основного колеса, в сотых: floor(98·W/(w_i·N)). */
export function spinsMultiplierHundredths(giftIndex: number, doubleChance: boolean): number {
  const symbol = SPINS_GIFTS[giftIndex]
  if (!symbol) return 0
  return Math.floor((RTP_PCT * weightsTotal(doubleChance)) / (symbol.weight * SPINS_SYMBOLS))
}

/** Множитель как float (только для отображения; деньги считают сотые). */
export function spinsMultiplier(giftIndex: number, doubleChance: boolean): number {
  return spinsMultiplierHundredths(giftIndex, doubleChance) / 100
}

/** Машина бонусного спина M2: только подарки, N' = 9 → floor(784/w_i). */
export function bonusMultiplierHundredths(giftIndex: number): number {
  const symbol = SPINS_GIFTS[giftIndex]
  if (!symbol) return 0
  return Math.floor((RTP_PCT * 72) / (symbol.weight * 9))
}

/** Числитель EV машины M2: Σ w_i · m'_i_h (целое; знаменатель 72·100). */
export function bonusEvNumerator(): number {
  return SPINS_GIFTS.reduce(
    (sum, symbol, index) => sum + symbol.weight * bonusMultiplierHundredths(index),
    0,
  )
}

/** Свободная ставка бонусного спина: floor(bet · W / (N · w_b)). */
export function bonusFreeStakeMinor(betMinor: number, doubleChance: boolean): number {
  const wBonus = doubleChance ? SPINS_BONUS_WEIGHT_DOUBLE : SPINS_BONUS_WEIGHT
  return Math.floor((betMinor * weightsTotal(doubleChance)) / (SPINS_SYMBOLS * wBonus))
}

/**
 * Цена покупки бонуса: ceil(E2num · bet / (98·72)) — вверх, в пользу казны;
 * RTP покупки = E2 · bet / цена ≤ 0.98.
 */
export function bonusBuyPriceMinor(betMinor: number): number {
  if (!Number.isSafeInteger(betMinor) || betMinor <= 0) return 0
  const numerator = bonusEvNumerator() * betMinor
  return Math.ceil(numerator / (RTP_PCT * 72))
}

/** Взвешенный выбор индекса символа 0…9 (9 = бонус). */
export function pickSpinsIndex(doubleChance: boolean, rng: () => number): number {
  const total = weightsTotal(doubleChance)
  const r = Math.floor(rng() * total)
  if (r < 0 || r >= total) throw new Error('rng must return [0, 1)')
  let cumulative = 0
  for (let i = 0; i < SPINS_GIFTS.length; i += 1) {
    const symbol = SPINS_GIFTS[i]
    if (!symbol) throw new Error('symbol table corrupted')
    cumulative += symbol.weight
    if (r < cumulative) return i
  }
  return SPINS_GIFTS.length // бонус-символ
}

/** Взвешенный выбор подарка для машины M2 (0…8). */
export function pickGiftIndex(rng: () => number): number {
  const total = 72
  const r = Math.floor(rng() * total)
  if (r < 0 || r >= total) throw new Error('rng must return [0, 1)')
  let cumulative = 0
  for (let i = 0; i < SPINS_GIFTS.length; i += 1) {
    const symbol = SPINS_GIFTS[i]
    if (!symbol) throw new Error('symbol table corrupted')
    cumulative += symbol.weight
    if (r < cumulative) return i
  }
  return SPINS_GIFTS.length - 1
}
