import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CraftScreen } from './CraftScreen'
import { useInventoryStore } from '../store/inventory'
import { useWalletStore } from '../store/wallet'
import { useGamesHistoryStore } from '../store/gamesHistory'
import { _resetCraftForTests, _setCraftRngForTests } from '../services/demoCraftService'

const user = userEvent.setup()

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/games/craft']}>
      <Routes>
        <Route path="/games/craft" element={<CraftScreen />} />
        <Route path="/" element={<div>Каталог кейсов</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  _resetCraftForTests()
  _setCraftRngForTests(Math.random)
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useInventoryStore.setState({ items: [], history: [] })
  useGamesHistoryStore.setState({ entries: [] })
})

afterEach(() => {
  _resetCraftForTests()
  vi.restoreAllMocks()
})

describe('CraftScreen (4.5: UI крафта)', () => {
  it('шапка: Назад, заголовок и честная заметка', () => {
    renderScreen()
    expect(screen.getByText('Крафт')).toBeInTheDocument()
    expect(screen.getByText(/Крафт: цели — предметы дороже/)).toBeInTheDocument()
  })

  it('пустой инвентарь: честное состояние и выключенная CTA', () => {
    renderScreen()
    expect(screen.getByText(/Инвентарь пуст/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Выберите минимум 2 предмета/ })).toBeDisabled()
  })

  it('мульти-выбор: сумма считается по предметам, кандидаты с шансами формулы', async () => {
    useInventoryStore.setState({
      items: [
        { uid: 'a', giftId: 'fresh-socks', acquiredAt: 0, source: 'case-open' }, // 50
        { uid: 'b', giftId: 'scared-cat', acquiredAt: 0, source: 'case-open' }, // 150
        { uid: 'c', giftId: 'instant-ramen', acquiredAt: 0, source: 'case-open' }, // 200
      ],
      history: [],
    })
    renderScreen()

    // Выбран один — CTA выключена
    await user.click(screen.getByRole('button', { name: /Fresh Socks/ }))
    expect(screen.getByRole('button', { name: /Выберите минимум 2 предмета/ })).toBeDisabled()

    // Выбраны два: S = 0.2 TON, цель instant-ramen 200 → p = 98%
    await user.click(screen.getByRole('button', { name: /Scared Cat/ }))
    expect(screen.getByText('0.2 TON')).toBeInTheDocument()
    expect(screen.getByText('98%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Крафт' })).toBeEnabled()
  })

  it('раунд: проигрыш сжигает вход, шит результата, журнал и история', async () => {
    _setCraftRngForTests(() => 0.99) // кандидатов 8: цель №8 (cyber-helmet), p = 0.056 → мимо
    useInventoryStore.setState({
      items: [
        { uid: 'a', giftId: 'fresh-socks', acquiredAt: 0, source: 'case-open' },
        { uid: 'b', giftId: 'scared-cat', acquiredAt: 0, source: 'case-open' },
      ],
      history: [],
    })
    renderScreen()

    await user.click(screen.getByRole('button', { name: /Fresh Socks/ }))
    await user.click(screen.getByRole('button', { name: /Scared Cat/ }))
    await user.click(screen.getByRole('button', { name: 'Крафт' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Не получилось')).toBeInTheDocument()
    expect(within(dialog).getByText('Сумма сгорела: 0.2 TON')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Готово' }))
    expect(useInventoryStore.getState().items).toHaveLength(0)
    const journal = useInventoryStore.getState().history
    expect(journal[0]).toMatchObject({ type: 'remove', detail: 'craft-bet' })
    const entries = useGamesHistoryStore.getState().entries
    expect(entries[0]).toMatchObject({ game: 'Крафт', outcome: 'lost', deltaMinor: -200 })
  })
})
