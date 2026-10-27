import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Card } from './Card'

describe('Card', () => {
  it('рендерит содержимое', () => {
    render(<Card>Контент</Card>)
    expect(screen.getByText('Контент')).toBeInTheDocument()
  })

  it('применяет padding и interactive классы', () => {
    render(
      <Card padding="lg" interactive data-testid="card">
        x
      </Card>,
    )
    const className = screen.getByTestId('card').className
    expect(className).toMatch(/lg/)
    expect(className).toMatch(/interactive/)
  })

  it('интерактивная карточка обрабатывает клик', async () => {
    const onClick = vi.fn()
    render(
      <Card interactive onClick={onClick}>
        нажми
      </Card>,
    )
    await userEvent.click(screen.getByText('нажми'))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
