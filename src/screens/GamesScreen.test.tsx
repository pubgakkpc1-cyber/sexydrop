import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { GamesScreen } from './GamesScreen'
import { useGamesHistoryStore } from '../store/gamesHistory'

const user = userEvent.setup()

function renderHub() {
  return render(
    <MemoryRouter initialEntries={['/games']}>
      <Routes>
        <Route path="/games" element={<GamesScreen />} />
        <Route path="/games/crash" element={<div>CRASH-ROUTE</div>} />
        <Route path="/games/upgrade" element={<div>UPGRADE-ROUTE</div>} />
        <Route path="/games/plinko" element={<div>PLINKO-ROUTE</div>} />
        <Route path="/games/craft" element={<div>CRAFT-ROUTE</div>} />
        <Route path="/games/dice" element={<div>DICE-ROUTE</div>} />
        <Route path="/games/mines" element={<div>MINES-ROUTE</div>} />
        <Route path="/games/spins" element={<div>SPINS-ROUTE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useGamesHistoryStore.setState({ entries: [] })
})

describe('GamesScreen (PLAY HUB по кадру frame_126)', () => {
  it('баннер «Улучшение» (ХИТ, кольцо 24%), Ракетка и Мины; Плинко, Спины, Дайс и Крафт временно скрыты', () => {
    renderHub()
    expect(screen.getByRole('button', { name: /Улучшение — выбери подарок мечты/ })).toBeInTheDocument()
    expect(screen.getByText(/ХИТ/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ракетка — забери до краша/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Мины — обойди мины/ })).toBeInTheDocument()

    // Временно скрытые разделы (lib/features)
    expect(screen.queryByRole('button', { name: /Плинко/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Спины/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Дайс/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Крафт/ })).not.toBeInTheDocument()

    expect(screen.queryByText('скоро')).not.toBeInTheDocument()
    // Честная заметка хаба
    expect(screen.getByText(/Все мини-игры работают с честной отдачей/)).toBeInTheDocument()
  })

  it('баннер «Улучшение» ведёт на /games/upgrade', async () => {
    renderHub()
    await user.click(screen.getByRole('button', { name: /Улучшение/ }))
    expect(screen.getByText('UPGRADE-ROUTE')).toBeInTheDocument()
  })

  it('плитки «Ракетка» и «Мины» ведут на свои экраны', async () => {
    const first = renderHub()
    await user.click(screen.getByRole('button', { name: /Ракетка/ }))
    expect(screen.getByText('CRASH-ROUTE')).toBeInTheDocument()
    first.unmount()

    renderHub()
    await user.click(screen.getByRole('button', { name: /Мины/ }))
    expect(screen.getByText('MINES-ROUTE')).toBeInTheDocument()
  })

  it('история ставок скрыта без записей и показана при наличии', () => {
    const { rerender } = renderHub()
    expect(screen.queryByRole('region', { name: 'История ставок' })).not.toBeInTheDocument()

    useGamesHistoryStore.getState().push({
      game: 'Ракетка',
      stakeLabel: '0.1 GRAM',
      outcome: 'won',
      deltaMinor: 410,
      detail: 'x1.51',
    })
    rerender(
      <MemoryRouter initialEntries={['/games']}>
        <Routes>
          <Route path="/games" element={<GamesScreen />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole('region', { name: 'История ставок' })).toBeInTheDocument()
    expect(screen.getByText('+0.41 TON')).toBeInTheDocument()
  })
})
