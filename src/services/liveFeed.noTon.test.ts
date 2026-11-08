import { describe, expect, it } from 'vitest'
import { isTonPrize } from '../data/catalog'
import { liveDropForSlot } from './liveFeed'

describe('лента Live', () => {
  it('не показывает выигрыши в TON — только NFT-подарки', () => {
    for (let slot = 1; slot < 3000; slot += 1) expect(isTonPrize(liveDropForSlot(slot).gift)).toBe(false)
  })
})
