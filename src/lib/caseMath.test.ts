import { describe, expect, it } from 'vitest'
import {
  caseById,
  cases,
  freeCases,
  gifts,
  giftById,
  paidCases,
  RARITY_LABELS,
} from '../data/catalog'
import { caseWeights } from '../data/caseWeights.generated'
import {
  displayProbabilityBps,
  expectedValueMinor,
  isWithinRtp,
  rtpUtilizationBps,
} from './caseMath'

const RTP_BPS = 9_800

/** Взвешенные позиции кейса с ценами подарков. */
function priced(caseId: string) {
  const gameCase = caseById.get(caseId)
  if (!gameCase) throw new Error(`unknown case ${caseId}`)
  return gameCase.entries.map((entry) => {
    const gift = giftById.get(entry.itemId)
    if (!gift) throw new Error(`unknown gift ${entry.itemId}`)
    return { priceMinor: gift.priceMinor, weight: entry.weight }
  })
}

describe('case math', () => {
  it('считает точный рациональный EV без потери дробных минорных единиц', () => {
    expect(
      expectedValueMinor([
        { priceMinor: 100, weight: 1 },
        { priceMinor: 101, weight: 2 },
      ]),
    ).toEqual({ numerator: 302n, denominator: 3n })
  })

  it('отвергает пустые кейсы, нулевые веса и RTP выше 100%', () => {
    expect(() => expectedValueMinor([])).toThrow()
    expect(() =>
      isWithinRtp([{ priceMinor: 100, weight: 0 }], 100, RTP_BPS),
    ).toThrow()
    expect(() => isWithinRtp([{ priceMinor: 100, weight: 1 }], 100, 10_001)).toThrow()
  })

  it('сумма показанных шансов всегда ровно 100.00%', () => {
    const probabilities = displayProbabilityBps([{ weight: 1 }, { weight: 1 }, { weight: 1 }])
    expect(probabilities).toEqual([3_334, 3_333, 3_333])
    for (const gameCase of cases) {
      const sum = displayProbabilityBps(gameCase.entries).reduce((a, b) => a + b, 0)
      expect(sum).toBe(10_000)
    }
  })
})

describe('catalog: gifts', () => {
  it('имеет уникальные id, локальные изображения и корректные метаданные', () => {
    expect(new Set(gifts.map((gift) => gift.id)).size).toBe(gifts.length)
    for (const gift of gifts) {
      expect(gift.image).toMatch(/^\/gifts\/.+\.(svg|png)$/)
      expect(gift.priceMinor).toBeGreaterThan(0)
      expect(RARITY_LABELS[gift.rarity]).toBeTruthy()
      expect(typeof gift.serialNumber === 'number' || gift.serialNumber === null).toBe(true)
      expect(gift.available).toBe(true)
    }
  })

  it('содержит подарки из спецификации (раздел 8)', () => {
    const ids = new Set(gifts.map((gift) => gift.id))
    for (const required of [
      'plush-pepe',
      'durovs-cap',
      'heart-locket',
      'astral-shard',
      'fresh-socks',
      'resistance-dog',
      'scared-cat',
      'instant-ramen',
      'chill-flame',
      'xmas-stocking',
      'diamond-ring',
      'cyber-helmet',
    ]) {
      expect(ids.has(required)).toBe(true)
    }
  })
})

describe('catalog: cases — инвариант EV и RTP', () => {
  it('у всех 20 платных кейсов цена из конфигурации продукта', () => {
    const expected = new Map(
      Object.entries({
        farm: 6000,
        autumn: 8000,
        movie: 9000,
        telegram: 10000,
        space: 12000,
        magic: 10000,
        kitty: 10000,
        adult18: 14000,
        money: 16000,
        'onyx-black': 16000,
        snoop: 15000,
        peach: 16000,
        gem: 16000,
        pepe: 30000,
        cap: 30000,
        ring: 30000,
        black: 40000,
        epic: 80000,
        vip: 120000,
        elite: 300000,
      }),
    )
    expect(paidCases).toHaveLength(expected.size)
    for (const gameCase of paidCases) {
      expect(gameCase.priceMinor).toBe(expected.get(gameCase.id))
    }
  })

  it('EV каждого кейса не превышает price * RTP (0.98) — гарантия казны', () => {
    for (const gameCase of paidCases) {
      expect(isWithinRtp(priced(gameCase.id), gameCase.priceMinor, RTP_BPS)).toBe(true)
    }
  })

  it('EV использует RTP не хуже чем на 90% — кейсы не «пустые»', () => {
    for (const gameCase of paidCases) {
      const utilization = rtpUtilizationBps(priced(gameCase.id), gameCase.priceMinor, RTP_BPS)
      expect(utilization).toBeGreaterThanOrEqual(9_000)
    }
  })

  it('доля топ-предмета не превышает 45%, кроме дешёвого Farm (структурное ограничение)', () => {
    for (const gameCase of paidCases) {
      const total = gameCase.entries.reduce((sum, entry) => sum + entry.weight, 0)
      const topShare = Math.max(...gameCase.entries.map((entry) => entry.weight)) / total
      if (gameCase.id === 'farm') {
        expect(topShare).toBeLessThanOrEqual(0.75)
      } else {
        expect(topShare).toBeLessThanOrEqual(0.45)
      }
    }
  })

  it('бесплатные кейсы: цена 0, кулдаун задан, EV соответствует целевому значению', () => {
    expect(freeCases.map((c) => c.id).sort()).toEqual(['free', 'free24'])
    for (const gameCase of freeCases) {
      expect(gameCase.priceMinor).toBe(0)
      expect(gameCase.freeCooldownMs).toBeGreaterThan(0)
      const entries = priced(gameCase.id)
      const targetMinor = gameCase.id === 'free24' ? 16_000 : 8_000
      expect(isWithinRtp(entries, targetMinor, RTP_BPS)).toBe(true)
      expect(rtpUtilizationBps(entries, targetMinor, RTP_BPS)).toBeGreaterThanOrEqual(9_000)
    }
  })

  it('веса каталога совпадают с выдачей EV-солвера (ручной массив — только кэш формулы)', () => {
    for (const gameCase of cases) {
      const generated = caseWeights[gameCase.id]
      expect(generated).toBeTruthy()
      expect(gameCase.entries.map((e) => [e.itemId, e.weight])).toEqual(generated)
    }
  })

  it('все предметы кейсов существуют и веса положительные целые', () => {
    for (const gameCase of cases) {
      expect(gameCase.entries.length).toBeGreaterThanOrEqual(4)
      for (const entry of gameCase.entries) {
        expect(giftById.has(entry.itemId)).toBe(true)
        expect(Number.isSafeInteger(entry.weight)).toBe(true)
        expect(entry.weight).toBeGreaterThan(0)
      }
    }
  })

  it('у кейсов уникальные id и локальные изображения', () => {
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length)
    for (const gameCase of cases) {
      expect(gameCase.image).toMatch(/^\/cases\/.+\.svg$/)
    }
  })

  it('caseById находит кейсы', () => {
    expect(caseById.get('elite')?.name).toBe('Elite')
    expect(caseById.get('farm')?.priceMinor).toBe(6000) // 6 TON
    expect(caseById.get('free')?.freeCooldownMs).toBe(3_600_000)
    expect(caseById.get('free24')?.freeCooldownMs).toBe(86_400_000)
  })
})
