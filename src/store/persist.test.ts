import { describe, expect, it } from 'vitest'
import { useWalletStore } from './wallet'
import { useInventoryStore } from './inventory'
import { useStarsBalanceStore } from './starsBalance'

function saved(key: string): { state: Record<string, unknown> } | null {
  const raw = window.localStorage.getItem(key)
  return raw ? (JSON.parse(raw) as { state: Record<string, unknown> }) : null
}

describe('сохранение состояния между запусками (localStorage)', () => {
  it('баланс сохраняется при изменении', () => {
    useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
    useWalletStore.getState().credit(2_500)
    expect(saved('sexydrop.wallet')?.state.balances).toEqual({ demo: 102_500, real: 0 })
  })

  it('подарки инвентаря сохраняются, а проданные пропадают из сохранённого', () => {
    useInventoryStore.setState({ items: [], history: [] })
    const [item] = useInventoryStore.getState().addGifts(['plush_pepe-1'], 'case-open')
    expect((saved('sexydrop.inventory')?.state.items as unknown[]).length).toBe(1)
    useInventoryStore.getState().removeUids([item!.uid], 'sell')
    expect((saved('sexydrop.inventory')?.state.items as unknown[]).length).toBe(0)
  })

  it('звёзды сохраняются', () => {
    useStarsBalanceStore.setState({ stars: 0 })
    useStarsBalanceStore.getState().add(50)
    expect(saved('sexydrop.stars')?.state.stars).toBe(50)
  })
})
