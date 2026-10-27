import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from './Input'

describe('Input', () => {
  it('связывает label с полем', () => {
    render(<Input label="Ставка" placeholder="0.00" />)
    expect(screen.getByLabelText('Ставка')).toBeInTheDocument()
  })

  it('показывает hint и связывает его через aria-describedby', () => {
    render(<Input label="Ник" hint="Виден другим игрокам" />)
    const input = screen.getByLabelText('Ник')
    expect(input).toHaveAccessibleDescription('Виден другим игрокам')
  })

  it('ошибка заменяет hint и включает aria-invalid', () => {
    render(<Input label="Ставка" hint="служебный hint" error="Недостаточно средств" />)
    const input = screen.getByLabelText('Ставка')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Недостаточно средств')
    expect(screen.queryByText('служебный hint')).not.toBeInTheDocument()
  })

  it('принимает ввод и показывает suffix', async () => {
    render(<Input label="Сумма" suffix="₽" inputMode="decimal" />)
    const input = screen.getByLabelText('Сумма')
    await userEvent.type(input, '12.5')
    expect(input).toHaveValue('12.5')
    expect(screen.getByText('₽')).toBeInTheDocument()
  })
})
