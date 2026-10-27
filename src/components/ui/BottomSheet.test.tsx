import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { BottomSheet } from './BottomSheet'

describe('BottomSheet (спека 5.4/9: панель снизу)', () => {
  it('открыт: role="dialog", aria-modal, контент на месте; закрыт — не рендерится', () => {
    const { rerender } = render(
      <BottomSheet open onClose={vi.fn()} title="Тест">
        <p>Содержимое шита</p>
      </BottomSheet>,
    )
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Содержимое шита')).toBeInTheDocument()
    rerender(
      <BottomSheet open={false} onClose={vi.fn()} title="Тест">
        <p>Содержимое шита</p>
      </BottomSheet>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Esc и клик по фону закрывают', () => {
    const onClose = vi.fn()
    const { unmount } = render(
      <BottomSheet open onClose={onClose} title="Тест">
        <p>Содержимое</p>
      </BottomSheet>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    const backdrop = screen.getByRole('dialog').parentElement
    if (!backdrop) throw new Error('Ожидается backdrop')
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(2)
    unmount()
  })

  it('клик по содержимому не закрывает (только фон)', () => {
    const onClose = vi.fn()
    const { unmount } = render(
      <BottomSheet open onClose={onClose} title="Тест">
        <p>Содержимое</p>
      </BottomSheet>,
    )
    fireEvent.click(screen.getByText('Содержимое'))
    expect(onClose).not.toHaveBeenCalled()
    unmount()
  })
})
