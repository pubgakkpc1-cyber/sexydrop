import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { MinesScreen } from './MinesScreen'
import { useWalletStore } from '../store/wallet'
import { useGamesHistoryStore } from '../store/gamesHistory'
import { _resetMinesForTests, _setMinesRngForTests } from '../services/demoMinesService'

const user = userEvent.setup()

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/games/mines']}>
      <Routes>
        <Route path="/games/mines" element={<MinesScreen />} />
        <Route path="/games" element={<div>Хаб игр</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  _resetMinesForTests()
  _setMinesRngForTests(Math.random)
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useGamesHistoryStore.setState({ entries: [] })
})

afterEach(() => {
  _resetMinesForTests()
  vi.restoreAllMocks()
})

describe('MinesScreen (4.8: доска 5×5, забор, честные исходы)', () => {
  it('шапка, доска 25 клеток, конфиг мин, честная заметка с TIER 7', () => {
    renderScreen()
    expect(screen.getByText('Мины')).toBeInTheDocument()
    expect(screen.getByText('Demo Mode')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Поле 25 клеток' })).toBeInTheDocument()
    for (let i = 1; i <= 25; i += 1) {
      expect(screen.getByRole('button', { name: `Клетка ${i}` })).toBeInTheDocument()
    }
    // конфиг мин: 1 / 3 / 5 / 10 / 24, активна 3
    expect(screen.getByRole('button', { name: '3', pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '24' })).toBeInTheDocument()
    expect(screen.getByText(/Шанс на клетку: 88%/)).toBeInTheDocument()
    expect(screen.getByText(/TIER 7/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Начать · 1 TON' })).toBeEnabled()
  })

  it('старт и безопасный ход: TonIcon, множитель, зелёный «Забрать» с выплатой', async () => {
    _setMinesRngForTests(() => 0) // мины [0, 1, 2] → клетка 10 безопасна
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Начать · 1 TON' }))
    // до первого хода кнопка забора недоступна
    expect(screen.getByRole('button', { name: 'Откройте клетку, чтобы забрать' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Клетка 11' }))
    expect(screen.getByText('Открыто 1 · x1.11')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Забрать x1\.11 · \+1\.11 TON/ })).toBeEnabled()
    expect(screen.getByTestId('gem-icon')).toBeInTheDocument()
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)
  })

  it('забор: выплата floor(ставка × m), раскрытие мин, история с +дельтой', async () => {
    _setMinesRngForTests(() => 0) // мины [0, 1, 2]
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Начать · 1 TON' }))
    await user.click(screen.getByRole('button', { name: 'Клетка 11' }))
    await user.click(screen.getByRole('button', { name: /Забрать x1\.11/ }))
    expect(screen.getByText('Забрано +1.11 TON')).toBeInTheDocument()
    expect(screen.getAllByTestId('bomb-icon')).toHaveLength(3)
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000 - 1000 + 1110)
    expect(useGamesHistoryStore.getState().entries[0]).toMatchObject({
      game: 'Мины',
      outcome: 'won',
      deltaMinor: 110,
    })
    // «Играть снова» возвращает конфиг, раунд закрыт
    await user.click(screen.getByRole('button', { name: 'Играть снова' }))
    expect(screen.getByText(/Шанс на клетку: 88%/)).toBeInTheDocument()
  })

  it('мина: честный проигрыш, раскрытие всех мин, история с −ставкой', async () => {
    _setMinesRngForTests(() => 0) // мины [0, 1, 2] → клетка 1 = мина
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Начать · 1 TON' }))
    await user.click(screen.getByRole('button', { name: 'Клетка 1' }))
    expect(screen.getByText('Мина! −1 TON')).toBeInTheDocument()
    expect(screen.getAllByTestId('bomb-icon')).toHaveLength(3)
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)
    expect(useGamesHistoryStore.getState().entries[0]).toMatchObject({
      game: 'Мины',
      outcome: 'lost',
      deltaMinor: -1000,
    })
  })

  it('смена числа мин до старта, блокировка в раунде', async () => {
    renderScreen()
    await user.click(screen.getByRole('button', { name: '24' }))
    expect(screen.getByText(/Шанс на клетку: 4%/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Начать · 1 TON' }))
    // в раунде конфиг заблокирован
    expect(screen.getByRole('button', { name: '24' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Клетка 25' })).toBeEnabled()
  })

  it('полный сбор на экране: 24 мины → x24.5, автозабор', async () => {
    _setMinesRngForTests(() => 0) // мины [0..23], безопасна клетка 25
    renderScreen()
    await user.click(screen.getByRole('button', { name: '24' }))
    await user.click(screen.getByRole('button', { name: 'Начать · 1 TON' }))
    await user.click(screen.getByRole('button', { name: 'Клетка 25' }))
    expect(screen.getByText('Полный сбор +24.5 TON')).toBeInTheDocument()
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000 - 1000 + 24_500)
    expect(useGamesHistoryStore.getState().entries[0]).toMatchObject({
      game: 'Мины',
      outcome: 'won',
      deltaMinor: 23_500,
    })
  })
})
