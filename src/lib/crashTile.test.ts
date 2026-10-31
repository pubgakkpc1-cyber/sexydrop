import { describe, expect, it } from 'vitest'
import { giftById } from '../data/catalog'
import { nftPriceFor, tileGiftFor } from './crashTile'
import { MULT_TIER_STYLE, multTier } from './multTier'

describe('tileGiftFor (плитка ставки Ракеты)', () => {
  it('ниже самого дешёвого NFT (5 TON) — значок NFT не показывается, рисуется TON', () => {
    expect(tileGiftFor(4_999, 'a')).toBeUndefined()
    expect(tileGiftFor(0, 'a')).toBeUndefined()
  })

  it('берёт самый дорогой NFT не дороже выплаты и меняется по мере роста', () => {
    const snoop = giftById.get('snoop_dogg-1')!.priceMinor
    const helmet = giftById.get('heroic_helmet-1')!.priceMinor
    const pepe = giftById.get('plush_pepe-1')!.priceMinor
    expect(tileGiftFor(snoop, 'a')?.priceMinor).toBe(snoop)
    expect(tileGiftFor(snoop + 1, 'a')?.priceMinor).toBe(snoop)
    expect(tileGiftFor(helmet, 'a')?.priceMinor).toBe(helmet)
    expect(tileGiftFor(99_999_999, 'a')?.priceMinor).toBe(pepe)
  })

  it('nftPriceFor — та же цена, по которой сервис платит NFT, остаток уходит в TON', () => {
    expect(nftPriceFor(4_999)).toBeUndefined()
    const snoop = giftById.get('snoop_dogg-1')!.priceMinor
    expect(nftPriceFor(snoop + 450)).toBe(snoop)
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
