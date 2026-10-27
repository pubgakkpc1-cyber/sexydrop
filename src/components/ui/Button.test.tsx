import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it('рендерит текст и обрабатывает клик', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Открыть</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Открыть' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('в состоянии loading заблокирована и помечена aria-busy', async () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Отправить
      </Button>,
    )
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('по умолчанию type="button", чтобы не сабмитить формы', () => {
    render(<Button>ок</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('применяет вариант, размер и fullWidth', () => {
    render(
      <Button variant="danger" size="lg" fullWidth>
        большая
      </Button>,
    )
    const className = screen.getByRole('button').className
    expect(className).toMatch(/danger/)
    expect(className).toMatch(/lg/)
    expect(className).toMatch(/fullWidth/)
  })
})
