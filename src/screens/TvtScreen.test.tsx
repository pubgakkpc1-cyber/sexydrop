import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { TvtScreen } from './TvtScreen'
import { useWalletStore } from '../store/wallet'
import { usePvpMatchesStore } from '../store/pvpMatches'
import {
  _resetJackpotForTests,
  _setJackpotRngForTests,
  drawJackpot,
  startJackpotRound,
} from '../services/demoJackpotService'
import { _resetTvtForTests, _setTvtRngForTests } from '../services/demoTvtService'

const user = userEvent.setup()

function renderScreen(initial = '/pvp/tvt') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/pvp/tvt" element={<TvtScreen />} />
        <Route path="/pvp/jackpot" element={<div>Джекпот</div>} />
        <Route path="/pvp" element={<div>PVP Хаб</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  _resetJackpotForTests()
  _resetTvtForTests()
  _setJackpotRngForTests(Math.random)
  _setTvtRngForTests(Math.random)
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  usePvpMatchesStore.setState({ entries: [] })
})

afterEach(() => {
  _resetJackpotForTests()
  _resetTvtForTests()
  vi.restoreAllMocks()
})

describe('TvtScreen (5.3: стороны, монета 50/50 ×1.96)', () => {
  it('шапка, стороны, честная заметка', () => {
    renderScreen()
    expect(screen.getByText('TVT: Лёд vs Огонь')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Лёд/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/TVT: выберите сторону/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Бросить монету · 1 TON' })).toBeEnabled()
  })

  it('выбор стороны Огонь переключает pressed', async () => {
    renderScreen()
    await user.click(screen.getByRole('button', { name: /Огонь/ }))
    expect(screen.getByRole('button', { name: /Огонь/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Лёд/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('бросок — выигрыш Лёд: монета, результат, баланс, история матча', async () => {
    _setTvtRngForTests(() => 0.3) // Лёд
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Бросить монету · 1 TON' }))
    expect(screen.getByTestId('tvt-result')).toHaveTextContent('Выигрыш +0.96 TON (×1.96)')
    expect(screen.getByText('Выпал: Лёд — выигрыш')).toBeInTheDocument()
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_960)
    expect(usePvpMatchesStore.getState().entries[0]).toMatchObject({
      mode: 'tvt',
      outcome: 'won',
      deltaMinor: 960,
    })
  })

  it('бросок — проигрыш: честная строка и дельта −ставка', async () => {
    _setTvtRngForTests(() => 0.6) // Огонь
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Бросить монету · 1 TON' }))
    expect(screen.getByTestId('tvt-result')).toHaveTextContent('Мимо: −1 TON')
    expect(screen.getByText('Выпал: Огонь — мимо')).toBeInTheDocument()
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)
    expect(usePvpMatchesStore.getState().entries[0]).toMatchObject({ outcome: 'lost' })
  })

  it('5.4: при открытом раунде Джекпота CTA заменён блоком со ссылкой; тираж разблокирует', async () => {
    startJackpotRound(1000, 'req-j1')
    renderScreen()
    expect(
      screen.queryByRole('button', { name: 'Бросить монету · 1 TON' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText(/Открыт раунд Solo Jackpot/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Вернуться в Джекпот →' })).toBeInTheDocument()

    _setJackpotRngForTests(() => 0.98)
    act(() => {
      drawJackpot('req-j2')
    })
    expect(screen.getByRole('button', { name: 'Бросить монету · 1 TON' })).toBeEnabled()
  })

  it('5.4: возврат на экран восстанавливает последний бросок', async () => {
    _setTvtRngForTests(() => 0.3)
    const first = renderScreen()
    await user.click(screen.getByRole('button', { name: 'Бросить монету · 1 TON' }))
    first.unmount()

    renderScreen()
    expect(screen.getByTestId('tvt-result')).toHaveTextContent('Выигрыш +0.96 TON (×1.96)')
    expect(screen.getByText('Выпал: Лёд — выигрыш')).toBeInTheDocument()
  })
})
