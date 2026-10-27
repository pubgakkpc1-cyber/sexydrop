import { beforeEach, describe, expect, it } from 'vitest'
import {
  _resetSpinsForTests,
  _setSpinsRngForTests,
  buyBonus,
  spinSpins,
} from './demoSpinsService'
import { useWalletStore } from '../store/wallet'
import { useGamesHistoryStore } from '../store/gamesHistory'

beforeEach(() => {
  _resetSpinsForTests()
  _setSpinsRngForTests(Math.random)
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useGamesHistoryStore.setState({ entries: [] })
})

describe('demoSpinsService (4.9: спин, бонус-спин M2, покупка бонуса)', () => {
  it('подарочный символ: выплата floor(ставка × m), дельта, история', () => {
    // u = 0.7 → r = 56 → chill-flame [54..72) (x0.43); ячейка floor(0.7·25) = 17
    _setSpinsRngForTests(() => 0.7)
    const result = spinSpins(1000, false, 'req-1')
    expect(result).toEqual({
      status: 'ok',
      kind: 'gift',
      symbolIndex: 8,
      winnerIndex: 17,
      multiplierHundredths: 43,
      payoutMinor: 430,
      betMinor: 1000,
    })
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000 - 1000 + 430)
    expect(useGamesHistoryStore.getState().entries[0]).toMatchObject({
      game: 'Спины',
      outcome: 'lost', // 430 < 1000 — нетто-минус
      deltaMinor: -570,
      detail: 'Chill Flame · x0.43',
    })
  })

  it('крупный подарок: plush-pepe x7.84 → чистый выигрыш', () => {
    // u = 0.001 → r = 0 → plush-pepe; ячейка 10
    const seq = [0.001, 0.4]
    _setSpinsRngForTests(() => seq.shift() ?? 0)
    const result = spinSpins(1000, false, 'req-1')
    expect(result).toMatchObject({
      status: 'ok',
      kind: 'gift',
      symbolIndex: 0,
      winnerIndex: 10,
      multiplierHundredths: 784,
      payoutMinor: 7840,
    })
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000 - 1000 + 7840)
    expect(useGamesHistoryStore.getState().entries[0]).toMatchObject({
      game: 'Спины',
      outcome: 'won',
      deltaMinor: 6840,
      detail: 'Plush Pepe · x7.84',
    })
  })

  it('бонус-символ: сам не платит; бесплатный спин M2 со ставкой bet', () => {
    // база: u = 0.95 → r = 76 → бонус; ячейка 12; M2: u = 0.5 → r = 36 → holiday-gift [27..39)
    const seq = [0.95, 0.5, 0.5]
    _setSpinsRngForTests(() => seq.shift() ?? 0)
    const result = spinSpins(1000, false, 'req-1')
    expect(result).toEqual({
      status: 'ok',
      kind: 'bonus',
      winnerIndex: 12,
      freeStakeMinor: 1000,
      bonusSymbolIndex: 6,
      bonusMultiplierHundredths: 65,
      bonusPayoutMinor: 650,
      betMinor: 1000,
    })
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000 - 1000 + 650)
    expect(useGamesHistoryStore.getState().entries[0]).toMatchObject({
      game: 'Спины',
      outcome: 'lost',
      deltaMinor: -350,
      detail: 'бонус · Holiday Gift x0.65',
    })
  })

  it('двойной шанс: множители по W=88, свободная ставка 0.55·bet', () => {
    // база: u = 0.95 → r = 83 → бонус (72..87); M2: u = 0.5 → holiday-gift x0.65
    const seq = [0.95, 0.5, 0.5]
    _setSpinsRngForTests(() => seq.shift() ?? 0)
    const result = spinSpins(1000, true, 'req-1')
    expect(result).toMatchObject({
      status: 'ok',
      kind: 'bonus',
      freeStakeMinor: 550,
      bonusSymbolIndex: 6,
      bonusMultiplierHundredths: 65,
      bonusPayoutMinor: 357, // floor(550 × 0.65)
    })
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000 - 1000 + 357)
  })

  it('покупка бонуса: цена ceil(E2num·bet/7056) = 997 за 1 GRAM', () => {
    // M2: u = 0.5 → holiday-gift x0.65 → выплата floor(1000×0.65) = 650
    _setSpinsRngForTests(() => 0.5)
    const result = buyBonus(1000, 'req-1')
    expect(result).toEqual({
      status: 'ok',
      kind: 'bonus-buy',
      priceMinor: 997,
      bonusSymbolIndex: 6,
      bonusMultiplierHundredths: 65,
      payoutMinor: 650,
    })
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000 - 997 + 650)
    expect(useGamesHistoryStore.getState().entries[0]).toMatchObject({
      game: 'Спины',
      stakeLabel: '0.997 TON',
      outcome: 'lost',
      deltaMinor: -347,
      detail: 'бонус куплен · Holiday Gift x0.65',
    })
  })

  it('отказы: сумма, нехватка средств — без списаний и истории', () => {
    expect(spinSpins(0, false, 'req-1')).toEqual({
      status: 'rejected',
      reason: 'invalid_amount',
    })
    expect(spinSpins(100_001, false, 'req-2')).toEqual({
      status: 'rejected',
      reason: 'insufficient_funds',
    })
    // цена покупки за 10k GRAM ≈ 9966 GRAM > баланс 100 GRAM
    expect(buyBonus(10_000_000, 'req-3')).toEqual({
      status: 'rejected',
      reason: 'insufficient_funds',
    })
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000)
    expect(useGamesHistoryStore.getState().entries).toHaveLength(0)
  })

  it('идемпотентность: повтор запроса не списывает и не крутит второй раз', () => {
    const seq = [0.001, 0.4]
    _setSpinsRngForTests(() => seq.shift() ?? 0)
    const first = spinSpins(1000, false, 'req-same')
    const second = spinSpins(1000, false, 'req-same')
    expect(second).toEqual(first)
    expect(useWalletStore.getState().getBalance('demo')).toBe(106_840)
    expect(useGamesHistoryStore.getState().entries).toHaveLength(1)
    expect(buyBonus(1000, 'buy-same').status).toBe('ok')
    const afterBuy = useWalletStore.getState().getBalance('demo')
    expect(buyBonus(1000, 'buy-same').status).toBe('ok')
    expect(useWalletStore.getState().getBalance('demo')).toBe(afterBuy)
    expect(useGamesHistoryStore.getState().entries).toHaveLength(2)
  })
})
