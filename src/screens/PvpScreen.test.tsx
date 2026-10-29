import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PvpScreen } from './PvpScreen'
import { useWalletStore } from '../store/wallet'
import { usePvpMatchesStore } from '../store/pvpMatches'
import { usePvpRoundsStore } from '../store/pvpRounds'
import {
  _resetJackpotForTests,
  _setJackpotRngForTests,
  drawJackpot,
  startJackpotRound,
} from '../services/demoJackpotService'
import { _resetTvtForTests } from '../services/demoTvtService'

function renderScreen(initial = '/pvp') {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/pvp" element={<PvpScreen />} />
        <Route path="/pvp/jackpot" element={<div>Джекпот</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  _resetJackpotForTests()
  _resetTvtForTests()
  _setJackpotRngForTests(Math.random)
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  usePvpMatchesStore.setState({ entries: [] })
  usePvpRoundsStore.setState({ jackpot: null, tvt: null })
})

afterEach(() => {
  _resetJackpotForTests()
  _resetTvtForTests()
  vi.restoreAllMocks()
})

describe('PvpScreen — PVP HUB (5.1, 5.5, 5.6)', () => {
  it('заголовок, два режима-ссылки без «скоро», сводка честности', () => {
    renderScreen()
    expect(screen.getByText('PVP HUB')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Solo Jackpot/ })).toHaveAttribute(
      'href',
      '/pvp/jackpot',
    )
    expect(screen.getByRole('link', { name: /TVT: Лёд vs Огонь/ })).toHaveAttribute(
      'href',
      '/pvp/tvt',
    )
    expect(screen.queryByText('скоро')).not.toBeInTheDocument()
    expect(screen.getByText(/Честные правила: шанс и коэффициенты открыты/)).toBeInTheDocument()
  })

  it('5.6: лидерборд пуст без матчей — честный empty-state', () => {
    renderScreen()
    expect(screen.getByText(/Матчей пока нет — сыграйте/)).toBeInTheDocument()
  })

  it('5.5: история матчей показывает реальные записи после игр', () => {
    _setJackpotRngForTests(() => 0.05)
    startJackpotRound(1000, 'req-1')
    drawJackpot('req-2')
    renderScreen()
    expect(screen.getByRole('region', { name: 'История матчей' })).toBeInTheDocument()
    expect(screen.getByText('Победа')).toBeInTheDocument()
    expect(screen.getByText(/билет 500 из 10000/)).toBeInTheDocument()
  })

  it('5.4: открытый раунд Джекпота показывает баннер возврата', () => {
    startJackpotRound(1000, 'req-1')
    renderScreen()
    const banner = screen.getByTestId('active-round')
    expect(banner).toHaveTextContent('Идёт раунд: Solo Jackpot')
    expect(banner).toHaveTextContent('Банк 10 TON')
    expect(banner).toHaveAttribute('href', '/pvp/jackpot')
  })

  it('после тиража баннер исчезает', () => {
    startJackpotRound(1000, 'req-1')
    _setJackpotRngForTests(() => 0.98)
    drawJackpot('req-2')
    renderScreen()
    expect(screen.queryByTestId('active-round')).not.toBeInTheDocument()
  })

  it('5.6: лидерборд считает реальную статистику (матчи, винрейт, профит)', () => {
    _setJackpotRngForTests(() => 0.05) // выигрыш
    startJackpotRound(1000, 'req-1')
    drawJackpot('req-2')
    _setJackpotRngForTests(() => 0.98) // проигрыш
    startJackpotRound(500, 'req-3')
    drawJackpot('req-4')
    renderScreen()
    const table = screen.getByRole('table')
    expect(table).toHaveTextContent('Вы')
    expect(table).toHaveTextContent('2')
    expect(table).toHaveTextContent('50%')
    // профит: +9000 − 500 = +8500
    expect(table).toHaveTextContent('+8.5 TON')
  })
})
