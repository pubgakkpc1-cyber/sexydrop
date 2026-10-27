import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { giftById } from '../../data/catalog'
import { GiftCard } from './GiftCard'

const plush = giftById.get('plush-pepe')
const socks = giftById.get('fresh-socks')
if (!plush || !socks) throw new Error('Ожидаемые подарки отсутствуют в каталоге')

describe('GiftCard (3.2: карточки подарков)', () => {
  it('показывает название, редкость и цену из каталога', () => {
    render(<GiftCard gift={plush} />)
    expect(screen.getByTitle('Plush Pepe · Легендарный')).toBeInTheDocument()
    expect(screen.getByText('Легендарный')).toBeInTheDocument()
    // цена из каталога, не выдуманная: Plush Pepe = 25 GRAM
    expect(screen.getByText('25')).toBeInTheDocument()
  })

  it('помечает редкость data-rarity для стилей по токенам', () => {
    const { container, unmount } = render(<GiftCard gift={plush} />)
    expect(container.querySelector('[data-rarity="legendary"]')).not.toBeNull()
    unmount()
    const common = render(<GiftCard gift={socks} />)
    expect(common.container.querySelector('[data-rarity="common"]')).not.toBeNull()
    common.unmount()
  })

  it('показывает номер экземпляра, только если он известен', () => {
    const { rerender } = render(<GiftCard gift={plush} />)
    expect(screen.queryByText(/^#\d+$/)).not.toBeInTheDocument()
    rerender(<GiftCard gift={{ ...plush, serialNumber: 1337 }} />)
    expect(screen.getByText('#1337')).toBeInTheDocument()
  })

  it('с onClick корневой элемент — кнопка, клик обрабатывается', async () => {
    const onClick = vi.fn()
    const { rerender } = render(<GiftCard gift={plush} onClick={onClick} />)
    const card = screen.getByTitle('Plush Pepe · Легендарный')
    expect(card.tagName).toBe('BUTTON')
    await userEvent.click(card)
    expect(onClick).toHaveBeenCalledTimes(1)
    rerender(<GiftCard gift={plush} />)
    expect(screen.getByTitle('Plush Pepe · Легендарный').tagName).toBe('DIV')
  })
})
