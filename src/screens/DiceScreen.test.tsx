import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { DiceScreen } from './DiceScreen'
import { useWalletStore } from '../store/wallet'
import { useGamesHistoryStore } from '../store/gamesHistory'
import { _resetDiceForTests, _setDiceRngForTests } from '../services/demoDiceService'

const user = userEvent.setup()

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/games/dice']}>
      <Routes>
        <Route path="/games/dice" element={<DiceScreen />} />
        <Route path="/games" element={<div>Хаб игр</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  _resetDiceForTests()
  _setDiceRngForTests(Math.random)
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useGamesHistoryStore.setState({ entries: [] })
})

afterEach(() => {
  _resetDiceForTests()
  vi.restoreAllMocks()
})

describe('DiceScreen (4.7: поля пересчитывают друг друга)', () => {
  it('шапка, направление, цель 5099 > , шанс 49%, множитель x2, честная заметка', () => {
    renderScreen()
    expect(screen.getByText('Дайс')).toBeInTheDocument()
    expect(screen.getByText('Demo Mode')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Больше X' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('> 5099')).toBeInTheDocument()
    expect(screen.getByText('49%')).toBeInTheDocument()
    expect(screen.getByLabelText('Множитель')).toHaveValue('2')
    expect(screen.getByText(/EV = 0\.98/)).toBeInTheDocument()
    expect(screen.getByText(/TIER 7/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Бросить · 1 GRAM' })).toBeEnabled()
  })

  it('смена направления зажимает цель в границы и пересчитывает поля', async () => {
    renderScreen()
    // over-цель 5099 → under 5099 тоже валидна, но шанс другой: c = 5099 → 50.99%
    await user.click(screen.getByRole('button', { name: 'Меньше X' }))
    expect(screen.getByText('< 5099')).toBeInTheDocument()
    expect(screen.getByText('50.99%')).toBeInTheDocument()
    // c = 5099 → m4 = floor(98e6/5099) = 19219 → x1.9219 (только вниз)
    expect(screen.getByLabelText('Множитель')).toHaveValue('1.9219')
  })

  it('ввод шанса 25% пересчитывает цель (under 2500) и множитель (x3.92)', async () => {
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Меньше X' }))
    const chance = screen.getByLabelText('Шанс, %')
    await user.clear(chance)
    await user.type(chance, '25')
    // c = 2500 → under X = 2500; m4 = floor(98e6/2500) = 39200 → 3.92
    expect(screen.getByText('< 2500')).toBeInTheDocument()
    expect(screen.getByLabelText('Множитель')).toHaveValue('3.92')
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  it('ввод множителя 4 пересчитывает шанс и цель (under X = 2450)', async () => {
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Меньше X' }))
    const mult = screen.getByLabelText('Множитель')
    await user.clear(mult)
    await user.type(mult, '4')
    // c = floor(98e6/40000) = 2450 → p = 24.5%; реальный m4 = floor(98e6/2450) = 40000 → x4
    expect(screen.getByText('< 2450')).toBeInTheDocument()
    expect(screen.getByText('24.5%')).toBeInTheDocument()
    expect(screen.getByLabelText('Множитель')).toHaveValue('4')
  })

  it('ролл: дебет, результат цветом, история записана', async () => {
    _setDiceRngForTests(() => 0.51) // ролл 5100 > 5099 → выигрыш x2
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Бросить · 1 GRAM' }))
    expect(screen.getByText('5100')).toBeInTheDocument()
    expect(screen.getByText(/Ролл выше 5099 — выигрыш/)).toBeInTheDocument()
    expect(screen.getByText(/Выигрыш \+1 GRAM \(x2\.00\)/)).toBeInTheDocument()
    expect(useWalletStore.getState().getBalance('demo')).toBe(101_000)
    expect(useGamesHistoryStore.getState().entries[0]).toMatchObject({
      game: 'Дайс',
      outcome: 'won',
      deltaMinor: 1000,
    })
  })

  it('проигрыш: честная строка мимо и дельта −ставка', async () => {
    _setDiceRngForTests(() => 0.4) // ролл 4000 ≤ 5099 → мимо
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Бросить · 1 GRAM' }))
    expect(screen.getByText(/Мимо: −1 GRAM/)).toBeInTheDocument()
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)
    expect(useGamesHistoryStore.getState().entries[0]).toMatchObject({
      game: 'Дайс',
      outcome: 'lost',
      deltaMinor: -1000,
    })
  })
})
