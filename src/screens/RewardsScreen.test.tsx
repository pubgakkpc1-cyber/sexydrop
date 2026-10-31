import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RewardsScreen } from './RewardsScreen'
import { useProfileStore } from '../store/profile'
import { useQuestsStore } from '../store/quests'
import { useStarsBalanceStore } from '../store/starsBalance'
import { useWalletStore } from '../store/wallet'

const user = userEvent.setup()

beforeEach(() => {
  useWalletStore.setState({ mode: 'demo', balances: { demo: 100_000, real: 0 } })
  useProfileStore.setState({ rounds: 0, wageredMinor: 0, netMinor: 0, pvpMatches: 0 })
  useQuestsStore.setState({ claimed: {} })
  useStarsBalanceStore.setState({ stars: 0 })
})

describe('RewardsScreen (Заработок: звёзды за задания и обмен на TON)', () => {
  it('шапка, секции и звёздный баланс; билетов и розыгрыша нет', () => {
    render(<RewardsScreen />)
    expect(screen.getByText('Заработок')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Обмен звёзд' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Задания' })).toBeInTheDocument()
    expect(screen.getByTestId('earn-value')).toHaveTextContent('0')
    expect(screen.queryByText(/билет/i)).not.toBeInTheDocument()
    expect(screen.getByText(/Курс: 175 Stars = 1 TON/)).toBeInTheDocument()
  })

  it('задание даёт звёзды один раз', async () => {
    useProfileStore.setState({ rounds: 1, wageredMinor: 0, netMinor: 0, pvpMatches: 0 })
    render(<RewardsScreen />)
    await user.click(screen.getByRole('button', { name: 'Забрать' }))
    expect(useStarsBalanceStore.getState().stars).toBe(50)
    expect(screen.getByText('Забрано')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '—' }).length).toBe(5)
    expect(useWalletStore.getState().getBalance('demo')).toBe(100_000) // TON не тронут
  })

  it('обмен: 175 Stars → 1 TON на баланс, звёзды списываются', async () => {
    useStarsBalanceStore.setState({ stars: 400 })
    render(<RewardsScreen />)
    await user.click(screen.getByRole('button', { name: /^175/ }))
    expect(useStarsBalanceStore.getState().stars).toBe(225)
    expect(useWalletStore.getState().getBalance('demo')).toBe(101_000)
    expect(screen.getByTestId('exchange-note')).toHaveTextContent('Обмен: 175 Stars → 1 TON')
  })

  it('кнопки обмена недоступны, если звёзд не хватает', () => {
    useStarsBalanceStore.setState({ stars: 100 })
    render(<RewardsScreen />)
    expect(screen.getByRole('button', { name: /^175/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^Всё/ })).toBeDisabled()
  })

  it('«Всё» обменивает весь остаток по курсу вниз', async () => {
    useStarsBalanceStore.setState({ stars: 350 })
    render(<RewardsScreen />)
    await user.click(screen.getByRole('button', { name: /^Всё/ }))
    expect(useStarsBalanceStore.getState().stars).toBe(0)
    expect(useWalletStore.getState().getBalance('demo')).toBe(102_000)
  })
})
