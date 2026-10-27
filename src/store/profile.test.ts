import { beforeEach, describe, expect, it } from 'vitest'
import { useProfileStore } from './profile'
import { useTicketsStore, TICKET_STEP_MINOR, TICKET_VALUE_MINOR } from './tickets'
import { useQuestsStore, QUESTS } from './quests'
import { useWalletStore } from './wallet'
import { _resetDiceForTests, rollDice } from '../services/demoDiceService'

beforeEach(() => {
  _resetDiceForTests()
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useProfileStore.setState({ rounds: 0, wageredMinor: 0, netMinor: 0, pvpMatches: 0 })
  useTicketsStore.setState({ balance: 0, creditedWageredMinor: 0, accruedTickets: 0 })
  useQuestsStore.setState({ claimed: {} })
})

describe('store/tickets (6.3: начисление от реального оборота)', () => {
  it('начисление: 1 билет за каждые 2 GRAM оборота, водяной знак без двойного счёта', () => {
    expect(useTicketsStore.getState().accrueForWagered(1999)).toBe(0)
    expect(useTicketsStore.getState().balance).toBe(0)

    // пересёк 2000 → 1 билет
    expect(useTicketsStore.getState().accrueForWagered(2000)).toBe(1)
    expect(useTicketsStore.getState().balance).toBe(1)

    // повтор под тот же оборот не начисляет
    expect(useTicketsStore.getState().accrueForWagered(2000)).toBe(0)

    // 4000 оборота → второй билет; 4500 → всё ещё 2
    expect(useTicketsStore.getState().accrueForWagered(4500)).toBe(1)
    expect(useTicketsStore.getState().balance).toBe(2)
    expect(useTicketsStore.getState().accruedTickets).toBe(2)
  })

  it('spend/add: списание false при нехватке, целые проверки', () => {
    useTicketsStore.getState().add(150)
    expect(useTicketsStore.getState().spend(100)).toBe(true)
    expect(useTicketsStore.getState().balance).toBe(50)
    expect(useTicketsStore.getState().spend(51)).toBe(false)
    expect(useTicketsStore.getState().spend(0)).toBe(false)
    expect(useTicketsStore.getState().balance).toBe(50)
  })

  it('константы экономики: шаг 2 GRAM, ценность билета 0.025 GRAM → кэшбэк 1.25%', () => {
    expect(TICKET_STEP_MINOR).toBe(2000)
    expect(TICKET_VALUE_MINOR).toBe(25)
    // кэшбэк = (1/TICKET_STEP_MINOR)·TICKET_VALUE_MINOR = 25/2000 = 1.25% оборота
    expect((TICKET_VALUE_MINOR * 100) / TICKET_STEP_MINOR).toBe(1.25)
  })
})

describe('store/quests (6.2: прогресс из реальной статистики)', () => {
  it('прогресс считается из профиля; claim до цели запрещён', () => {
    const first = QUESTS[0]
    if (!first) throw new Error('QUESTS is empty')
    expect(useQuestsStore.getState().progressOf(first)).toBe(0)
    expect(useQuestsStore.getState().claim(first.id)).toBe('not_enough')

    // реальный раунд через сервис Дайса: проигрыш (stakeMinor учтён в обороте)
    rollDice(1000, 5099, 'over', 'q-1')
    expect(useQuestsStore.getState().progressOf(first)).toBe(1)
    expect(useQuestsStore.getState().claim(first.id)).toBe('ok')
    expect(useTicketsStore.getState().balance).toBe(first.rewardTickets)
    expect(useQuestsStore.getState().claim(first.id)).toBe('already_claimed')
    // повторный claim не начисляет
    expect(useTicketsStore.getState().balance).toBe(first.rewardTickets)
  })

  it('задание оборота: 10 GRAM оборота открывает награду', () => {
    const wagerQuest = QUESTS.find((q) => q.metric === 'wagered' && q.target === 10_000)
    if (!wagerQuest) throw new Error('wager quest missing')
    rollDice(5000, 5099, 'over', 'q-1')
    expect(useQuestsStore.getState().claim(wagerQuest.id)).toBe('not_enough')
    rollDice(5000, 5099, 'over', 'q-2')
    expect(useQuestsStore.getState().claim(wagerQuest.id)).toBe('ok')
    // 50 (задание) + 5 (кэшбэк за оборот 10000 minor: floor(10000/2000))
    expect(useTicketsStore.getState().balance).toBe(wagerQuest.rewardTickets + 5)
  })

  it('каталог заданий согласован: положительные цели и награды', () => {
    for (const quest of QUESTS) {
      expect(quest.target).toBeGreaterThan(0)
      expect(quest.rewardTickets).toBeGreaterThan(0)
      expect(QUESTS.filter((q) => q.id === quest.id)).toHaveLength(1)
    }
  })
})

describe('store/profile (6.1: кумулятивная статистика из реальных раундов)', () => {
  it('раунды, оборот и профит сходятся с реальными ставками через сервис', () => {
    rollDice(1000, 5099, 'over', 'p-1') // −1000 или +1000
    rollDice(500, 5099, 'over', 'p-2')
    const profile = useProfileStore.getState()
    expect(profile.rounds).toBe(2)
    expect(profile.wageredMinor).toBe(1500)
    expect(profile.netMinor).toBe(useWalletStore.getState().getBalance('demo') - 100_000)
  })
})
