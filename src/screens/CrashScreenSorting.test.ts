import { describe, it, expect } from 'vitest'
import { getGiftForValue, giftById } from '../data/catalog'
import { generateRoundPlayers } from '../services/crashLivePlayers'

describe('Crash Screen Stakes Sorting & NFT Value Mapping', () => {
  it('assigns golden-trophy for 60000 minor value', () => {
    const gift = getGiftForValue(60000)
    expect(gift.id).toBe('golden-trophy')
    expect(gift.name).toBe('Golden Trophy')
    expect(gift.priceMinor).toBe(60000)
    expect(gift.image).toBe('/gifts/golden-trophy.svg')
  })

  it('NFT-ставка бота равна реальной цене NFT; ставка TON — без подарка и с 1 знаком после точки', () => {
    let nft = 0
    let ton = 0
    for (let round = 1; round <= 40; round++) {
      for (const p of generateRoundPlayers(round)) {
        if (p.stakeGiftId) {
          nft++
          const gift = giftById.get(p.stakeGiftId)
          expect(gift).toBeDefined()
          expect(p.stakeMinor).toBe(gift!.priceMinor)
        } else {
          ton++
          expect(p.stakeMinor % 100).toBe(0) // кратно 0.1 TON
          expect(p.stakeMinor).toBeGreaterThanOrEqual(100)
        }
      }
    }
    expect(nft).toBeGreaterThan(0)
    expect(ton).toBeGreaterThan(0)
  })

  it('ники и аватарки меняются между раундами и не повторяются внутри раунда', () => {
    const r1 = generateRoundPlayers(1)
    const r9 = generateRoundPlayers(9)
    expect(new Set(r1.map((p) => p.name)).size).toBe(r1.length)
    expect(new Set(r1.map((p) => p.avatar)).size).toBe(r1.length)
    expect(r1.map((p) => p.name).join()).not.toBe(r9.map((p) => p.name).join())
  })

  it('orders generated round players strictly descending by stakeMinor (от большого к маленькому)', () => {
    const players = generateRoundPlayers(100)
    for (let i = 0; i < players.length - 1; i++) {
      expect(players[i]!.stakeMinor).toBeGreaterThanOrEqual(players[i + 1]!.stakeMinor)
    }
  })

  it('verifies golden trophy is present in catalog and giftById', () => {
    const trophy = giftById.get('golden-trophy')
    expect(trophy).toBeDefined()
    expect(trophy!.id).toBe('golden-trophy')
    expect(trophy!.rarity).toBe('legendary')
  })

  it('formats player multipliers strictly with 0.1 precision (1 decimal digit)', () => {
    const formatMult = (val: number) => `${(Math.floor(val * 10) / 10).toFixed(1)}x`
    expect(formatMult(1.428)).toBe('1.4x')
    expect(formatMult(2.05)).toBe('2.0x')
    expect(formatMult(5.99)).toBe('5.9x')
    expect(formatMult(10.0)).toBe('10.0x')
  })

  it('orders player rows with priority: cashed out (1) -> active (2) -> crashed/lost (3)', () => {
    interface TestRow {
      id: string
      stakeMinor: number
      isCashed: boolean
      isLost: boolean
    }
    const rows: TestRow[] = [
      { id: 'lost-1', stakeMinor: 5000, isCashed: false, isLost: true },
      { id: 'active-1', stakeMinor: 2000, isCashed: false, isLost: false },
      { id: 'won-1', stakeMinor: 1000, isCashed: true, isLost: false },
      { id: 'won-2', stakeMinor: 3000, isCashed: true, isLost: false },
      { id: 'lost-2', stakeMinor: 8000, isCashed: false, isLost: true },
    ]

    const sorted = [...rows].sort((a, b) => {
      const priorityA = a.isCashed ? 1 : a.isLost ? 3 : 2
      const priorityB = b.isCashed ? 1 : b.isLost ? 3 : 2
      if (priorityA !== priorityB) return priorityA - priorityB
      return b.stakeMinor - a.stakeMinor
    })

    // Выигравшие выше всех (отсортированы по ставке)
    expect(sorted[0]!.id).toBe('won-2') // 3000
    expect(sorted[1]!.id).toBe('won-1') // 1000
    // Активные в середине
    expect(sorted[2]!.id).toBe('active-1') // 2000
    // Слившие в самом низу (отсортированы по ставке)
    expect(sorted[3]!.id).toBe('lost-2') // 8000
    expect(sorted[4]!.id).toBe('lost-1') // 5000
  })
})
