import type { Minor } from './money'

/** Взвешенный исход кейса. Вес — строго положительное целое число. */
export interface WeightedPricedItem {
  priceMinor: Minor
  weight: number
}

export interface Rational {
  numerator: bigint
  denominator: bigint
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer, got: ${value}`)
  }
}

export function assertEntries(entries: readonly WeightedPricedItem[]): void {
  if (entries.length === 0) throw new Error('A case must contain at least one item')
  for (const entry of entries) {
    assertPositiveInteger(entry.weight, 'weight')
    assertPositiveInteger(entry.priceMinor, 'priceMinor')
  }
}

export function totalWeight(entries: readonly Pick<WeightedPricedItem, 'weight'>[]): number {
  if (entries.length === 0) throw new Error('A case must contain at least one item')
  return entries.reduce((sum, entry) => {
    assertPositiveInteger(entry.weight, 'weight')
    return sum + entry.weight
  }, 0)
}

/** Точное математическое ожидание стоимости выпавшего предмета в минорных единицах. */
export function expectedValueMinor(entries: readonly WeightedPricedItem[]): Rational {
  assertEntries(entries)
  const denominator = BigInt(totalWeight(entries))
  const numerator = entries.reduce(
    (sum, entry) => sum + BigInt(entry.priceMinor) * BigInt(entry.weight),
    0n,
  )
  return { numerator, denominator }
}

/**
 * Инвариант RTP для кейса с фиксированной ценой: EV <= price * RTP.
 * Сравнение точное, через BigInt.
 */
export function isWithinRtp(
  entries: readonly WeightedPricedItem[],
  priceMinor: Minor,
  rtpBps: number,
): boolean {
  assertPositiveInteger(priceMinor, 'priceMinor')
  assertPositiveInteger(rtpBps, 'rtpBps')
  if (rtpBps > 10_000) throw new Error(`rtpBps cannot exceed 10000, got: ${rtpBps}`)
  const ev = expectedValueMinor(entries)
  return ev.numerator <= BigInt(priceMinor) * ev.denominator * BigInt(rtpBps) / 10_000n
}

/**
 * Утилизация RTP: EV / (price * RTP), в базисных пунктах (округление вниз).
 * 10000 = RTP использован полностью; значение ниже 10000 — «запас» в пользу казны.
 */
export function rtpUtilizationBps(
  entries: readonly WeightedPricedItem[],
  priceMinor: Minor,
  rtpBps: number,
): number {
  const ev = expectedValueMinor(entries)
  // utilization = EV / (price * rtpBps / 10000); в bps: * 1e8 / (price * rtpBps)
  const denominator = BigInt(priceMinor) * ev.denominator * BigInt(rtpBps)
  return Number((ev.numerator * 100_000_000n) / denominator)
}

/**
 * Честный взвешенный выбор: доля исхода i = w_i / Σw.
 * rng подаётся снаружи (в demo — Math.random, в тестах — детерминированный).
 */
export function pickWeighted<T extends { weight: number }>(
  entries: readonly T[],
  rng: () => number = Math.random,
): T {
  const total = totalWeight(entries)
  const roll = rng() * total
  let cumulative = 0
  for (const entry of entries) {
    cumulative += entry.weight
    if (roll < cumulative) return entry
  }
  const last = entries[entries.length - 1]
  if (!last) throw new Error('Unreachable: entries are non-empty')
  return last
}

/**
 * Вероятности для UI в сотых процентах (10000 = 100%). Метод наибольших
 * остатков сохраняет сумму ровно 100.00%, включая очень малые шансы.
 */
export function displayProbabilityBps(
  entries: readonly Pick<WeightedPricedItem, 'weight'>[],
): number[] {
  const total = totalWeight(entries)
  const exact = entries.map((entry, index) => {
    const numerator = BigInt(entry.weight) * 10_000n
    const denominator = BigInt(total)
    return {
      index,
      value: Number(numerator / denominator),
      remainder: numerator % denominator,
    }
  })
  let unitsLeft = 10_000 - exact.reduce((sum, item) => sum + item.value, 0)
  const byRemainder = [...exact].sort((a, b) => {
    if (a.remainder === b.remainder) return a.index - b.index
    return a.remainder > b.remainder ? -1 : 1
  })
  for (const item of byRemainder) {
    if (unitsLeft === 0) break
    item.value += 1
    unitsLeft -= 1
  }
  return exact.map((item) => item.value)
}
