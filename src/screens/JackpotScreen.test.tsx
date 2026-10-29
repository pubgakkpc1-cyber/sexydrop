import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { JackpotScreen } from './JackpotScreen'
import { useWalletStore } from '../store/wallet'
import { usePvpMatchesStore } from '../store/pvpMatches'
import { _resetJackpotForTests, _setJackpotRngForTests } from '../services/demoJackpotService'

const user = userEvent.setup()

function renderScreen(initial = '/pvp/jackpot') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/pvp/jackpot" element={<JackpotScreen />} />
        <Route path="/pvp" element={<div>PVP Хаб</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  _resetJackpotForTests()
  _setJackpotRngForTests(Math.random)
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  usePvpMatchesStore.setState({ entries: [] })
})

afterEach(() => {
  _resetJackpotForTests()
  vi.restoreAllMocks()
})

describe('JackpotScreen (5.2: банк, доля, тираж)', () => {
  it('шапка, заголовок, честная заметка, CTA зайти', () => {
    renderScreen()
    expect(screen.getByText('Solo Jackpot')).toBeInTheDocument()
    expect(screen.getByText(/Джекпот: шанс победы равен доле вашей ставки/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Зайти в банк · 1 TON' })).toBeEnabled()
  })

  it('старт раунда: банк 10 TON, доля 10.00%, панель докидывания и тиража', async () => {
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Зайти в банк · 1 TON' }))
    expect(screen.getByTestId('bank')).toHaveTextContent('10 TON')
    expect(screen.getByText('Вы: 10.00%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Докинуть · 1 TON' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Провести тираж' })).toBeEnabled()
    // EV опубликован на экране: floor(980·10000/10000) − 1000 = −20
    expect(screen.getByText(/EV: −0\.02 TON/)).toBeInTheDocument()
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)
  })

  it('докидывание: банк и доля растут (5.2 «шанс = доля ставки в банке»)', async () => {
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Зайти в банк · 1 TON' }))
    await user.click(screen.getByRole('button', { name: 'Докинуть · 1 TON' }))
    expect(screen.getByTestId('bank')).toHaveTextContent('11 TON')
    expect(screen.getByText('Вы: 18.18%')).toBeInTheDocument()
    expect(screen.getByText(/Шанс: 17\.81%/)).toBeInTheDocument()
    expect(useWalletStore.getState().getBalance('demo')).toBe(98_000)
  })

  it('тираж — выигрыш: билет, выплата всего банка, история матча', async () => {
    _setJackpotRngForTests(() => 0.05) // билет 500 < 980
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Зайти в банк · 1 TON' }))
    await user.click(screen.getByRole('button', { name: 'Провести тираж' }))
    expect(screen.getByText('0500')).toBeInTheDocument()
    expect(screen.getByTestId('jackpot-result')).toHaveTextContent('Банк ваш: +9 TON')
    expect(useWalletStore.getState().getBalance('demo')).toBe(109_000)
    expect(usePvpMatchesStore.getState().entries[0]).toMatchObject({
      mode: 'jackpot',
      outcome: 'won',
      deltaMinor: 9000,
    })
  })

  it('тираж — проигрыш: честная строка «Банк забирает казино»', async () => {
    _setJackpotRngForTests(() => 0.98) // билет 9800 ≥ 980
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Зайти в банк · 1 TON' }))
    await user.click(screen.getByRole('button', { name: 'Провести тираж' }))
    expect(screen.getByTestId('jackpot-result')).toHaveTextContent(
      'Банк забирает казино: −1 TON',
    )
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)
  })

  it('5.4: возврат на экран восстанавливает открытый раунд из стора', async () => {
    const first = renderScreen()
    await user.click(screen.getByRole('button', { name: 'Зайти в банк · 1 TON' }))
    await user.click(screen.getByRole('button', { name: 'Докинуть · 1 TON' }))
    first.unmount()

    // Новый монтирование — состояние раунда приходит из store/pvpRounds
    renderScreen()
    expect(screen.getByTestId('bank')).toHaveTextContent('11 TON')
    expect(screen.getByText('Вы: 18.18%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Провести тираж' })).toBeEnabled()
  })

  it('после тиража можно открыть новый раунд (панель вклада возвращается)', async () => {
    _setJackpotRngForTests(() => 0.98)
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Зайти в банк · 1 TON' }))
    await user.click(screen.getByRole('button', { name: 'Провести тираж' }))
    expect(
      screen.getByRole('button', { name: 'Зайти в банк · 1 TON' }),
    ).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Зайти в банк · 1 TON' }))
    expect(screen.getByTestId('bank')).toHaveTextContent('10 TON')
  })
})
