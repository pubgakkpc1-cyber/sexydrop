import { beforeEach, describe, expect, it } from 'vitest'
import {
  _resetRaffleForTests,
  _setRaffleRngForTests,
  drawRaffle,
  raffleRecentDraws,
} from './demoRaffleService'
import { useTicketsStore } from '../store/tickets'
import { useInventoryStore } from '../store/inventory'

beforeEach(() => {
  _resetRaffleForTests()
  useTicketsStore.setState({ balance: 0, creditedWageredMinor: 0, accruedTickets: 0 })
  useInventoryStore.setState({ items: [], history: [] })
})

describe('demoRaffleService (6.4: тираж за билеты, приз в инвентарь)', () => {
  it('выигрышный тираж: списание 100 билетов, приз в инвентарь, запись последних', () => {
    useTicketsStore.getState().add(150)
    _setRaffleRngForTests(() => 0.0001) // golden-pepe (w=20 из 10000)
    const result = drawRaffle('r-1')
    expect(result).toEqual({
      status: 'ok',
      prizeGiftId: 'golden-pepe',
      prizeMinor: 200_000,
      ticketsSpent: 100,
    })
    expect(useTicketsStore.getState().balance).toBe(50)
    const items = useInventoryStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0]?.giftId).toBe('golden-pepe')
    expect(items[0]?.source).toBe('raffle')
    expect(raffleRecentDraws()[0]).toMatchObject({ prizeGiftId: 'golden-pepe' })
  })

  it('пустой исход: билеты списаны, приза нет, запись честная', () => {
    useTicketsStore.getState().add(100)
    _setRaffleRngForTests(() => 0.9) // ticket 9000 ≥ 7670 → пусто
    const result = drawRaffle('r-1')
    expect(result).toMatchObject({ status: 'ok', prizeGiftId: null, prizeMinor: 0 })
    expect(useTicketsStore.getState().balance).toBe(0)
    expect(useInventoryStore.getState().items).toHaveLength(0)
    expect(raffleRecentDraws()[0]).toMatchObject({ prizeGiftId: null })
  })

  it('отказ при нехватке билетов: списаний и записей нет', () => {
    useTicketsStore.setState({ balance: 99, creditedWageredMinor: 0, accruedTickets: 0 })
    expect(drawRaffle('r-1')).toEqual({ status: 'rejected', reason: 'not_enough_tickets' })
    expect(useInventoryStore.getState().items).toHaveLength(0)
    expect(raffleRecentDraws()).toHaveLength(0)
  })

  it('идемпотентность: повтор запроса не тратит билеты дважды', () => {
    useTicketsStore.getState().add(100)
    _setRaffleRngForTests(() => 0.5)
    const first = drawRaffle('r-same')
    const second = drawRaffle('r-same')
    expect(second).toEqual(first)
    expect(useTicketsStore.getState().balance).toBe(0)
    expect(useInventoryStore.getState().items).toHaveLength(1)
    expect(raffleRecentDraws()).toHaveLength(1)
  })
})
