import { describe, expect, it } from 'vitest'
import { LIVE_SLOT_MS, LIVE_VISIBLE, liveDropForSlot, liveFeed, msToNextSlot } from './liveFeed'

describe('liveFeed (общая лента дропов)', () => {
  it('дроп слота детерминирован: у всех одинаковый и стабильный', () => {
    const a = liveDropForSlot(1234567)
    const b = liveDropForSlot(1234567)
    expect(a.gift.id).toBe(b.gift.id)
    expect(a.caseId).toBe(b.caseId)
  })

  it('в один момент у всех одна и та же лента; новый дроп — со следующего слота', () => {
    const t = 1_700_000_000_000
    const feedA = liveFeed(t)
    const feedB = liveFeed(t + 500) // тот же слот
    expect(feedA.map((d) => d.slot)).toEqual(feedB.map((d) => d.slot))
    expect(feedA).toHaveLength(LIVE_VISIBLE)
    const next = liveFeed(t + msToNextSlot(t) + 1)
    expect(next[0]!.slot).toBe(feedA[0]!.slot + 1)
    // остальные дропы просто сдвинулись — история не меняется
    expect(next[1]!.gift.id).toBe(feedA[0]!.gift.id)
  })

  it('дроп берётся из реальных предметов кейса', () => {
    for (let slot = 1000; slot < 1060; slot += 1) {
      const d = liveDropForSlot(slot)
      expect(d.gift.priceMinor).toBeGreaterThan(0)
      expect(msToNextSlot(slot * LIVE_SLOT_MS + 10)).toBeLessThanOrEqual(LIVE_SLOT_MS)
    }
  })
})
