import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { GameTopBar } from './GameTopBar'
import { useWalletStore } from '../../store/wallet'
import { useGraphicsStore } from '../../store/graphics'

describe('GameTopBar (панель Ракетки и мини-игр)', () => {
  it('показывает баланс и меняет качество графики через шестерёнку', async () => {
    useWalletStore.setState({ mode: 'demo', balances: { demo: 20, real: 0 } })
    useGraphicsStore.setState({ quality: 'medium' })
    render(
      <MemoryRouter>
        <GameTopBar />
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: /Баланс 0\.02/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Настройки графики' }))
    expect(screen.getByText('ГРАФИКА')).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: /Средняя/ })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('menuitemradio', { name: /Минимальная/ }))
    expect(document.documentElement.dataset.gfx).toBe('low')
    expect(useGraphicsStore.getState().quality).toBe('low')
    useGraphicsStore.setState({ quality: 'medium' })
  })
})
