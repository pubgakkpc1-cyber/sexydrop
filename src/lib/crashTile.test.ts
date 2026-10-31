import { describe, expect, it } from 'vitest'
import { giftById } from '../data/catalog'
import { tileGiftFor } from './crashTile'
import { MULT_TIER_STYLE, multTier } from './multTier'

describe('tileGiftFor (плитка ставки Ракеты)', () => {
  it('NFT только при точном совпадении цены; иначе значок TON (undefined)', () => {
    expect(tileGiftFor(4_999, 'a')).toBeUndefined()
    expect(tileGiftFor(0, 'a')).toBeUndefined()
    expect(tileGiftFor(20_000, 'a')).toBeUndefined() // между NFT — выплата будет в TON
    expect(tileGiftFor(7_001, 'a')).toBeUndefined()
  })

  it('точная цена NFT — показывается именно NFT этой цены', () => {
    expect(tileGiftFor(7_000, 'a')?.priceMinor).toBe(7_000) // Snoop Dogg
    expect(tileGiftFor(194_300, 'a')?.priceMinor).toBe(194_300) // Heroic Helmet
    expect(tileGiftFor(6_720_000, 'a')?.priceMinor).toBe(6_720_000) // Plush Pepe
  })

  it('если цена совпала с поставленным NFT — берётся именно он', () => {
    const staked = giftById.get('chill_flame-2')!
    expect(tileGiftFor(staked.priceMinor, 'x', staked)?.id).toBe('chill_flame-2')
  })

  it('детерминирован: один и тот же seed — одна и та же картинка', () => {
    expect(tileGiftFor(7_000, 'player-1')?.id).toBe(tileGiftFor(7_000, 'player-1')?.id)
  })
})

describe('multTier (цвета иксов)', () => {
  it('плохие иксы серые, хорошие зелёные/голубые/фиолетовые — красного нет', () => {
    expect(multTier(1.0)).toBe('bad')
    expect(multTier(1.19)).toBe('bad')
    expect(multTier(1.2)).toBe('amber')
    expect(multTier(1.99)).toBe('amber')
    expect(multTier(2)).toBe('green')
    expect(multTier(5)).toBe('cyan')
    expect(multTier(10)).toBe('violet')
    for (const style of Object.values(MULT_TIER_STYLE)) {
      expect(style.color).not.toMatch(/^#(?:[c-f][0-9a-f])(?:[0-6][0-9a-f]){2}$/i) // не красный оттенок (R высокий, G и B низкие)
    }
  })
})
