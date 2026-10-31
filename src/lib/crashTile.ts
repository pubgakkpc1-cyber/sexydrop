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

function hash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return h >>> 0
}

/**
 * Картинка в плитке ставки Ракеты. NFT показывается ТОЛЬКО если текущая выплата в точности равна
 * цене какого-то NFT — ровно так же решает сервис при кешауте (равноценный NFT в инвентарь,
 * иначе TON на баланс). Если NFT с такой ценой нет — undefined, и рисуется значок TON.
 * `prefer` — NFT, который игрок реально поставил (берётся, если цена совпала).
 */
export function tileGiftFor(valueMinor: number, seed: string, prefer?: Gift): Gift | undefined {
  const variants = BY_PRICE.get(valueMinor)
  if (!variants) return undefined
  if (prefer && prefer.priceMinor === valueMinor) return prefer
  return variants[hash(seed) % variants.length]
}
