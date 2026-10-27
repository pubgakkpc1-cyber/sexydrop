import { beforeEach, describe, expect, it } from 'vitest'
import { useWalletStore } from './wallet'

const getState = () => useWalletStore.getState()

beforeEach(() => {
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
})

describe('wallet store', () => {
  it('стартует в demo с демо-балансом 100 GRAM, real пуст', () => {
    expect(getState().mode).toBe('demo')
    expect(getState().getBalance()).toBe(100_000)
    expect(getState().getBalance('real')).toBe(0)
  })

  it('жёстко разделяет demo и real балансы', () => {
    getState().setMode('real')
    getState().credit(5_000)
    expect(getState().getBalance('real')).toBe(5_000)
    expect(getState().getBalance('demo')).toBe(100_000)

    getState().setMode('demo')
    getState().debit(2_500)
    expect(getState().getBalance('demo')).toBe(97_500)
    expect(getState().getBalance('real')).toBe(5_000)
  })

  it('по умолчанию операции идут в активный режим', () => {
    getState().credit(1_111)
    expect(getState().getBalance('demo')).toBe(101_111)
    getState().debit(111)
    expect(getState().getBalance('demo')).toBe(101_000)
    expect(getState().getBalance('real')).toBe(0)
  })

  it('явный режим операции не зависит от активного', () => {
    getState().credit(4_000, 'real')
    expect(getState().getBalance('real')).toBe(4_000)
    expect(getState().getBalance('demo')).toBe(100_000)
  })

  it('дебит без овердрафта: ошибка и неизменный баланс', () => {
    expect(() => getState().debit(100_001)).toThrow(/Insufficient funds/)
    expect(getState().getBalance('demo')).toBe(100_000)
  })

  it('отвергает нецелые и NaN суммы', () => {
    expect(() => getState().credit(10.5)).toThrow()
    expect(() => getState().debit(Number.NaN)).toThrow()
  })

  it('resetDemo возвращает только демо-баланс к стартовому', () => {
    getState().debit(30_000)
    getState().credit(7_777, 'real')
    getState().resetDemo()
    expect(getState().getBalance('demo')).toBe(100_000)
    expect(getState().getBalance('real')).toBe(7_777)
  })
})
