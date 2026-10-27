import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RewardsScreen } from './RewardsScreen'
import { useTicketsStore } from '../store/tickets'
import { useProfileStore } from '../store/profile'
import { useQuestsStore } from '../store/quests'
import { useWalletStore } from '../store/wallet'
import { useInventoryStore } from '../store/inventory'
import { useGamesHistoryStore } from '../store/gamesHistory'
import { usePvpMatchesStore } from '../store/pvpMatches'
import { _resetRaffleForTests, _setRaffleRngForTests } from '../services/demoRaffleService'
import { giftById } from '../data/catalog'

const user = userEvent.setup()

beforeEach(() => {
  _resetRaffleForTests()
  _setRaffleRngForTests(Math.random)
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useProfileStore.setState({ rounds: 0, wageredMinor: 0, netMinor: 0, pvpMatches: 0 })
  useTicketsStore.setState({ balance: 0, creditedWageredMinor: 0, accruedTickets: 0 })
  useQuestsStore.setState({ claimed: {} })
  useInventoryStore.setState({ items: [], history: [] })
  useGamesHistoryStore.setState({ entries: [] })
  usePvpMatchesStore.setState({ entries: [] })
})

afterEach(() => {
  _resetRaffleForTests()
  vi.restoreAllMocks()
})

describe('RewardsScreen (6.2–6.4: задания, билеты, розыгрыш)', () => {
  it('шапка, секции и раскрытая экономика (кэшбэк 1.25%, EV = 2.5 TON, TIER 7)', () => {
    render(<RewardsScreen />)
    expect(screen.getByText('Награды')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Билеты' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Задания' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Розыгрыш' })).toBeInTheDocument()
    expect(screen.getByTestId('tickets')).toHaveTextContent('0')
    expect(screen.getByText(/кэшбэк 1\.25% от оборота/)).toBeInTheDocument()
    expect(screen.getByText(/EV тиража = 2\.5 TON/)).toBeInTheDocument()
    expect(screen.getAllByText(/TIER 7/).length).toBeGreaterThan(0)
    // CTA розыгрыша заблокирован без билетов
    expect(screen.getByRole('button', { name: 'Крутить розыгрыш · 100 билетов' })).toBeDisabled()
  })

  it('обмен билетов: 100 → 2.5 TON credited, кнопки без нужного количества disabled', async () => {
    useTicketsStore.setState({ balance: 150, creditedWageredMinor: 0, accruedTickets: 0 })
    render(<RewardsScreen />)

    expect(
      screen.getByRole('button', { name: '400 билетов → 10 TON' }),
    ).toBeDisabled()
    const hundred = screen.getByRole('button', { name: '100 билетов → 2.5 TON' })
    expect(hundred).toBeEnabled()
    await user.click(hundred)

    expect(useTicketsStore.getState().balance).toBe(50)
    expect(useWalletStore.getState().getBalance('demo')).toBe(102_500)
    expect(screen.getByTestId('raffle-result')).toHaveTextContent(
      'Обмен 100 билетов → 2.5 TON',
    )
  })

  it('задание: прогресс из профиля, claim начисляет билеты один раз', async () => {
    useProfileStore.setState({ rounds: 1, wageredMinor: 0, netMinor: 0, pvpMatches: 0 })
    render(<RewardsScreen />)

    const claimButton = screen.getByRole('button', { name: 'Забрать' })
    expect(claimButton).toBeEnabled() // только «Первый раунд» (1/1)
    await user.click(claimButton)

    expect(useTicketsStore.getState().balance).toBe(10)
    expect(screen.getByText('Забрано')).toBeInTheDocument()
    // остальные задания закрыты: кнопки показывают «—» и disabled
    expect(screen.getAllByRole('button', { name: '—' }).length).toBe(5)
  })

  it('выигрышный тираж: билеты списаны, приз в инвентарь source raffle, история', async () => {
    useTicketsStore.setState({ balance: 150, creditedWageredMinor: 0, accruedTickets: 0 })
    _setRaffleRngForTests(() => 0.0001) // golden-pepe (w=20)
    render(<RewardsScreen />)

    await user.click(screen.getByRole('button', { name: 'Крутить розыгрыш · 100 билетов' }))

    const pepeName = giftById.get('golden-pepe')?.name ?? 'golden-pepe'
    expect(screen.getByTestId('raffle-result')).toHaveTextContent(`Тираж: ${pepeName}`)
    const items = useInventoryStore.getState().items
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ giftId: 'golden-pepe', source: 'raffle' })
    expect(useTicketsStore.getState().balance).toBe(50)
    // история тиражей: цена приза
    expect(screen.getByText('200 TON')).toBeInTheDocument()
  })

  it('пустой тираж: честная строка, билеты списаны, приза нет', async () => {
    useTicketsStore.setState({ balance: 100, creditedWageredMinor: 0, accruedTickets: 0 })
    _setRaffleRngForTests(() => 0.9) // ticket 9000 ≥ 7670 → пусто
    render(<RewardsScreen />)

    await user.click(screen.getByRole('button', { name: 'Крутить розыгрыш · 100 билетов' }))
    expect(screen.getByTestId('raffle-result')).toHaveTextContent('Тираж: пусто')
    expect(useInventoryStore.getState().items).toHaveLength(0)
    expect(useTicketsStore.getState().balance).toBe(0)
  })

  it('шансы призов опубликованы (0.20% у golden-pepe, 23.30% пусто)', () => {
    render(<RewardsScreen />)
    expect(screen.getByText('0.20%')).toBeInTheDocument()
    expect(screen.getByText('23.30%')).toBeInTheDocument()
    expect(screen.getByText('Пусто')).toBeInTheDocument()
  })
})
