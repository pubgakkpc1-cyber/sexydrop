import { giftById } from '../data/catalog'

/** Забирает с сервера цены подарков по рынку и применяет их к каталогу (показ цен совпадает с серверными). Без ответа остаются каталожные. */
export async function loadMarketPrices(): Promise<void> {
  try {
    const res = await fetch('/api/market-prices', { cache: 'no-store' })
    if (!res.ok) return
    applyMarketPrices((await res.json()) as Record<string, number>)
  } catch {
    /* нет сети — цены каталога */
  }
}

export function applyMarketPrices(prices: Readonly<Record<string, number>>): void {
  for (const [id, minor] of Object.entries(prices)) {
    const gift = giftById.get(id)
    if (gift && Number.isFinite(minor) && minor > 0) (gift as { priceMinor: number }).priceMinor = Math.round(minor)
  }
}
