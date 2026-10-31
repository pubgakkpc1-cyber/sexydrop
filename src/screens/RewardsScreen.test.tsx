import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RewardsScreen } from './RewardsScreen'
import { useProfileStore } from '../store/profile'
import { useQuestsStore } from '../store/quests'
import { usePayoutsStore } from '../store/payouts'
import { useWalletStore } from '../store/wallet'

const user = userEvent.setup()

beforeEach(() => {
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useProfileStore.setState({ rounds: 0, wageredMinor: 0, netMinor: 0, pvpMatches: 0 })
  useQuestsStore.setState({ claimed: {} })
  usePayoutsStore.setState({ requests: [] })
})

describe('RewardsScreen (Заработок: выплата звёздами и задания)', () => {
  it('шапка, секции и баланс в TON и Stars; билетов и розыгрыша нет', () => {
    render(<RewardsScreen />)
    expect(screen.getByText('Заработок')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Выплата звёздами' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Задания' })).toBeInTheDocument()
    expect(screen.getByTestId('earn-value')).toHaveTextContent('100 TON')
    expect(screen.queryByText(/билет/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Розыгрыш/)).not.toBeInTheDocument()
    expect(screen.getByText(/Курс: 175 Stars = 1 TON/)).toBeInTheDocument()
  })

  it('выплата: списывает TON с баланса и создаёт заявку в Stars', async () => {
    render(<RewardsScreen />)
    await user.click(screen.getByRole('button', { name: /Вывести 175 Stars/ }))
    expect(useWalletStore.getState().getBalance('demo')).toBe(99_000)
    expect(usePayoutsStore.getState().requests).toHaveLength(1)
    expect(usePayoutsStore.getState().requests[0]).toMatchObject({ minor: 1000, stars: 175 })
    expect(screen.getByTestId('payout-note')).toHaveTextContent('Заявка принята: 175 Stars')
  })

  it('при нехватке баланса выплата недоступна', () => {
    useWalletStore.setState({ mode: 'demo', balances: { demo: 500, real: 0 } })
    render(<RewardsScreen />)
    expect(screen.getByRole('button', { name: /Вывести 175 Stars/ })).toBeDisabled()
  })

  it('задание: claim зачисляет TON на баланс один раз', async () => {
    useProfileStore.setState({ rounds: 1, wageredMinor: 0, netMinor: 0, pvpMatches: 0 })
    render(<RewardsScreen />)
    const claimButton = screen.getByRole('button', { name: 'Забрать' })
    expect(claimButton).toBeEnabled() // «Первый раунд» (1/1)
    await user.click(claimButton)
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_250)
    expect(screen.getByText('Забрано')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '—' }).length).toBe(5)
  })
})
