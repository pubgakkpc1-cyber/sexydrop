import { beforeEach, describe, expect, it } from 'vitest'
import { _resetPlinkoForTests, _setPlinkoRngForTests, dropPlinko } from './demoPlinkoService'
import { bucketMultiplier, plinkoMultipliers, type PlinkoRows } from '../lib/plinkoMath'
import { useWalletStore } from '../store/wallet'
import { useGamesHistoryStore } from '../store/gamesHistory'

beforeEach(() => {
  _resetPlinkoForTests()
  _setPlinkoRngForTests(Math.random)
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useGamesHistoryStore.setState({ entries: [] })
})

describe('demoPlinkoService (4.6: бросок, идемпотентность, выплата)', () => {
  it('бросок: дебет, путь из n монеток, выплата floor(bet × m_k)', () => {
    // Все монетки вправо → крайний карман k = n (минимальная вероятность, максимум множителя).
    _setPlinkoRngForTests(() => 0.9)
    const result = dropPlinko(1000, 8, 'req-1')
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.path).toEqual([1, 1, 1, 1, 1, 1, 1, 1])
    expect(result.bucket).toBe(8)
    expect(result.multiplier).toBe(plinkoMultipliers(8)[8])
    // Выплата по карману = floor(1000 × 0.39) — центральные карманы ниже 1;
    // для крайнего кармана m = 27.87 → floor(1000 × 27.87) = 27870
    expect(result.winMinor).toBe(27_870)
    const balance = useWalletStore.getState().getBalance('demo')
    expect(balance).toBe(100_000 - 1000 + 27_870)
  })

  it('все монетки влево → карман 0, тот же максимум', () => {
    _setPlinkoRngForTests(() => 0.1)
    const result = dropPlinko(100, 12, 'req-1')
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.path).toEqual(Array(12).fill(0))
    expect(result.bucket).toBe(0)
    expect(result.multiplier).toBe(308.77)
    expect(result.winMinor).toBe(Math.floor(100 * 308.77))
  })

  it('симметричный путь: монетки 0.5±ε дают центральные карманы', () => {
    // rng > 0.5 → вправо: путь [1,0,1,0,...] → k = 4 для n=8
    let flip = false
    _setPlinkoRngForTests(() => {
      flip = !flip
      return flip ? 0.9 : 0.1
    })
    const result = dropPlinko(500, 8, 'req-1')
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.bucket).toBe(4)
    expect(result.multiplier).toBe(bucketMultiplier(8, 4))
  })

  it('отказы: неверный ряд, сумма, недостаток средств', () => {
    expect(dropPlinko(1000, 10 as unknown as PlinkoRows, 'req-1')).toEqual({
      status: 'rejected',
      reason: 'invalid_rows',
    })
    expect(dropPlinko(0, 8, 'req-2')).toEqual({ status: 'rejected', reason: 'invalid_amount' })
    expect(dropPlinko(100_001, 8, 'req-3')).toEqual({
      status: 'rejected',
      reason: 'insufficient_funds',
    })
    expect(useGamesHistoryStore.getState().entries).toHaveLength(0)
  })

  it('идемпотентность: повтор запроса не бросает второй шар', () => {
    _setPlinkoRngForTests(() => 0.9)
    const first = dropPlinko(1000, 8, 'req-same')
    const second = dropPlinko(1000, 8, 'req-same')
    expect(second).toEqual(first)
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000 - 1000 + 27_870)
  })

  it('история ставок: выигравший карман — won, проигравший — lost с дельтой', () => {
    _setPlinkoRngForTests(() => 0.9) // крайний карман x27.87 → победа
    dropPlinko(1000, 8, 'req-1')
    let entries = useGamesHistoryStore.getState().entries
    expect(entries[0]).toMatchObject({
      game: 'Плинко',
      outcome: 'won',
      deltaMinor: 27_870 - 1000,
      stakeLabel: '1 TON',
    })

    _resetPlinkoForTests()
    useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
    _setPlinkoRngForTests(() => 0.9)
    // n=12, крайний x308.77 тоже победа; возьмём центральный через чередование
    let flip = false
    _setPlinkoRngForTests(() => {
      flip = !flip
      return flip ? 0.9 : 0.1
    })
    dropPlinko(1000, 8, 'req-2') // k=4: x0.39 → выплата 390 < 1000 → lost
    entries = useGamesHistoryStore.getState().entries
    expect(entries[0]).toMatchObject({ game: 'Плинко', outcome: 'lost', deltaMinor: 390 - 1000 })
  })
})
