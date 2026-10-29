import { beforeEach, describe, expect, it } from 'vitest'
import { caseById, giftById } from '../data/catalog'
import { claimFreeCase, openCase } from './demoCaseService'
import { useFreeCasesStore } from '../store/freeCases'
import { useInventoryStore } from '../store/inventory'
import { useWalletStore } from '../store/wallet'

/** Детерминированный rng: всегда выбирает первый исход. */
const rngFirst = () => 0
/** Всегда выбирает последний исход. */
const rngLast = () => 0.9999999

const resetAll = () => {
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useInventoryStore.setState({ items: [], history: [] })
  useFreeCasesStore.setState({ lastClaimAt: { free: 0, free24: 0 } })
}

beforeEach(resetAll)

describe('demoCaseService: openCase', () => {
  it('списывает цену кейса и начисляет предмет из его содержимого', () => {
    const elite = caseById.get('elite')
    if (!elite) throw new Error('no elite case')
    // Elite стоит 125 GRAM — пополняем демо-баланс до достаточного
    useWalletStore.getState().credit(50_000, 'demo')

    const result = openCase('elite', 'req-1', rngLast)
    if (result.status !== 'ok') throw new Error('expected ok')

    expect(result.giftId).toBe(elite.entries[elite.entries.length - 1]?.itemId)
    expect(giftById.has(result.giftId)).toBe(true)
    expect(useWalletStore.getState().getBalance('demo')).toBe(150_000 - elite.priceMinor)
    expect(useInventoryStore.getState().items).toHaveLength(1)
    expect(useInventoryStore.getState().items[0]?.giftId).toBe(result.giftId)
  })

  it('идемпотентно: повтор того же client_request_id не списывает дважды', () => {
    const first = openCase('farm', 'req-dup', rngFirst)
    const second = openCase('farm', 'req-dup', rngFirst)
    expect(second).toEqual(first)
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000 - 100)
    expect(useInventoryStore.getState().items).toHaveLength(1)
  })

  it('разные client_request_id — независимые операции', () => {
    openCase('farm', 'req-a', rngFirst)
    openCase('farm', 'req-b', rngFirst)
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000 - 200)
    expect(useInventoryStore.getState().items).toHaveLength(2)
  })

  it('отказ при нехватке средств: баланс и инвентарь не трогаются', () => {
    const result = openCase('elite', 'req-poor', rngFirst)
    expect(result).toEqual({ status: 'insufficient_funds' })
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000)
    expect(useInventoryStore.getState().items).toHaveLength(0)
  })

  it('выдаёт детерминированный результат для фиксированного rng', () => {
    const a = openCase('snoop', 'req-r1', rngFirst)
    const b = openCase('snoop', 'req-r2', rngFirst)
    if (a.status !== 'ok' || b.status !== 'ok') throw new Error('expected ok')
    expect(a.giftId).toBe(b.giftId)
  })

  it('бросает ошибку для бесплатного кейса и неизвестного id', () => {
    expect(() => openCase('free', 'req-x', rngFirst)).toThrow()
    expect(() => openCase('nope', 'req-y', rngFirst)).toThrow()
  })
})

describe('demoCaseService: claimFreeCase', () => {
  it('выдаёт бесплатный кейс и фиксирует кулдаун', () => {
    const now = 1_700_000_000_000
    const result = claimFreeCase('free', 'req-f1', now, rngFirst)
    if (result.status !== 'ok') throw new Error('expected ok')
    expect(useInventoryStore.getState().items).toHaveLength(1)
    expect(useFreeCasesStore.getState().lastClaimAt.free).toBe(now)
    // списаний нет
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000)
  })

  it('повторное получение внутри кулдауна отклоняется', () => {
    const now = 1_700_000_000_000
    expect(claimFreeCase('free', 'req-f2', now, rngFirst).status).toBe('ok')
    const second = claimFreeCase('free', 'req-f3', now + 1000, rngFirst)
    expect(second.status).toBe('cooldown')
    expect(useInventoryStore.getState().items).toHaveLength(1)
  })

  it('после истечения кулдауна выдача снова работает', () => {
    const now = 1_700_000_000_000
    const first = claimFreeCase('free', 'req-f4', now, rngFirst)
    expect(first.status).toBe('ok')
    // После 23:00 МСК (следующий день)
    const later = now + 24 * 60 * 60 * 1000 + 1000
    expect(claimFreeCase('free', 'req-f5', later, rngFirst).status).toBe('ok')
    expect(useInventoryStore.getState().items).toHaveLength(2)
  })

  it('FREE 24 и FREE имеют независимые кулдауны', () => {
    const now = 1_700_000_000_000
    expect(claimFreeCase('free', 'req-f6', now, rngFirst).status).toBe('ok')
    expect(claimFreeCase('free24', 'req-f7', now, rngFirst).status).toBe('ok')
  })

  it('идемпотентно по client_request_id', () => {
    const now = 1_700_000_000_000
    const first = claimFreeCase('free', 'req-f8', now, rngFirst)
    const second = claimFreeCase('free', 'req-f8', now + 1000, rngFirst)
    expect(second).toEqual(first)
    expect(useInventoryStore.getState().items).toHaveLength(1)
  })
})
