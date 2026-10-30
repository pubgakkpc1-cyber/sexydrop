import { beforeEach, describe, expect, it } from 'vitest'
import {
  _resetCraftForTests,
  _setCraftRngForTests,
  craft,
  craftCandidates,
} from './demoCraftService'
import { useInventoryStore, type InventoryItem } from '../store/inventory'
import { useWalletStore } from '../store/wallet'
import { useGamesHistoryStore } from '../store/gamesHistory'

function seed(items: { uid: string; giftId: string }[]): InventoryItem[] {
  const seeded: InventoryItem[] = items.map((item) => ({
    uid: item.uid,
    giftId: item.giftId,
    acquiredAt: 0,
    source: 'case-open' as const,
  }))
  useInventoryStore.setState({ items: seeded, history: [] })
  return seeded
}

beforeEach(() => {
  _resetCraftForTests()
  _setCraftRngForTests(Math.random)
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useInventoryStore.setState({ items: [], history: [] })
  useGamesHistoryStore.setState({ entries: [] })
})

describe('demoCraftService (4.5: EV = 0.98·S, цели формулой)', () => {
  it('кандидаты: только предметы дороже 0.98·S, по возрастанию, максимум 8', () => {
    // S = 300 (chill-flame): порог 294 → цели от 300 (chill-flame включительно,
    // поскольку строго дороже 0.98·S=294); от 300 и выше, максимум 8 позиций.
    const candidates = craftCandidates(300)
    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates.length).toBeLessThanOrEqual(8)
    for (const candidate of candidates) {
      expect(candidate.priceMinor * 100).toBeGreaterThan(98 * 300)
      expect(candidate.chance).toBeCloseTo((0.98 * 300) / candidate.priceMinor, 12)
      expect(candidate.chance).toBeLessThanOrEqual(1)
    }
    const prices = candidates.map((c) => c.priceMinor)
    expect([...prices].sort((a, b) => a - b)).toEqual(prices)

    // S = 0: порог 0 — все предметы qualify? 0.98·0 = 0, v > 0 — да.
    expect(craftCandidates(0).length).toBeGreaterThan(0)
  })

  it('тождество EV: (1/|C|)·Σ p_i·v_i = 0.98·S ровно', () => {
    for (const S of [100, 300, 3500, 60_000]) {
      const candidates = craftCandidates(S)
      expect(candidates.length).toBeGreaterThan(0)
      const mean = candidates.reduce((sum, c) => sum + c.chance * c.priceMinor, 0) / candidates.length
      expect(mean).toBeCloseTo(0.98 * S, 9)
    }
  })

  it('мало предметов или дубликаты отклоняются', () => {
    seed([
      { uid: 'a', giftId: 'fresh-socks' },
      { uid: 'b', giftId: 'scared-cat' },
    ])
    expect(craft(['a'], 'req-1')).toEqual({ status: 'rejected', reason: 'too_few_items' })
    expect(craft(['a', 'a'], 'req-2')).toEqual({ status: 'rejected', reason: 'too_few_items' })
    expect(craft(['a', 'ghost'], 'req-3')).toEqual({
      status: 'rejected',
      reason: 'unknown_item',
    })
    expect(useGamesHistoryStore.getState().entries).toHaveLength(0)
  })

  it('нет кандидатов — честный отказ (S дороже всего каталога)', () => {
    // Входные предметы дороже любого предмета в каталоге (Plush Pepe 6720 TON x 2)
    seed([
      { uid: 'a', giftId: 'plush_pepe-1' },
      { uid: 'b', giftId: 'plush_pepe-2' },
    ])
    expect(craft(['a', 'b'], 'req-1')).toEqual({
      status: 'rejected',
      reason: 'no_candidates',
    })
    expect(useInventoryStore.getState().items).toHaveLength(2)
  })

  it('выигрыш: входные предметы сгорают, зачисляется цель, история записана', () => {
    _setCraftRngForTests(() => 0.01)
    // S = 50 + 150 = 200 → порог 196: цели от 200 (instant-ramen 200, p = 98/200? нет: 0.98·200/200 = 0.98)
    seed([
      { uid: 'a', giftId: 'fresh-socks' },
      { uid: 'b', giftId: 'scared-cat' },
    ])
    const result = craft(['a', 'b'], 'req-1')
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.inputsMinor).toBe(200)
    expect(result.targetGiftId).toBe('instant-ramen') // первый кандидат
    expect(result.won).toBe(true) // p = 0.98, u = 0.01

    const { items, history } = useInventoryStore.getState()
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ giftId: 'instant-ramen', source: 'craft' })
    expect(history[0]).toMatchObject({ type: 'acquire', detail: 'craft' })
    expect(history[1]).toMatchObject({ type: 'remove', detail: 'craft-bet' })

    const entries = useGamesHistoryStore.getState().entries
    expect(entries[0]).toMatchObject({ game: 'Крафт', outcome: 'won', deltaMinor: 0 })
  })

  it('проигрыш: все входные предметы сгорают', () => {
    _setCraftRngForTests(() => 0.99)
    seed([
      { uid: 'a', giftId: 'fresh-socks' }, // 50
      { uid: 'b', giftId: 'scared-cat' }, // 150 → S = 200; цель №8 (0.99) — cyber-helmet 3500: p = 0.056 → u = 0.99 мимо
    ])
    const result = craft(['a', 'b'], 'req-1')
    expect(result).toMatchObject({ status: 'ok', won: false })
    expect(useInventoryStore.getState().items).toHaveLength(0)
    const entries = useGamesHistoryStore.getState().entries
    expect(entries[0]).toMatchObject({ game: 'Крафт', outcome: 'lost', deltaMinor: -200 })
  })

  it('идемпотентность: повтор запроса не делает второй крафт', () => {
    _setCraftRngForTests(() => 0.01)
    seed([
      { uid: 'a', giftId: 'fresh-socks' },
      { uid: 'b', giftId: 'scared-cat' },
    ])
    const first = craft(['a', 'b'], 'req-same')
    const second = craft(['a', 'b'], 'req-same')
    expect(second).toEqual(first)
    expect(useInventoryStore.getState().items).toHaveLength(1)
  })
})
