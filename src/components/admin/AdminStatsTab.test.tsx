import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminStatsTab } from './AdminStatsTab'

afterEach(() => {
  vi.unstubAllGlobals()
  delete (window as { Telegram?: unknown }).Telegram
})

describe('AdminStatsTab (обзор)', () => {
  it('показывает пользователей и деньги понятными карточками', async () => {
    ;(window as { Telegram?: unknown }).Telegram = { WebApp: { initData: 'x', initDataUnsafe: {} } }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          since: 1_700_000_000, users_total: 1240, users_24h: 312, users_new_24h: 57, wagered: 5_400_000,
          house_profit: 210_000, games: [{ game: 'crash', rounds: 900, wagered: 4_000_000, delta: -150_000, wins: 1 }],
          cases: [], deposits: [], series: [], top: [], users_7d: 800, users_30d: 1100, users_new_7d: 300,
          users_premium: 140, users_played: 610, users_paid: 95, users_referred: 420, deposited_total: 1_830_000,
          deposited_24h: 64_000, balances_total: 412_000, stars_total: 2240, withdrawals_pending: 3, withdrawals_done: 41,
        }),
      })),
    )
    render(<AdminStatsTab />)
    expect(await screen.findByText('Всего в боте')).toBeInTheDocument()
    expect(screen.getByText('1240')).toBeInTheDocument()
    expect(screen.getByText('57 / 300')).toBeInTheDocument()
    expect(screen.getByText('впервые открыли приложение')).toBeInTheDocument()
    expect(screen.getByText('Пополняли баланс').nextSibling).toHaveTextContent('95')
    await userEvent.click(screen.getByRole('tab', { name: 'Пополнения' }))
    expect(screen.getByText('Пополнено всего').nextSibling).toHaveTextContent('1830 TON')
    await userEvent.click(screen.getByRole('tab', { name: 'Игры' }))
    expect(screen.getByText('Ракета')).toBeInTheDocument()
  })
})
