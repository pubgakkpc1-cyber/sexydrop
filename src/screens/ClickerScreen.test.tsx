import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const apiGet = vi.fn(async () => ({
  total: 100, month_clicks: 40, rank: 2, players: 3, month_ends_at: Math.floor(Date.now() / 1000) + 86_400, max_cps: 12,
  top: [
    { rank: 1, name: 'Иван', avatar: null, clicks: 900, me: false },
    { rank: 2, name: 'Оля', avatar: null, clicks: 40, me: true },
  ],
}))
const apiPost = vi.fn(async () => ({ accepted: 1, total: 101, month_clicks: 41 }))
vi.mock('../lib/api', () => ({ apiGet: (...a: unknown[]) => apiGet(...(a as [])), apiPost: (...a: unknown[]) => apiPost(...(a as [])) }))

import { ClickerScreen } from './ClickerScreen'

describe('ClickerScreen', () => {
  it('показывает счёт и топ, тап увеличивает счётчик', async () => {
    render(<ClickerScreen />)
    expect(await screen.findByText('Иван')).toBeInTheDocument()
    expect(screen.getByText('Оля (вы)')).toBeInTheDocument()
    expect(screen.getByTestId('clicks-total')).toHaveAttribute('aria-label', '100')
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Нажать' }))
    fireEvent.pointerUp(screen.getByRole('button', { name: 'Нажать' }))
    expect(screen.getByTestId('clicks-total')).toHaveAttribute('aria-label', '101')
  })
})
