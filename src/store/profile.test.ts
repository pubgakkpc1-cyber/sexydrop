import { beforeEach, describe, expect, it } from 'vitest'
import { useProfileStore } from './profile'
import { useQuestsStore, QUESTS } from './quests'
import { useWalletStore } from './wallet'
import { _resetDiceForTests, rollDice } from '../services/demoDiceService'

beforeEach(() => {
  _resetDiceForTests()
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useProfileStore.setState({ rounds: 0, wageredMinor: 0, netMinor: 0, pvpMatches: 0 })
  useQuestsStore.setState({ claimed: {} })
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
    const afterClaim = useWalletStore.getState().getBalance('demo')
    expect(useQuestsStore.getState().claim(first.id)).toBe('already_claimed')
    // повторный claim не начисляет
    expect(useWalletStore.getState().getBalance('demo')).toBe(afterClaim)
  })

  it('задание оборота: 10 GRAM оборота открывает награду', () => {
    const wagerQuest = QUESTS.find((q) => q.metric === 'wagered' && q.target === 10_000)
    if (!wagerQuest) throw new Error('wager quest missing')
    rollDice(5000, 5099, 'over', 'q-1')
    expect(useQuestsStore.getState().claim(wagerQuest.id)).toBe('not_enough')
    rollDice(5000, 5099, 'over', 'q-2')
    expect(useQuestsStore.getState().claim(wagerQuest.id)).toBe('ok')
    expect(useQuestsStore.getState().claimed[wagerQuest.id]).toBe(true)
  })

  it('каталог заданий согласован: положительные цели и награды', () => {
    for (const quest of QUESTS) {
      expect(quest.target).toBeGreaterThan(0)
      expect(quest.rewardMinor).toBeGreaterThan(0)
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
