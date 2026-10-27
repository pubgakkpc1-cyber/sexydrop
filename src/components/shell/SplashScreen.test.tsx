import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { SplashScreen } from './SplashScreen'

describe('SplashScreen (Моушн-загрузка и аватар)', () => {
  const originalTelegram = window.Telegram

  beforeEach(() => {
    vi.useFakeTimers()
    delete (window as unknown as { Telegram?: unknown }).Telegram
  })

  afterEach(() => {
    vi.useRealTimers()
    if (originalTelegram) {
      window.Telegram = originalTelegram
    } else {
      delete (window as unknown as { Telegram?: unknown }).Telegram
    }
  })

  it('рендерит дефолтное приветствие если пользователь не авторизован', () => {
    render(<SplashScreen onFinish={vi.fn()} />)
    expect(screen.getByText(/Привет, Игрок!/)).toBeInTheDocument()
    expect(screen.getByText('SEXY DROP Mini App')).toBeInTheDocument()
  })

  it('рендерит персональное приветствие с именем Telegram пользователя', () => {
    window.Telegram = {
      WebApp: {
        initDataUnsafe: {
          user: { id: 777, first_name: 'Александр' },
        },
      } as never,
    }

    render(<SplashScreen onFinish={vi.fn()} />)
    expect(screen.getByText(/Привет, Александр!/)).toBeInTheDocument()
  })

  it('вызывает onFinish по клику для быстрого пропуска', () => {
    const onFinish = vi.fn()
    render(<SplashScreen onFinish={onFinish} />)

    const splash = screen.getByRole('status')
    fireEvent.click(splash)

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(onFinish).toHaveBeenCalled()
  })

  it('автоматически завершает загрузку и вызывает onFinish через 1.8с', () => {
    const onFinish = vi.fn()
    render(<SplashScreen onFinish={onFinish} />)

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    act(() => {
      vi.advanceTimersByTime(450)
    })

    expect(onFinish).toHaveBeenCalled()
  })
})
