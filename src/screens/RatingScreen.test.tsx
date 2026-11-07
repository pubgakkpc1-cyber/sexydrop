import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RatingScreen, formatPoints } from './RatingScreen'
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
  it('без ботов: пустая таблица с подсказкой, пока вы не играли', () => {
    render(<RatingScreen />)
    expect(screen.getByRole('heading', { name: 'Рейтинг' })).toBeInTheDocument()
    expect(screen.queryByText('Заканчивается через')).not.toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(screen.getByText('Топ-20 игроков')).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Рейтинг игроков' })
    expect(within(list).queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.getByText(/Пока в рейтинге никого нет/)).toBeInTheDocument()
  })

  it('без игры нет ни «999+», ни строки «ВЫ» — пока пользователей нет, показывать нечего', () => {
    render(<RatingScreen />)
    expect(screen.queryByLabelText('Ваше место')).not.toBeInTheDocument()
    expect(screen.queryByText('999+')).not.toBeInTheDocument()
  })

  it('реальная статистика: очки = оборот × 100, в таблице только вы', () => {
    useProfileStore.setState({ rounds: 12, wageredMinor: 800_000, netMinor: -2_300, pvpMatches: 3 })
    render(<RatingScreen />) // 800 TON оборота = 80K очков
    const list = screen.getByRole('list', { name: 'Рейтинг игроков' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(1)
    expect(within(items[0]!).getByText('Вы')).toBeInTheDocument()
    expect(within(items[0]!).getByText('80.0K')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Ваше место')).getByText('1')).toBeInTheDocument()
    expect(screen.getByText(/PVP-матчей: 3/)).toBeInTheDocument()
  })
})

describe('RatingScreen: топ-20 с сервера', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('показывает имена из Telegram и аватарки, без @username', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          rows: [
            { rank: 1, name: 'Иван Петров', avatar: 'https://t.me/i/userpic/320/ivan.svg', points: 5000, me: false },
            { rank: 2, name: 'Маша', avatar: null, points: 0, me: false },
          ],
          me: null,
          total: 2,
        }),
      })),
    )
    render(<RatingScreen />)
    const list = screen.getByRole('list', { name: 'Рейтинг игроков' })
    expect(await within(list).findByText('Иван Петров')).toBeInTheDocument()
    expect(within(list).getByText('Маша')).toBeInTheDocument()
    expect(list.querySelector('img')).toHaveAttribute('src', 'https://t.me/i/userpic/320/ivan.svg')
    expect(within(list).getByText('М')).toBeInTheDocument() // без фото — инициалы
    expect(within(list).queryByText(/@/)).not.toBeInTheDocument()
  })
})

describe('форматтеры рейтинга', () => {
  it('formatPoints — максимум один знак после точки, вниз', () => {
    expect(formatPoints(29_650_000)).toBe('29.6M')
    expect(formatPoints(84_000)).toBe('84.0K')
    expect(formatPoints(999)).toBe('999')
    expect(formatPoints(0)).toBe('0')
  })

  it('описание очков скрыто и раскрывается по нажатию', async () => {
    render(<RatingScreen />)
    expect(screen.queryByText(/100 очков за 1 TON/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Что за очки/ }))
    expect(screen.getByText(/100 очков за 1 TON/)).toBeInTheDocument()
  })
})
