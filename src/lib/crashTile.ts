import { gifts, type Gift } from '../data/catalog'

/** NFT-виды (PNG с реальным фоном), по возрастанию цены. */
const POOL: readonly Gift[] = gifts
  .filter((g) => /-\d$/.test(g.id) && g.image.endsWith('.png'))
  .sort((a, b) => a.priceMinor - b.priceMinor)

const BY_PRICE = new Map<number, Gift[]>()
for (const g of POOL) {
  const list = BY_PRICE.get(g.priceMinor)
  if (list) list.push(g)
  else BY_PRICE.set(g.priceMinor, [g])
}
const PRICES: readonly number[] = [...BY_PRICE.keys()].sort((a, b) => a - b)

function hash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return h >>> 0
}

/**
 * Картинка в плитке ставки Ракеты: самый дорогой NFT, цена которого не выше текущей
 * выплаты. Пока выплата меньше самого дешёвого NFT — возвращает undefined (рисуется
 * значок TON). По мере роста множителя NFT в плитке сменяется на более дорогие.
 * `prefer` — NFT, который игрок реально поставил (берётся, если цена совпала).
 */
export function tileGiftFor(valueMinor: number, seed: string, prefer?: Gift): Gift | undefined {
  if (!(valueMinor >= (PRICES[0] ?? Infinity))) return undefined
  let lo = 0
  let hi = PRICES.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if ((PRICES[mid] ?? 0) <= valueMinor) lo = mid
    else hi = mid - 1
  }
  const price = PRICES[lo]!
  if (prefer && prefer.priceMinor === price) return prefer
  const variants = BY_PRICE.get(price)!
  return variants[hash(seed) % variants.length]
}
