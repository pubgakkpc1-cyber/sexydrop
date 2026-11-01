import serverCatalog from '../../backend/app/assets/catalog.json'
import { describe, expect, it } from 'vitest'
import { cases, gifts } from './catalog'

/**
 * Сервер считает деньги по `backend/app/assets/catalog.json` (экспорт каталога клиента).
 * Если цены подарков или состав кейсов изменились, файл нужно пересоздать: `npm run export:catalog`.
 */
describe('каталог сервера совпадает с клиентским', () => {
  const server = serverCatalog as unknown as {
    gifts: Record<string, { price: number; available: boolean }>
    cases: Record<string, { price: number; cooldown_ms: number | null; entries: [string, number][] }>
  }

  it('цены и доступность подарков', () => {
    expect(Object.keys(server.gifts).sort()).toEqual(gifts.map((g) => g.id).sort())
    for (const gift of gifts) {
      expect(server.gifts[gift.id]).toMatchObject({ price: gift.priceMinor, available: gift.available })
    }
  })

  it('цены, кулдауны и шансы кейсов', () => {
    expect(Object.keys(server.cases).sort()).toEqual(cases.map((c) => c.id).sort())
    for (const gameCase of cases) {
      const row = server.cases[gameCase.id]!
      expect(row.price).toBe(gameCase.priceMinor)
      expect(row.cooldown_ms).toBe(gameCase.freeCooldownMs)
      expect(row.entries).toEqual(gameCase.entries.map((e) => [e.itemId, e.weight]))
    }
  })

  it('каждый приз кейса есть в каталоге подарков (TON-призы считаются по id)', () => {
    for (const row of Object.values(server.cases)) {
      for (const [itemId] of row.entries) {
        expect(itemId.startsWith('ton_') || server.gifts[itemId] !== undefined).toBe(true)
      }
    }
  })
})
