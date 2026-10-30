import { describe, it, expect, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { MoneyRain } from './MoneyRain'
import styles from './MoneyRain.module.css'

describe('MoneyRain component', () => {
  it('renders money particles and calls onComplete after duration', () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    const { container } = render(<MoneyRain onComplete={onComplete} durationMs={2000} />)

    expect(container.querySelector('[aria-hidden="true"]')).toBeInTheDocument()
    const particles = container.querySelectorAll(`.${styles.particle}`)
    expect(particles.length).toBe(14)

    act(() => {
      vi.advanceTimersByTime(1999)
    })
    expect(onComplete).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(2)
    })
    expect(onComplete).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })
})
