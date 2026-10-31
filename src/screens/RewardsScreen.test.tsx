import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { RewardsScreen } from './RewardsScreen'
import { useProfileStore } from '../store/profile'
import { useQuestsStore } from '../store/quests'
import { useStarsBalanceStore } from '../store/starsBalance'
import { useWalletStore } from '../store/wallet'

const user = userEvent.setup()

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/rewards']}>
      <Routes>
        <Route path="/rewards" element={<RewardsScreen />} />
        <Route path="/deposit" element={<div>Экран конвертера</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useProfileStore.setState({ rounds: 0, wageredMinor: 0, netMinor: 0, pvpMatches: 0, casesOpened: 0, minesRounds: 0, upgrades: 0, friendDeposits: 0 })
  useQuestsStore.setState({ claimed: {} })
  useStarsBalanceStore.setState({ stars: 0 })
})

describe('RewardsScreen (Заработок: звёзды за задания, обмен в конвертере)', () => {
  it('шапка со звёздным балансом и кнопкой «Обменять»; блока обмена и билетов нет', () => {
    renderScreen()
    expect(screen.getByText('Заработок')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Задания' })).toBeInTheDocument()
    expect(screen.getByTestId('earn-value')).toHaveTextContent('0')
    expect(screen.getByRole('button', { name: 'Обменять' })).toBeInTheDocument()
    expect(screen.queryByText(/Обмен на TON/)).not.toBeInTheDocument()
    expect(screen.queryByText(/билет/i)).not.toBeInTheDocument()
  })

  it('«Обменять» ведёт в конвертер', async () => {
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Обменять' }))
    expect(screen.getByText('Экран конвертера')).toBeInTheDocument()
  })

  it('задание даёт звёзды один раз; невыполненные показывают процент', async () => {
    useProfileStore.setState({ upgrades: 1 })
    renderScreen()
    await user.click(screen.getByRole('button', { name: 'Забрать' }))
    expect(useStarsBalanceStore.getState().stars).toBe(50)
    expect(screen.getByText('Забрано')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^\d+%$/ }).length).toBe(4)
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000) // TON не тронут
  })
})
