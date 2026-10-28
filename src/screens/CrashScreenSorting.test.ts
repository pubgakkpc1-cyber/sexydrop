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

  it('generates simulated players with valid stakeGiftId matching their stake value', () => {
    const players = generateRoundPlayers(42)
    expect(players.length).toBeGreaterThanOrEqual(7)

    // Check every player has a stakeGiftId matching catalog
    for (const p of players) {
      expect(p.stakeGiftId).toBeDefined()
      const gift = giftById.get(p.stakeGiftId)
      expect(gift).toBeDefined()
      // The gift's price should be close to or matching the stake
      expect(Math.abs(gift!.priceMinor - p.stakeMinor)).toBeLessThanOrEqual(p.stakeMinor * 0.5 + 500)
    }
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
})
