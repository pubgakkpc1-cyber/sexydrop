import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const STATE = {
  season: { index: 0, starts_at: 1_800_000_000, ends_at: 1_800_000_000 + 30 * 86400, days: 30 },
  prizes: [
    { place: 1, ton_minor: 10000, nft: true },
    { place: 2, ton_minor: 10000, nft: false },
    { place: 3, ton_minor: 5000, nft: false },
  ],
  boards: {
    refs: { top: [{ rank: 1, name: 'Иван Петров', avatar: null, value: 7, me: false }], me: null, me_outside: null, players: 1 },
    turnover: {
      top: [
        { rank: 1, name: 'Маша', avatar: null, value: 12_400_000, me: false },
        { rank: 2, name: 'Вы', avatar: null, value: 800_000, me: true },
      ],
      me: { rank: 2, value: 800_000 },
      me_outside: null,
      players: 2,
    },
  },
}

const apiGet = vi.fn(async () => STATE)
vi.mock('../lib/api', () => ({ apiGet: (...a: unknown[]) => apiGet(...(a as [])) }))

import { RatingScreen, formatTurnover } from './RatingScreen'

describe('RatingScreen: марафон 30 дней', () => {
  it('показывает призы, переключатель рейтингов и топ с сервера', async () => {
    render(<RatingScreen />)
    expect(screen.getByRole('heading', { name: 'Рейтинг' })).toBeInTheDocument()
    expect(await screen.findByText('NFT + 10 TON')).toBeInTheDocument()
    expect(screen.getByText('5 TON')).toBeInTheDocument()
    expect(screen.getByText(/до конца:/)).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Рейтинг игроков' })
    expect(await within(list).findByText('Иван Петров')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Пригласить друга' })).toBeInTheDocument()
  })

  it('переключается на оборот в TON и показывает своё место', async () => {
    render(<RatingScreen />)
    await screen.findByText('Иван Петров')
    await userEvent.click(screen.getByRole('tab', { name: 'Оборот, TON' }))
    const list = screen.getByRole('list', { name: 'Рейтинг игроков' })
    expect(screen.queryByText('NFT + 10 TON')).not.toBeInTheDocument() // призы и таймер — только у рефералов
    expect(screen.queryByText(/до конца:/)).not.toBeInTheDocument()
    expect(within(list).getByText('12.4K')).toBeInTheDocument()
    expect(within(list).getByText('800.0')).toBeInTheDocument()
    expect(within(screen.getByLabelText('Ваше место')).getByText('2')).toBeInTheDocument()
  })

  it('правила скрыты и раскрываются по нажатию', async () => {
    render(<RatingScreen />)
    expect(screen.queryByText(/Марафон рефералов длится 30 дней/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Правила/ }))
    expect(screen.getByText(/Марафон рефералов длится 30 дней/)).toBeInTheDocument()
  })
})

describe('форматтер оборота', () => {
  it('максимум один знак после точки, вниз', () => {
    expect(formatTurnover(3_250_000_000)).toBe('3.2M')
    expect(formatTurnover(12_450_000)).toBe('12.4K')
    expect(formatTurnover(999_900)).toBe('999.9')
    expect(formatTurnover(0)).toBe('0.0')
  })
})
