import { mulByMultiplier, type Minor } from './money'
import { GAME_RTP_BPS } from './gameConfig'

/* --- PVP математика (TIER 5) ---
 *
 * Оба PVP-режима — Demo Mode: контрагент — «казино» с полностью раскрытыми
 * шансами (никаких фиктивных соперников); реальные игроки подключаются
 * в TIER 7 (7.6/7.8). Все расчёты целочисленные, округление только вниз —
 * в пользу казны (правило проекта).
 *
 * --- Solo Jackpot (5.2) ---
 * Банк формируется вкладами игрока: первый вклад b открывает раунд, казино
 * сразу добивает h = 9·b. До тиража игрок может докидывать вклады — его доля
 * s/(s+h) растёт. Шанс победы (спека 5.2 «шанс = доля ставки в банке»):
 *   p = RTP · s/(s+h) → chance = floor(9800·s / (s+h)) билетов из 10000.
 * Выплата = весь банк (s + h). EV раунда = p·банк − s ≤ (RTP−1)·s = −0.02·s:
 * floor не поднимает p, поэтому edge ровно 2% от внесённого и не больше.
 * Одиночная ставка b без докидываний: p = 9.8%, банк = 10·b, выплата ×10.
 */

/** Казино добивает банк девятью вкладами игрока (доля 90% на старте). */
export const JACKPOT_HOUSE_MULT = 9

/** База тиража: билет roll ∈ [0, 9999] — 10000 равновероятных значений. */
export const JACKPOT_TICKETS = 10_000

/** Вклад казино в банк раунда: h = 9·b (фиксируется при старте раунда). */
export function jackpotHouseStake(baseStakeMinor: Minor): Minor {
  return JACKPOT_HOUSE_MULT * baseStakeMinor
}

/** Полный банк раунда: вклады игрока + вклад казино. */
export function jackpotPoolMinor(stakedMinor: Minor, houseMinor: Minor): Minor {
  return stakedMinor + houseMinor
}

/** Шанс победы в билетах из 10000: floor(9800·s/(s+h)) — только вниз. */
export function jackpotChanceTickets(stakedMinor: Minor, houseMinor: Minor): number {
  return Math.floor((GAME_RTP_BPS * stakedMinor) / (stakedMinor + houseMinor))
}

/** Доля игрока в банке из 10000 (отображение): floor(10000·s/(s+h)). */
export function jackpotShareParts(stakedMinor: Minor, houseMinor: Minor): number {
  return Math.floor((10_000 * stakedMinor) / (stakedMinor + houseMinor))
}

/** Билет тиража из ГСЧ: floor(u·10000), зажат в [0, 9999]. */
export function jackpotRollFromU(u: number): number {
  const roll = Math.floor(u * JACKPOT_TICKETS)
  return Math.min(JACKPOT_TICKETS - 1, Math.max(0, roll))
}

/** Выигрыш: билет попал в долю игрока с поправкой RTP — строго roll < chance. */
export function isJackpotWin(roll: number, chanceTickets: number): boolean {
  return roll < chanceTickets
}

/** EV раунда в минорных единицах (публикуется на экране): floor(P·банк) − s. */
export function jackpotEvMinor(stakedMinor: Minor, houseMinor: Minor): Minor {
  const tickets = jackpotChanceTickets(stakedMinor, houseMinor)
  return Math.floor((tickets * (stakedMinor + houseMinor)) / 10_000) - stakedMinor
}

/* --- TVT: Ice vs Fire (5.3) --- */

export type TvtSide = 'ice' | 'fire'

/**
 * Множитель при p = 0.5 и RTP 0.98: floor(98·100/50) = 196 сотых → ×1.96.
 * EV монеты = 0.5·floor(b·1.96) − b ≤ −0.02·b (округление вниз — в пользу казны).
 */
export const TVT_MULT_HUNDREDTHS = 196

export function isTvtSide(value: unknown): value is TvtSide {
  return value === 'ice' || value === 'fire'
}

/** Монета: u < 0.5 → Лёд, иначе Огонь — стороны строго равновероятны. */
export function tvtFlipFromU(u: number): TvtSide {
  return u < 0.5 ? 'ice' : 'fire'
}

/** Выплата победителю: floor(ставка × 1.96) — округление вниз, в пользу казны. */
export function tvtPayoutMinor(betMinor: Minor): Minor {
  return mulByMultiplier(betMinor, TVT_MULT_HUNDREDTHS / 100)
}
