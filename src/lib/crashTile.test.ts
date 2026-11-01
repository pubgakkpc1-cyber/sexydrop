import { describe, expect, it } from 'vitest'
import { giftById, gifts } from '../data/catalog'
import { nftPriceFor, tileGiftFor } from './crashTile'
import { MULT_TIER_STYLE, multTier } from './multTier'

describe('tileGiftFor (плитка ставки Ракеты)', () => {
  const snoop = giftById.get('snoop_dogg-1')!.priceMinor
  const helmet = giftById.get('heroic_helmet-1')!.priceMinor

  it('NFT только при точном совпадении цены; иначе значок TON (undefined)', () => {
    expect(tileGiftFor(4_999, 'a')).toBeUndefined()
    expect(tileGiftFor(0, 'a')).toBeUndefined()
    expect(tileGiftFor(snoop + 100, 'a')).toBeUndefined() // NFT 7.07, выплата 7.17 — это TON
    expect(tileGiftFor(snoop - 1, 'a')).toBeUndefined()
  })

  it('точная цена NFT — показывается именно NFT этой цены', () => {
    expect(tileGiftFor(snoop, 'a')?.priceMinor).toBe(snoop)
    expect(tileGiftFor(helmet, 'a')?.priceMinor).toBe(helmet)
  })

  it('nftPriceFor совпадает с тем, что платит сервис', () => {
    expect(nftPriceFor(snoop)).toBe(snoop)
    // цена, которой нет ни у одного NFT (цены видов теперь плотные — ищем свободную)
    const taken = new Set(gifts.map((g) => g.priceMinor))
    let free = snoop + 450
    while (taken.has(free)) free += 1
    expect(nftPriceFor(free)).toBeUndefined()
  })

  it('если цена совпала с поставленным NFT — берётся именно он', () => {
    const staked = giftById.get('chill_flame-2')!
    expect(tileGiftFor(staked.priceMinor, 'x', staked)?.id).toBe('chill_flame-2')
  })

  it('детерминирован: один и тот же seed — одна и та же картинка', () => {
    expect(tileGiftFor(snoop, 'player-1')?.id).toBe(tileGiftFor(snoop, 'player-1')?.id)
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
