import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CrashMiniAdminModal } from './CrashMiniAdminModal'
import {
  setAdminNextCrashPoint,
  getAdminCrashState,
  _resetCrashForTests,
} from '../../services/demoCrashService'

describe('CrashMiniAdminModal (@zapixxgarant only)', () => {
  beforeEach(() => {
    _resetCrashForTests()
    localStorage.clear()
  })

  it('не рендерится для обычного пользователя без прав админа', () => {
    const { container } = render(<CrashMiniAdminModal open={true} onClose={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('рендерится при наличии флага администратора в localStorage', () => {
    localStorage.setItem('sexydrop_admin', 'true')
    render(<CrashMiniAdminModal open={true} onClose={() => {}} />)

    expect(screen.getByText(/Управление Ракеткой \(Admin\)/i)).toBeInTheDocument()
    expect(screen.getByText('Выдать TON')).toBeInTheDocument()
    expect(screen.getByText('Задать краш следующего раунда')).toBeInTheDocument()
  })

  it('устанавливает запланированную точку краша через быстрые кнопки', async () => {
    localStorage.setItem('sexydrop_admin', 'true')
    const user = userEvent.setup()
    render(<CrashMiniAdminModal open={true} onClose={() => {}} />)

    const btn5x = screen.getByRole('button', { name: 'x5.00' })
    await user.click(btn5x)

    const state = getAdminCrashState()
    expect(state.nextOverride).toBe(5.0)
  })

  it('сбрасывает переопределение краша на рандом', async () => {
    setAdminNextCrashPoint(10.0)
    expect(getAdminCrashState().nextOverride).toBe(10.0)

    localStorage.setItem('sexydrop_admin', 'true')
    const user = userEvent.setup()
    render(<CrashMiniAdminModal open={true} onClose={() => {}} />)

    const btnRandom = screen.getByRole('button', { name: 'Рандом' })
    await user.click(btnRandom)

    expect(getAdminCrashState().nextOverride).toBeNull()
  })
})
