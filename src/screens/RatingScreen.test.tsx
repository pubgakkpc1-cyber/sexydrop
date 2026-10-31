import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { RatingScreen, formatCountdown, formatPoints, maskName } from './RatingScreen'
import { useProfileStore } from '../store/profile'
import { useQuestsStore } from '../store/quests'
import { useGamesHistoryStore } from '../store/gamesHistory'
import { usePvpMatchesStore } from '../store/pvpMatches'

beforeEach(() => {
  useProfileStore.setState({ rounds: 0, wageredMinor: 0, netMinor: 0, pvpMatches: 0 })
  useQuestsStore.setState({ claimed: {} })
  useGamesHistoryStore.setState({ entries: [] })
  usePvpMatchesStore.setState({ entries: [] })
})

describe('RatingScreen (матовый рейтинг по референсу)', () => {
  it('без плашки сезона (временно скрыта), заголовок списка и 10 мест с призами', () => {
    render(<RatingScreen />)
    expect(screen.getByRole('heading', { name: 'Рейтинг' })).toBeInTheDocument()
    expect(screen.queryByText('Заканчивается через')).not.toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(screen.getByText('Топ игроков')).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Рейтинг игроков' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(10)
  })

  it('без раундов закреплённая строка «ВЫ» показывает 999+ и пустой приз', () => {
    render(<RatingScreen />)
    const bar = screen.getByLabelText('Ваше место')
    expect(within(bar).getByText('999+')).toBeInTheDocument()
    expect(within(bar).getByText('ВЫ')).toBeInTheDocument()
    expect(within(bar).getByLabelText('Без приза')).toBeInTheDocument()
  })

  it('реальная статистика: очки = оборот × 100, вы попадаете в таблицу по месту', () => {
    useProfileStore.setState({ rounds: 12, wageredMinor: 800_000, netMinor: -2_300, pvpMatches: 3 })
    render(<RatingScreen />) // 800 TON оборота = 80K очков → 2 место после 84K
    const list = screen.getByRole('list', { name: 'Рейтинг игроков' })
    const items = within(list).getAllByRole('listitem')
    expect(within(items[1]!).getByText('Вы')).toBeInTheDocument()
    expect(within(items[1]!).getByText('80.0K')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Ваше место')).getByText('2')).toBeInTheDocument()
    expect(screen.getByText(/PVP-матчей: 3/)).toBeInTheDocument()
  })
})

describe('форматтеры рейтинга', () => {
  it('maskName скрывает середину ника', () => {
    expect(maskName('kamronbek')).toBe('ka***ek')
    expect(maskName('abc')).toBe('a***')
  })

  it('formatPoints — максимум один знак после точки, вниз', () => {
    expect(formatPoints(29_650_000)).toBe('29.6M')
    expect(formatPoints(84_000)).toBe('84.0K')
    expect(formatPoints(999)).toBe('999')
    expect(formatPoints(0)).toBe('0')
  })

  it('formatCountdown: «2d 2h 40m 4s»', () => {
    expect(formatCountdown(((2 * 24 + 2) * 3600 + 40 * 60 + 4) * 1000)).toBe('2d 2h 40m 4s')
    expect(formatCountdown(-5)).toBe('0d 0h 0m 0s')
  })
})
