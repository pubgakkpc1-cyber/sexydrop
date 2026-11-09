import { describe, expect, it } from 'vitest'
import { caseById } from '../data/catalog'
import { buildCaseStrip } from './caseStrip'

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

describe('лента рулетки кейса', () => {
  const free = caseById.get('free')!
  const inCase = new Set(free.entries.map((e) => e.itemId))

  it('выигрыш стоит на своём месте, остальное — только подарки этого кейса', () => {
    for (let seed = 1; seed < 40; seed += 1) {
      const strip = buildCaseStrip(free, 50, { index: 40, giftId: 'timeless_book-4' }, seeded(seed))
      expect(strip).toHaveLength(50)
      expect(strip[40]).toBe('timeless_book-4')
      for (const g of strip) expect(inCase.has(g)).toBe(true)
    }
  })

  it('один и тот же подарок никогда не стоит два раза подряд', () => {
    for (let seed = 1; seed < 200; seed += 1) {
      const strip = buildCaseStrip(free, 50, { index: 40, giftId: 'ice_cream-4' }, seeded(seed))
      for (let i = 1; i < strip.length; i += 1) expect(strip[i]).not.toBe(strip[i - 1])
    }
  })

  it('в ленте видны все подарки кейса, а не одни дешёвые', () => {
    const strip = buildCaseStrip(free, 50, undefined, seeded(7))
    expect(new Set(strip)).toEqual(inCase)
  })
})
