import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { RatingScreen, formatTurnover } from './RatingScreen'
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

  it('реальная статистика: оборот в TON, в таблице только вы', () => {
    useProfileStore.setState({ rounds: 12, wageredMinor: 800_000, netMinor: -2_300, pvpMatches: 3 })
    render(<RatingScreen />) // 800 TON оборота
    const list = screen.getByRole('list', { name: 'Рейтинг игроков' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(1)
    expect(within(items[0]!).getByText('Вы')).toBeInTheDocument()
    expect(within(items[0]!).getByText('800.0')).toBeInTheDocument()
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
            { rank: 1, name: 'Иван Петров', avatar: 'https://t.me/i/userpic/320/ivan.svg', turnover_minor: 5_000_000, me: false },
            { rank: 2, name: 'Маша', avatar: null, turnover_minor: 0, me: false },
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
  it('formatTurnover — максимум один знак после точки, вниз', () => {
    expect(formatTurnover(3_250_000_000)).toBe('3.2M')
    expect(formatTurnover(12_450_000)).toBe('12.4K')
    expect(formatTurnover(999_900)).toBe('999.9')
    expect(formatTurnover(0)).toBe('0.0')
  })
})
