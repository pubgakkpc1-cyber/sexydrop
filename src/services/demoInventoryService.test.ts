import { act } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { sellItem } from './demoInventoryService'
import { useInventoryStore } from '../store/inventory'
import { useWalletStore } from '../store/wallet'

const inv = () => useInventoryStore.getState()
const wallet = () => useWalletStore.getState()

beforeEach(() => {
  useInventoryStore.setState({ items: [], history: [] })
  useWalletStore.setState({ mode: 'demo', balances: { demo: 10_000, real: 0 } })
})

describe('demoInventoryService.sellItem (3.4)', () => {
  it('продаёт предмет: баланс вырос на каталог-цену, предмет удалён, история записана', () => {
    let uid = ''
    act(() => {
      const added = inv().addGifts(['plush-pepe'], 'case-open') // 25 GRAM
      uid = added[0]?.uid ?? ''
    })
    const result = sellItem(uid, 'req-sell-1')

    expect(result).toEqual({ status: 'ok', creditedMinor: 25_000, giftId: 'plush-pepe' })
    expect(wallet().getBalance('demo')).toBe(35_000)
    expect(inv().items).toHaveLength(0)
    expect(inv().history[0]).toMatchObject({ type: 'remove', detail: 'sold', uid })
  })

  it('идемпотентность: повтор того же clientRequestId не зачисляет дважды', () => {
    let uid = ''
    act(() => {
      const added = inv().addGifts(['astral-shard'], 'case-open') // 5 GRAM
      uid = added[0]?.uid ?? ''
    })
    const first = sellItem(uid, 'req-sell-2')
    const second = sellItem(uid, 'req-sell-2')

    expect(first).toEqual({ status: 'ok', creditedMinor: 5_000, giftId: 'astral-shard' })
    expect(second).toEqual(first)
    expect(wallet().getBalance('demo')).toBe(15_000)
    expect(inv().history.filter((event) => event.type === 'remove')).toHaveLength(1)
  })

  it('неизвестный uid: not_found без каких-либо изменений', () => {
    const result = sellItem('no-such-uid', 'req-sell-3')
    expect(result).toEqual({ status: 'not_found' })
    expect(wallet().getBalance('demo')).toBe(10_000)
    expect(inv().items).toHaveLength(0)
    expect(inv().history).toHaveLength(0)
  })

  it('новый запрос по уже проданному предмету не зачисляет повторно', () => {
    let uid = ''
    act(() => {
      const added = inv().addGifts(['fresh-socks'], 'case-open')
      uid = added[0]?.uid ?? ''
    })
    expect(sellItem(uid, 'req-sell-4a').status).toBe('ok')
    expect(sellItem(uid, 'req-sell-4b')).toEqual({ status: 'not_found' })
    expect(wallet().getBalance('demo')).toBe(10_050) // только одна продажа
  })
})
