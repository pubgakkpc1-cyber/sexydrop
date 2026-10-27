import { beforeEach, describe, expect, it } from 'vitest'
import {
  _resetDiceForTests,
  _setDiceRngForTests,
  rollDice,
} from './demoDiceService'
import { useWalletStore } from '../store/wallet'
import { useGamesHistoryStore } from '../store/gamesHistory'

beforeEach(() => {
  _resetDiceForTests()
  _setDiceRngForTests(Math.random)
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useGamesHistoryStore.setState({ entries: [] })
})

describe('demoDiceService (4.7: ролл, выплата, идемпотентность)', () => {
  it('выигрыш: дебет, ролл из rng, выплата floor(bet × m4/10^4), кредит', () => {
    // u = 0.51 → ролл 5100 > 5099 (p = 0.49, x2.00)
    _setDiceRngForTests(() => 0.51)
    const result = rollDice(1000, 5099, 'over', 'req-1')
    expect(result).toEqual({
      status: 'ok',
      roll: 5100,
      won: true,
      multiplierScaled4: 20_000,
      winMinor: 2000,
      betMinor: 1000,
    })
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000 - 1000 + 2000)
  })

  it('проигрыш: ровно X — не выигрыш; выплата 0', () => {
    _setDiceRngForTests(() => 0.5099) // ролл 5099 — не больше 5099
    const result = rollDice(1000, 5099, 'over', 'req-1')
    expect(result).toMatchObject({ status: 'ok', roll: 5099, won: false, winMinor: 0 })
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)
  })

  it('under: ролл строго меньше цели выигрывает', () => {
    _setDiceRngForTests(() => 0.1234) // ролл 1234 < 4900
    const result = rollDice(500, 4900, 'under', 'req-1')
    expect(result).toMatchObject({ status: 'ok', roll: 1234, won: true })
    // m4 = floor(98e6/4900) = 20000 → выплата floor(500×2) = 1000
    expect(result.status === 'ok' && result.winMinor).toBe(1000)
  })

  it('отказы: сумма, цель, направление, нехватка средств — без списаний', () => {
    expect(rollDice(0, 5099, 'over', 'req-1')).toEqual({
      status: 'rejected',
      reason: 'invalid_amount',
    })
    expect(rollDice(1000, 9900, 'over', 'req-2')).toEqual({
      status: 'rejected',
      reason: 'invalid_target',
    })
    expect(rollDice(1000, 5099, 'exactly' as 'over', 'req-3')).toEqual({
      status: 'rejected',
      reason: 'invalid_direction',
    })
    expect(rollDice(100_001, 5099, 'over', 'req-4')).toEqual({
      status: 'rejected',
      reason: 'insufficient_funds',
    })
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000)
    expect(useGamesHistoryStore.getState().entries).toHaveLength(0)
  })

  it('идемпотентность: повтор запроса не делает второй ролл', () => {
    _setDiceRngForTests(() => 0.51)
    const first = rollDice(1000, 5099, 'over', 'req-same')
    const second = rollDice(1000, 5099, 'over', 'req-same')
    expect(second).toEqual(first)
    expect(useWalletStore.getState().getBalance('demo')).toBe(101_000)
    expect(useGamesHistoryStore.getState().entries).toHaveLength(1)
  })

  it('история ставок: запись с роллом и множителем, дельта со знаком', () => {
    _setDiceRngForTests(() => 0.51)
    rollDice(1000, 5099, 'over', 'req-1')
    const entries = useGamesHistoryStore.getState().entries
    expect(entries[0]).toMatchObject({
      game: 'Дайс',
      stakeLabel: '1 TON',
      outcome: 'won',
      deltaMinor: 1000,
      detail: 'ролл 5100 · 2.00',
    })
  })
})
