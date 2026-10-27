import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from './Modal'

describe('Modal', () => {
  it('в закрытом состоянии ничего не рендерит', () => {
    render(
      <Modal open={false} onClose={() => {}}>
        Содержимое
      </Modal>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('открытая модалка — портал с диалогом и заголовком', () => {
    render(
      <Modal open onClose={() => {}} title="Подтверждение">
        Содержимое
      </Modal>,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Подтверждение')).toBeInTheDocument()
    expect(screen.getByText('Содержимое')).toBeInTheDocument()
  })

  it('закрывается по Escape', async () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose}>
        x
      </Modal>,
    )
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('клик по фону закрывает, клик внутри панели — нет', async () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose}>
        <button>внутри</button>
      </Modal>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'внутри' }))
    expect(onClose).not.toHaveBeenCalled()
    await userEvent.click(document.querySelector('[class*="backdrop"]') as Element)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('блокирует скролл body и восстанавливает при размонтировании', () => {
    const { unmount } = render(
      <Modal open onClose={() => {}}>
        x
      </Modal>,
    )
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('есть кнопка закрытия с доступным именем', async () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Тайтл">
        x
      </Modal>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Закрыть' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
