import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PlinkoScreen } from './PlinkoScreen'
import { useWalletStore } from '../store/wallet'
import { useGamesHistoryStore } from '../store/gamesHistory'
import { useInventoryStore } from '../store/inventory'
import { _resetPlinkoForTests, _setPlinkoRngForTests } from '../services/demoPlinkoService'

const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

/** Прокрутка шагов анимации внутри act (60мс/монетка). */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/games/plinko']}>
      <Routes>
        <Route path="/games/plinko" element={<PlinkoScreen />} />
        <Route path="/games" element={<div>Хаб игр</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  _resetPlinkoForTests()
  _setPlinkoRngForTests(Math.random)
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useInventoryStore.setState({ items: [], history: [] })
  useGamesHistoryStore.setState({ entries: [] })
  // Анимация шара живёт на setInterval: подменяем только интервальные таймеры
  // (полный fake timers глушит планировщик React — см. CrashScreen.test).
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
})

afterEach(() => {
  _resetPlinkoForTests()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('PlinkoScreen (4.6: UI плинко)', () => {
  it('шапка, карманы 8 рядов, честная заметка с максимумом', () => {
    renderScreen()
    expect(screen.getByText('Плинко')).toBeInTheDocument()
    // 8 рядов → 9 карманов
    expect(screen.getByLabelText('Множители карманов').children).toHaveLength(9)
    expect(screen.getByText(/x3777\.95/)).toBeInTheDocument()
    expect(screen.getByText(/Честная игра:/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Бросить шар · 1 GRAM' })).toBeEnabled()
  })

  it('переключение рядов 8 → 16 меняет число карманов', async () => {
    renderScreen()
    await user.click(screen.getByRole('button', { name: '16' }))
    expect(screen.getByLabelText('Множители карманов').children).toHaveLength(17)
    expect(screen.getByText(/16 линий карманов/)).toBeInTheDocument()
  })

  it('недостаточно средств: CTA выключена с честной подсказкой', async () => {
    renderScreen()
    const input = screen.getByLabelText(/^Сумма ставки$/)
    await user.clear(input)
    await user.type(input, '500') // 500 GRAM > 100 GRAM демо-баланса
    expect(screen.getByRole('button', { name: /Бросить шар/ })).toBeDisabled()
    expect(screen.getByText('Баланс: 100 GRAM')).toBeInTheDocument()
  })

  it('бросок: ставка списана, шар летит по шагам, выплата по карману', async () => {
    _setPlinkoRngForTests(() => 0.9) // все вправо → карман 8 (x27.87) → +27870
    vi.spyOn(Math, 'random').mockReturnValue(0.9)
    renderScreen()

    await user.click(screen.getByRole('button', { name: 'Бросить шар · 1 GRAM' }))

    // В полёте CTA недоступна
    expect(screen.getByRole('button', { name: 'Шар летит…' })).toBeDisabled()

    advance(8 * 60 + 120) // 8 монеток + запас

    expect(screen.getByText(/Выигрыш \+26\.87 GRAM \(x27\.87\)/)).toBeInTheDocument()
    expect(useWalletStore.getState().getBalance('demo')).toBe(126_870)
    const entries = useGamesHistoryStore.getState().entries
    expect(entries[0]).toMatchObject({
      game: 'Плинко',
      outcome: 'won',
      deltaMinor: 26_870,
    })
  })

  it('проигрыш: центральный карман показывает честную дельту', async () => {
    let flip = false
    _setPlinkoRngForTests(() => {
      flip = !flip
      return flip ? 0.9 : 0.1
    })
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Бросить шар · 1 GRAM' }))
    advance(8 * 60 + 120)

    expect(screen.getByText(/Карман x0\.39: −0\.61 GRAM/)).toBeInTheDocument()
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000 - 1000 + 390)
  })

  it('после приземления можно бросить ещё', async () => {
    _setPlinkoRngForTests(() => 0.9)
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Бросить шар · 1 GRAM' }))
    advance(8 * 60 + 120)
    expect(screen.getByRole('button', { name: 'Бросить шар · 1 GRAM' })).toBeEnabled()
  })
})
