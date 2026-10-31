import { describe, expect, it } from 'vitest'
import { giftById } from '../data/catalog'
import { tileGiftFor } from './crashTile'
import { MULT_TIER_STYLE, multTier } from './multTier'

describe('tileGiftFor (плитка ставки Ракеты)', () => {
  it('ниже самого дешёвого NFT (5 TON) — значка NFT нет, рисуется TON', () => {
    expect(tileGiftFor(4_999, 'a')).toBeUndefined()
    expect(tileGiftFor(0, 'a')).toBeUndefined()
  })

  it('берёт самый дорогой NFT не дороже выплаты и меняется по мере роста', () => {
    const at7 = tileGiftFor(7_000, 'a')
    const at20 = tileGiftFor(20_000, 'a')
    const at200 = tileGiftFor(200_000, 'a')
    expect(at7?.priceMinor).toBe(7_000) // Snoop Dogg
    expect(at20?.priceMinor).toBe(18_900) // Mad Pumpkin / Trapped Heart
    expect(at200?.priceMinor).toBe(194_300) // Heroic Helmet
    expect(new Set([at7?.id, at20?.id, at200?.id]).size).toBe(3)
  })

  it('выше самого дорогого NFT остаётся самый дорогой (Plush Pepe)', () => {
    expect(tileGiftFor(99_999_999, 'a')?.priceMinor).toBe(6_720_000)
  })

  it('если цена совпала с поставленным NFT — берётся именно он', () => {
    const staked = giftById.get('chill_flame-2')!
    expect(tileGiftFor(staked.priceMinor, 'x', staked)?.id).toBe('chill_flame-2')
  })

  it('детерминирован: один и тот же seed — одна и та же картинка', () => {
    expect(tileGiftFor(30_000, 'player-1')?.id).toBe(tileGiftFor(30_000, 'player-1')?.id)
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
