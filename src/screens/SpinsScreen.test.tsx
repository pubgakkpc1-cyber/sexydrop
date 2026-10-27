import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SpinsScreen } from './SpinsScreen'
import { useWalletStore } from '../store/wallet'
import { useGamesHistoryStore } from '../store/gamesHistory'
import { _resetSpinsForTests, _setSpinsRngForTests } from '../services/demoSpinsService'

const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

/** Прокрутка времени автоспина внутри act — кадры успевают отрисоваться. */
function advanceAuto(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/games/spins']}>
      <Routes>
        <Route path="/games/spins" element={<SpinsScreen />} />
        <Route path="/games" element={<div>Хаб игр</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  _resetSpinsForTests()
  _setSpinsRngForTests(Math.random)
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useGamesHistoryStore.setState({ entries: [] })
  // Подменяем только интервалы автоспина: полный fake timers глушит
  // планировщик React (setTimeout) — паттерн CrashScreen.
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
})

afterEach(() => {
  _resetSpinsForTests()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('SpinsScreen (4.9: колесо, бонус M2, покупка бонуса, автоспин)', () => {
  it('шапка, сетка 25 ячеек, чипы символов с множителями, честная заметка', () => {
    renderScreen()
    expect(screen.getByText('Спины')).toBeInTheDocument()
    expect(screen.getByText('Demo Mode')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Сетка 25 ячеек' })).toBeInTheDocument()
    for (let i = 1; i <= 25; i += 1) {
      expect(screen.getByLabelText(`Ячейка ${i}`)).toBeInTheDocument()
    }
    expect(screen.getByText('Plush Pepe')).toBeInTheDocument()
    expect(screen.getByText('x7.84')).toBeInTheDocument()
    expect(screen.getByText('x3.92')).toBeInTheDocument()
    expect(screen.getByText('Chill Flame')).toBeInTheDocument()
    expect(screen.getByText('x0.43')).toBeInTheDocument()
    expect(screen.getByText('10.0%')).toBeInTheDocument() // шанс бонуса
    expect(screen.getByRole('button', { name: /Купить бонус · 0\.997 TON/ })).toBeEnabled()
    expect(screen.getByText(/EV ≤ 0\.98/)).toBeInTheDocument()
    expect(screen.getByText(/TIER 7/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Крутить · 1 TON' })).toBeEnabled()
  })

  it('спин подарка: подсветка ячейки, честная строка, дельта и история', async () => {
    // база: u = 0.7 → r = 56 → chill-flame x0.43; ячейка 11
    const seq = [0.7, 0.4]
    _setSpinsRngForTests(() => seq.shift() ?? 0)
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Крутить · 1 TON' }))
    expect(screen.getByText('Chill Flame · x0.43 · −1 TON')).toBeInTheDocument()
    expect(screen.getByLabelText('Ячейка 11').className).toContain('cellWinner')
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000 - 1000 + 430)
    expect(useGamesHistoryStore.getState().entries[0]).toMatchObject({
      game: 'Спины',
      outcome: 'lost',
      deltaMinor: -570,
    })
  })

  it('бонус-символ: бесплатный спин M2, строка результата, баланс', async () => {
    // база: u = 0.95 → бонус; ячейка 11; M2: u = 0.5 → holiday-gift x0.65 → 650
    const seq = [0.95, 0.4, 0.5]
    _setSpinsRngForTests(() => seq.shift() ?? 0)
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Крутить · 1 TON' }))
    expect(
      screen.getByText('Бонус! Спин ×1.00 → Holiday Gift x0.65 · +0.65 TON'),
    ).toBeInTheDocument()
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000 - 1000 + 650)
    expect(useGamesHistoryStore.getState().entries[0]).toMatchObject({
      game: 'Спины',
      outcome: 'lost',
      deltaMinor: -350,
      detail: 'бонус · Holiday Gift x0.65',
    })
  })

  it('двойной шанс: множители пересчитаны по W=88, шанс бонуса 18.2%', async () => {
    renderScreen()
    const toggle = screen.getByRole('button', { name: 'Шанс бонуса ×2' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('x8.62')).toBeInTheDocument() // plush-pepe по W=88
    expect(screen.getByText('18.2%')).toBeInTheDocument()
  })

  it('покупка бонуса: списание цены 0.997, спин M2 со полной ставкой', async () => {
    _setSpinsRngForTests(() => 0.5) // M2: holiday-gift x0.65 → 650
    renderScreen()
    await user.click(screen.getByRole('button', { name: /Купить бонус · 0\.997 TON/ }))
    expect(screen.getByText('Бонус куплен · Holiday Gift x0.65 · +0.65 TON')).toBeInTheDocument()
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000 - 997 + 650)
    expect(useGamesHistoryStore.getState().entries[0]).toMatchObject({
      game: 'Спины',
      stakeLabel: '0.997 TON',
      deltaMinor: -347,
    })
  })

  it('автоспин 10: серия из 10 спинов по интервалу, авто-остановка, история', async () => {
    renderScreen()
    await user.click(screen.getByRole('button', { name: '10' }))
    // первый спин — сразу; затем 9 по интервалу 650 мс
    advanceAuto(650 * 9)
    expect(useGamesHistoryStore.getState().entries).toHaveLength(10)
    // автоспин остановился: чипы снова активны, кнопки разблокированы
    expect(screen.getByRole('button', { name: 'Крутить · 1 TON' })).toBeEnabled()
    expect(useGamesHistoryStore.getState().entries.every((e) => e.game === 'Спины')).toBe(true)
  })

  it('автоспин: кнопка «Стоп» прерывает серию', async () => {
    renderScreen()
    await user.click(screen.getByRole('button', { name: '25' }))
    expect(screen.getByRole('button', { name: 'Стоп' })).toBeInTheDocument()
    advanceAuto(650) // 2 спина
    await user.click(screen.getByRole('button', { name: 'Стоп' }))
    const stopped = useGamesHistoryStore.getState().entries.length
    advanceAuto(650 * 30)
    expect(useGamesHistoryStore.getState().entries.length).toBe(stopped)
    expect(screen.queryByRole('button', { name: 'Стоп' })).not.toBeInTheDocument()
  })

  it('отказ: ставка больше баланса — CTA заблокированы, без списаний', async () => {
    useWalletStore.setState({ mode: 'demo', balances: { demo: 50, real: 0 } })
    renderScreen()
    expect(screen.getByRole('button', { name: 'Крутить · 1 TON' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Купить бонус · 0\.997 TON/ })).toBeDisabled()
    expect(useWalletStore.getState().getBalance('demo')).toBe(50)
    expect(useGamesHistoryStore.getState().entries).toHaveLength(0)
  })
})
