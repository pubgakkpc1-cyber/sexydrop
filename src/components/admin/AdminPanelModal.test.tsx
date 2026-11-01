import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminPanelModal } from './AdminPanelModal'
import { previewHtml } from './AdminBroadcastTab'

describe('AdminPanelModal', () => {
  it('главная — карточки разделов, раздел открывается и закрывается кнопкой Назад', async () => {
    render(<AdminPanelModal open onClose={() => {}} />)
    for (const name of ['Обзор', 'Игроки', 'Шансы кейсов', 'Рассылка', 'Выдача TON', 'Система']) {
      expect(within(screen.getByRole('navigation')).getByRole('button', { name: new RegExp(`^${name}`) })).toBeInTheDocument()
    }
    await userEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /^Рассылка/ }))
    expect(screen.getByLabelText('Текст рассылки')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Назад к разделам' }))
    expect(screen.getByRole('navigation', { name: 'Разделы админки' })).toBeInTheDocument()
  })

  it('превью рассылки экранирует HTML и пропускает только простые теги', () => {
    expect(previewHtml('<b>да</b> <script>x</script> <a href="y">z</a>')).toBe(
      '<b>да</b> &lt;script&gt;x&lt;/script&gt; &lt;a href="y"&gt;z&lt;/a&gt;',
    )
  })
})
