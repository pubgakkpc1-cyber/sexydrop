import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminErrorBoundary } from './AdminErrorBoundary'
import { safeAmount, signedTon, ton } from './adminFormat'

const adminFetch = vi.fn()
vi.mock('../../lib/adminApi', () => ({ adminFetch: (...a: unknown[]) => adminFetch(...a) }))

afterEach(() => {
  adminFetch.mockReset()
  vi.unstubAllGlobals()
  delete (window as { Telegram?: unknown }).Telegram
})

describe('админка не падает в серый экран', () => {
  it('суммы: минус, дробь и отсутствие значения не роняют форматирование', () => {
    expect(safeAmount(-1500)).toBe('−1.5')
    expect(ton(undefined)).toBe('0 TON')
    expect(ton(2500.7)).toBe('2.5 TON')
    expect(signedTon(null)).toBe('+0 TON')
    expect(signedTon(-500)).toBe('−0.5 TON')
  })

  it('«Игроки» принимают и старый ответ сервера (массив) и строки без полей', async () => {
    adminFetch.mockResolvedValue({ ok: true, data: [{ id: '5', name: null, wagered: 0, delta: -300 }] })
    const { AdminPlayersTab } = await import('./AdminPlayersTab')
    render(<AdminPlayersTab />)
    expect(await screen.findByRole('button', { name: /ID 5/ })).toBeInTheDocument()
  })

  it('карточка игрока с неполным ответом показывается, а не падает', async () => {
    adminFetch.mockResolvedValue({ ok: true, data: { profile: { id: '9', name: 'Оля' } } })
    const { AdminPlayerCard } = await import('./AdminPlayerCard')
    render(<AdminPlayerCard telegramId="9" onBack={() => undefined} onOpen={() => undefined} />)
    expect(await screen.findByText('Оля')).toBeInTheDocument()
    expect(screen.getByText('Ещё не играл')).toBeInTheDocument()
  })

  it('«Обзор» без массивов в ответе тоже открывается', async () => {
    ;(window as { Telegram?: unknown }).Telegram = { WebApp: { initData: 'x', initDataUnsafe: {} } }
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ users_total: 3, house_profit: -100, wagered: 0 }) })))
    const { AdminStatsTab } = await import('./AdminStatsTab')
    render(<AdminStatsTab />)
    expect(await screen.findByText('Всего в боте (открывали приложение)')).toBeInTheDocument()
  })

  it('если раздел всё же упал — видно ошибку и есть «Назад»', async () => {
    const onBack = vi.fn()
    const Boom = () => {
      throw new Error('что-то сломалось')
    }
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <AdminErrorBoundary resetKey="x" onBack={onBack}>
        <Boom />
      </AdminErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('что-то сломалось')
    await userEvent.click(screen.getByRole('button', { name: /Назад к разделам/ }))
    expect(onBack).toHaveBeenCalled()
  })
})
