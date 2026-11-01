import { beforeEach, describe, expect, it } from 'vitest'
import { caseById, giftById } from '../data/catalog'
import { claimFreeCase, openCase } from './demoCaseService'
import { useFreeCasesStore } from '../store/freeCases'
import { useInventoryStore } from '../store/inventory'
import { useWalletStore } from '../store/wallet'

/** Детерминированный rng: всегда выбирает первый исход. */
const rngFirst = () => 0.9999 // последний (самый дорогой) предмет — всегда NFT, не TON-приз
/** Всегда выбирает последний исход. */
const rngLast = () => 0.9999999

const resetAll = () => {
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useInventoryStore.setState({ items: [], history: [] })
  useFreeCasesStore.setState({ lastClaimAt: { free: 0, free24: 0 } })
  useFreeCasesStore.getState().clearQuestReward()
  useFreeCasesStore.getState().setPremiumTotal(0)
}

beforeEach(resetAll)

describe('demoCaseService: openCase', () => {
  it('списывает цену кейса и начисляет предмет из его содержимого', () => {
    const elite = caseById.get('elite')
    if (!elite) throw new Error('no elite case')
    // Elite стоит 300 TON — пополняем демо-баланс до достаточного
    useWalletStore.getState().credit(250_000, 'demo')

    const result = openCase('elite', 'req-1', rngLast)
    if (result.status !== 'ok') throw new Error('expected ok')

    expect(result.giftId).toBe(elite.entries[elite.entries.length - 1]?.itemId)
    expect(giftById.has(result.giftId)).toBe(true)
    expect(useWalletStore.getState().getBalance('demo')).toBe(350_000 - elite.priceMinor)
    expect(useInventoryStore.getState().items).toHaveLength(1)
    expect(useInventoryStore.getState().items[0]?.giftId).toBe(result.giftId)
  })

  it('идемпотентно: повтор того же client_request_id не списывает дважды', () => {
    const first = openCase('farm', 'req-dup', rngFirst)
    const second = openCase('farm', 'req-dup', rngFirst)
    expect(second).toEqual(first)
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000 - 6_000)
    expect(useInventoryStore.getState().items).toHaveLength(1)
  })

  it('разные client_request_id — независимые операции', () => {
    openCase('farm', 'req-a', rngFirst)
    openCase('farm', 'req-b', rngFirst)
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000 - 12_000)
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
  it('FREE 24: выдаёт NFT сразу и фиксирует кулдаун', () => {
    const now = 1_700_000_000_000
    const result = claimFreeCase('free24', 'req-f1', now, rngFirst)
    if (result.status !== 'ok') throw new Error('expected ok')
    expect(useInventoryStore.getState().items).toHaveLength(1)
    expect(useFreeCasesStore.getState().lastClaimAt.free24).toBe(now)
    // списаний нет
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000)
  })

  it('повторное получение внутри кулдауна отклоняется', () => {
    const now = 1_700_000_000_000
    expect(claimFreeCase('free24', 'req-f2', now, rngFirst).status).toBe('ok')
    const second = claimFreeCase('free24', 'req-f3', now + 1000, rngFirst)
    expect(second.status).toBe('cooldown')
    expect(useInventoryStore.getState().items).toHaveLength(1)
  })

  it('после истечения кулдауна выдача снова работает', () => {
    const now = 1_700_000_000_000
    expect(claimFreeCase('free24', 'req-f4', now, rngFirst).status).toBe('ok')
    // После 23:00 МСК (следующий день)
    const later = now + 24 * 60 * 60 * 1000 + 1000
    expect(claimFreeCase('free24', 'req-f5', later, rngFirst).status).toBe('ok')
    expect(useInventoryStore.getState().items).toHaveLength(2)
  })

  it('FREE 24 и FREE имеют независимые кулдауны', () => {
    const now = 1_700_000_000_000
    expect(claimFreeCase('free', 'req-f6', now, rngFirst).status).toBe('ok')
    expect(claimFreeCase('free24', 'req-f7', now, rngFirst).status).toBe('ok')
  })

  it('идемпотентно по client_request_id', () => {
    const now = 1_700_000_000_000
    const first = claimFreeCase('free24', 'req-f8', now, rngFirst)
    const second = claimFreeCase('free24', 'req-f8', now + 1000, rngFirst)
    expect(second).toEqual(first)
    expect(useInventoryStore.getState().items).toHaveLength(1)
  })

  it('обычный FREE: NFT не попадает в инвентарь, а ждёт 5 друзей с Premium', () => {
    const now = 1_700_000_000_000
    const result = claimFreeCase('free', 'req-q1', now, rngFirst)
    if (result.status !== 'ok') throw new Error('expected ok')
    expect(useInventoryStore.getState().items).toHaveLength(0)
    const quest = useFreeCasesStore.getState().quest
    expect(quest.pendingReward?.giftId).toBe(result.giftId)
    expect(quest.pendingReward?.expiresAt).toBe(now + 3 * 24 * 60 * 60 * 1000)
    expect(useFreeCasesStore.getState().isQuestCompleted()).toBe(false)
  })

  it('пока задание не выполнено, новый FREE открыть нельзя', () => {
    const now = 1_700_000_000_000
    expect(claimFreeCase('free', 'req-q2', now, rngFirst).status).toBe('ok')
    const next = claimFreeCase('free', 'req-q3', now + 25 * 60 * 60 * 1000, rngFirst)
    expect(next.status).toBe('cooldown')
  })

  it('засчитываются только друзья с Premium, пришедшие после выигрыша', () => {
    const store = useFreeCasesStore
    store.getState().setPremiumTotal(2) // двое уже были до выигрыша
    expect(claimFreeCase('free', 'req-q4', Date.now(), rngFirst).status).toBe('ok')
    store.getState().setPremiumTotal(6)
    expect(store.getState().quest.referralsJoined).toBe(4)
    expect(store.getState().isQuestCompleted()).toBe(false)
    store.getState().setPremiumTotal(7)
    expect(store.getState().quest.referralsJoined).toBe(5)
    expect(store.getState().isQuestCompleted()).toBe(true)
  })
})
