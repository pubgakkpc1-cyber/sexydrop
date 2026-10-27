import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { UserAvatar } from './UserAvatar'

describe('UserAvatar', () => {
  const originalTelegram = window.Telegram

  beforeEach(() => {
    // Сброс Telegram WebApp
    delete (window as unknown as { Telegram?: unknown }).Telegram
  })

  afterEach(() => {
    if (originalTelegram) {
      window.Telegram = originalTelegram
    } else {
      delete (window as unknown as { Telegram?: unknown }).Telegram
    }
  })

  it('отображает инициал по умолчанию если данных Telegram нет', () => {
    render(<UserAvatar size={40} />)
    expect(screen.getByText('G')).toBeInTheDocument()
  })

  it('отображает первый символ имени пользователя', () => {
    window.Telegram = {
      WebApp: {
        initDataUnsafe: {
          user: { id: 12345, first_name: 'Павел' },
        },
      } as never,
    }

    render(<UserAvatar size={40} />)
    expect(screen.getByText('П')).toBeInTheDocument()
  })

  it('рендерит фото профиля если указан photo_url', () => {
    window.Telegram = {
      WebApp: {
        initDataUnsafe: {
          user: {
            id: 12345,
            first_name: 'Павел',
            photo_url: 'https://cdn.telegram.org/user123.jpg',
          },
        },
      } as never,
    }

    render(<UserAvatar size={40} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://cdn.telegram.org/user123.jpg')
  })

  it('переключается на инициал при ошибке загрузки фото профиля (onError)', () => {
    window.Telegram = {
      WebApp: {
        initDataUnsafe: {
          user: {
            id: 12345,
            first_name: 'Павел',
            photo_url: 'https://broken-url.com/img.jpg',
          },
        },
      } as never,
    }

    render(<UserAvatar size={40} />)
    const img = screen.getByRole('img')
    fireEvent.error(img)
    expect(screen.getByText('П')).toBeInTheDocument()
  })
})
