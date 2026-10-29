import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GameHistory } from './GameHistory'
import { useGamesHistoryStore } from '../../store/gamesHistory'

beforeEach(() => {
  useGamesHistoryStore.setState({ entries: [] })
})

describe('GameHistory (4.3: общая история ставок)', () => {
  it('скрывается, пока ставок нет', () => {
    render(<GameHistory />)
    expect(screen.queryByRole('region', { name: 'История ставок' })).not.toBeInTheDocument()
  })

  it('показывает реальные записи: игра, исход, дельта со знаком, время', () => {
    useGamesHistoryStore.getState().push({
      game: 'Ракетка',
      stakeLabel: '0.1 GRAM',
      outcome: 'won',
      deltaMinor: 410,
      detail: 'x1.51',
    })
    useGamesHistoryStore.getState().push({
      game: 'Плинко',
      stakeLabel: '1 GRAM',
      outcome: 'lost',
      deltaMinor: -610,
      detail: 'карман 5/9 · x0.39',
    })
    render(<GameHistory />)

    const region = screen.getByRole('region', { name: 'История ставок' })
    expect(region).toBeInTheDocument()
    expect(screen.getByText('Выигрыш')).toBeInTheDocument()
    expect(screen.getByText('Проигрыш')).toBeInTheDocument()
    expect(screen.getByText('Ракетка')).toBeInTheDocument()
    expect(screen.getByText('Плинко')).toBeInTheDocument()
    expect(screen.getByText(/x1\.51/)).toBeInTheDocument()
    expect(screen.getByText(/карман 5\/9 · x0\.39/)).toBeInTheDocument()
    expect(screen.getByText('+0.41 TON')).toBeInTheDocument()
    expect(screen.getByText('−0.61 TON')).toBeInTheDocument()
    expect(screen.getByText(/История ваших последних раундов/)).toBeInTheDocument()
  })

  it('показывает не более 20 записей (новые в начале)', () => {
    for (let i = 0; i < 25; i += 1) {
      useGamesHistoryStore.getState().push({
        game: 'Апгрейд',
        stakeLabel: 'Fresh Socks',
        outcome: 'lost',
        deltaMinor: -50,
      })
    }
    render(<GameHistory />)
    const rows = screen.getByRole('region', { name: 'История ставок' }).querySelectorAll('time')
    expect(rows).toHaveLength(20)
  })
})
