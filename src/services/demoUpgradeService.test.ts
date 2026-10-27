import { beforeEach, describe, expect, it } from 'vitest'
import {
  _resetUpgradeForTests,
  _setUpgradeRngForTests,
  placeUpgrade,
  upgradeChance,
} from './demoUpgradeService'
import { useInventoryStore, type InventoryItem } from '../store/inventory'
import { useWalletStore } from '../store/wallet'
import { useGamesHistoryStore } from '../store/gamesHistory'

function seedItems(count: number, giftId = 'fresh-socks'): InventoryItem[] {
  const items: InventoryItem[] = Array.from({ length: count }, (_, i) => ({
    uid: `seed-${i}`,
    giftId,
    acquiredAt: 0,
    source: 'case-open' as const,
  }))
  useInventoryStore.setState({ items, history: [] })
  return items
}

function seedOne(giftId: string): InventoryItem {
  const item = seedItems(1, giftId)[0]
  if (!item) throw new Error('seed failed')
  return item
}

beforeEach(() => {
  _resetUpgradeForTests()
  _setUpgradeRngForTests(Math.random)
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useInventoryStore.setState({ items: [], history: [] })
  useGamesHistoryStore.setState({ entries: [] })
})

describe('demoUpgradeService (4.4: шанс формулой, идемпотентность)', () => {
  it('шанс: p = min(1, s/t × 0.98)', () => {
    // fresh-socks 50 → magic-potion 1500: (50/1500)·0.98 ≈ 0.0327
    expect(upgradeChance(50, 1500)).toBeCloseTo((50 / 1500) * 0.98, 12)
    // Цель дешевле источника: chance cap = 1 (EV = t ≤ 0.98·s — казна в плюсе)
    expect(upgradeChance(1500, 50)).toBe(1)
    expect(upgradeChance(1000, 1000)).toBe(0.98)
    expect(upgradeChance(0, 1000)).toBe(0)
  })

  it('детерминированный выигрыш: u < p → цель зачислена, вход сгорел', () => {
    _setUpgradeRngForTests(() => 0.1)
    const item = seedOne('scared-cat') // 150 → instant-ramen 200: p = 0.735
    const result = placeUpgrade(item.uid, 'instant-ramen', 'req-1')
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.won).toBe(true)
    expect(result.chance).toBeCloseTo(0.735, 12)

    const { items, history } = useInventoryStore.getState()
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ giftId: 'instant-ramen', source: 'upgrade' })
    expect(history[0]).toMatchObject({ type: 'acquire', detail: 'upgrade' })
    expect(history[1]).toMatchObject({ type: 'remove', detail: 'upgrade-bet' })

    const entries = useGamesHistoryStore.getState().entries
    expect(entries[0]).toMatchObject({
      game: 'Апгрейд',
      outcome: 'won',
      deltaMinor: 200 - 150,
      stakeLabel: 'Scared Cat',
    })
  })

  it('детерминированный проигрыш: предмет сгорает без компенсации', () => {
    _setUpgradeRngForTests(() => 0.5)
    const item = seedOne('fresh-socks') // 50 → heart-locket 1000: p = 0.049
    const result = placeUpgrade(item.uid, 'heart-locket', 'req-1')
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.won).toBe(false)
    expect(result.chance).toBeCloseTo(0.049, 12)
    expect(useInventoryStore.getState().items).toHaveLength(0)

    const entries = useGamesHistoryStore.getState().entries
    expect(entries[0]).toMatchObject({
      game: 'Апгрейд',
      outcome: 'lost',
      deltaMinor: -50,
      detail: 'шанс 4.9%',
    })
  })

  it('неизвестные предмет/цель отклоняются, ничего не списывается', () => {
    const item = seedOne('fresh-socks')
    expect(placeUpgrade('no-such-uid', 'heart-locket', 'req-1')).toEqual({
      status: 'rejected',
      reason: 'unknown_item',
    })
    expect(placeUpgrade(item.uid, 'no-such-gift', 'req-2')).toEqual({
      status: 'rejected',
      reason: 'unknown_target',
    })
    expect(useInventoryStore.getState().items).toHaveLength(1)
    expect(useGamesHistoryStore.getState().entries).toHaveLength(0)
  })

  it('идемпотентность: повтор запроса не делает вторую попытку', () => {
    _setUpgradeRngForTests(() => 0.1)
    const item = seedOne('scared-cat')
    const first = placeUpgrade(item.uid, 'instant-ramen', 'req-same')
    const second = placeUpgrade(item.uid, 'instant-ramen', 'req-same')
    expect(second).toEqual(first)
    expect(useInventoryStore.getState().items).toHaveLength(1)
  })
})
