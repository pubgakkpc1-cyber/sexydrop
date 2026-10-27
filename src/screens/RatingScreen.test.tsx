import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RatingScreen } from './RatingScreen'
import { useProfileStore } from '../store/profile'
import { useTicketsStore } from '../store/tickets'
import { useQuestsStore } from '../store/quests'
import { useGamesHistoryStore } from '../store/gamesHistory'
import { usePvpMatchesStore } from '../store/pvpMatches'

beforeEach(() => {
  useProfileStore.setState({ rounds: 0, wageredMinor: 0, netMinor: 0, pvpMatches: 0 })
  useTicketsStore.setState({ balance: 0, creditedWageredMinor: 0, accruedTickets: 0 })
  useQuestsStore.setState({ claimed: {} })
  useGamesHistoryStore.setState({ entries: [] })
  usePvpMatchesStore.setState({ entries: [] })
})

describe('RatingScreen (6.1: реальные данные, без синтетики)', () => {
  it('empty-state без раундов + честная заметка о TIER 7', () => {
    render(<RatingScreen />)
    expect(screen.getByText('Рейтинг')).toBeInTheDocument()
    expect(screen.getByText('Данных пока нет')).toBeInTheDocument()
    expect(screen.getByText(/Сыграйте раунд в PLAY/)).toBeInTheDocument()
    expect(screen.getByText(/фиктивные игроки запрещены спецификацией/)).toBeInTheDocument()
    expect(screen.getByText(/TIER 7/)).toBeInTheDocument()
  })

  it('таблица показывает реальную статистику профиля (вы после раундов)', () => {
    useProfileStore.setState({
      rounds: 12,
      wageredMinor: 15_000,
      netMinor: -2_300,
      pvpMatches: 3,
    })
    render(<RatingScreen />)
    expect(screen.getByRole('table', { name: 'Рейтинг игроков' })).toBeInTheDocument()
    expect(screen.getByText('Вы')).toBeInTheDocument()
    expect(screen.getByText('реальные данные')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument() // раунды
    expect(screen.getByText('15 TON')).toBeInTheDocument() // оборот
    expect(screen.getByText('−2.3 TON')).toBeInTheDocument() // профит (со знаком)
    expect(screen.getByText(/PVP-матчей: 3/)).toBeInTheDocument()
    expect(screen.getByText(/ставки подарками/)).toBeInTheDocument()
  })

  it('профит со знаком плюс отображается корректно', () => {
    useProfileStore.setState({ rounds: 5, wageredMinor: 8_000, netMinor: 1_250 })
    render(<RatingScreen />)
    expect(screen.getByText('+1.25 TON')).toBeInTheDocument()
  })
})
