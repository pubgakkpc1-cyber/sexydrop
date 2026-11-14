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

  it('показывает бренд и не показывает приветствие', () => {
    render(<SplashScreen onFinish={vi.fn()} />)
    expect(screen.getByText('SEXY DROP Mini App')).toBeInTheDocument()
    expect(screen.queryByText(/Привет/)).not.toBeInTheDocument()
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

  it('автоматически завершает загрузку и вызывает onFinish через 2.8с', async () => {
    const onFinish = vi.fn()
    render(<SplashScreen onFinish={onFinish} />)

    // сначала ждём готовности окна (шрифты, разворот на весь экран), затем идёт анимация
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000)
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(450)
    })

    expect(onFinish).toHaveBeenCalled()
  })
})
