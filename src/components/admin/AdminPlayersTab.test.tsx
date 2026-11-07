import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminPlayersTab } from './AdminPlayersTab'

vi.mock('../../lib/adminApi', () => ({
  adminFetch: vi.fn(async (path: string) => {
    if (path.startsWith('/api/admin/players?')) {
      return {
        ok: true,
        data: {
          total: 1,
          rows: [
            {
              id: '777',
              name: 'Иван Петров',
              username: 'ivan',
              photo: null,
              first: 1_700_000_000,
              last: Math.floor(Date.now() / 1000),
              balance: 2_500,
              deposited: 10_000,
              wagered: 8_000,
              delta: -1_500,
              rounds: 12,
            },
          ],
        },
      }
    }
    if (path === '/api/admin/players/777') {
      return {
        ok: true,
        data: {
          profile: {
            id: '777', name: 'Иван Петров', username: 'ivan', photo: null, first: 1_700_000_000,
            last: Math.floor(Date.now() / 1000), premium: true, inviter: null, invited: 3, invited_qualified: 2,
          },
          money: {
            balance: 2_500, stars: 14, deposited: 10_000,
            deposits_by: [{ method: 'CryptoBot', count: 2, amount: 10_000 }],
            admin_credit: 0, wagered: 8_000, paid: 6_500, net: -1_500,
          },
          games: [{ game: 'Ракета', rounds: 10, wagered: 7_000, paid: 6_000, net: -1_000 }],
          cases: [{ case: 'FREE', opens: 1, spent: 0, prize: 500 }],
          items: {
            counts: [{ status: 'В инвентаре', count: 1 }],
            list: [{ name: 'Plush Pepe', gift_id: 'plush_pepe-1', price: 500, status: 'В инвентаре', source: 'case', at: 1_700_000_100 }],
            locked: [{ name: 'Mood Pack', price: 800, at: 1_700_000_200, expired: false, joined: 2, target: 5, left: 3, expires_at: 1_700_259_400 }],
          },
          withdrawals: [],
          deposits: [{ method: 'CryptoBot', amount: 10_000, at: 1_700_000_050 }],
          history: [{ at: 1_700_000_050, type: 'Пополнение CryptoBot', sign: 1, amount: 10_000, balance_after: 10_000, note: null }],
        },
      }
    }
    return { ok: false, error: 'нет' }
  }),
}))

afterEach(() => vi.clearAllMocks())

describe('AdminPlayersTab', () => {
  it('список игроков, по нажатию — карточка со статистикой', async () => {
    render(<AdminPlayersTab />)
    const row = await screen.findByRole('button', { name: /Иван Петров/ })
    expect(row).toHaveTextContent('@ivan')
    expect(row).toHaveTextContent('пополнил 10 TON')

    await userEvent.click(row)
    expect(await screen.findByText('Баланс сейчас')).toBeInTheDocument()
    expect(screen.getByText('Пополнил всего').nextSibling).toHaveTextContent('10 TON')
    expect(screen.getByText(/CryptoBot — 2 шт/)).toBeInTheDocument()
    expect(screen.getByText('Plush Pepe')).toBeInTheDocument()
    expect(screen.getByText('Пополнение CryptoBot')).toBeInTheDocument()
    expect(screen.getByText(/ID 777 · Premium/)).toBeInTheDocument()
    // NFT под замком: сколько друзей осталось пригласить
    expect(screen.getByText('🔒 Mood Pack')).toBeInTheDocument()
    expect(screen.getByText('Осталось пригласить: 3 из 5')).toBeInTheDocument()
    expect(screen.getByText(/Засчитано друзей с Premium: 2 \/ 5/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Ко всем игрокам/ }))
    expect(await screen.findByRole('button', { name: /Иван Петров/ })).toBeInTheDocument()
  })
})
