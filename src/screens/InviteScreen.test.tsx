import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InviteScreen, REFERRAL_BOT_USERNAME } from './InviteScreen'
import type { TelegramUser } from '../lib/telegram'
import { useRefBankStore } from '../store/refBank'
import { useStarsBalanceStore } from '../store/starsBalance'

const user = userEvent.setup()

/** Подмена Telegram-окружения (window.Telegram) для конкретного теста. */
function setTelegramUser(
  userValue: TelegramUser | undefined,
  extra: Record<string, unknown> = {},
): void {
  if (userValue === undefined) {
    delete (window as { Telegram?: unknown }).Telegram
    return
  }
  ;(window as { Telegram?: unknown }).Telegram = {
    WebApp: {
      initDataUnsafe: { user: userValue },
      ready: () => undefined,
      expand: () => undefined,
      ...extra,
    },
  }
}

let clipboardStub: { writeText: ReturnType<typeof vi.fn> } | undefined

beforeEach(() => {
  useRefBankStore.setState({ stars: 0, min: 15 })
  setTelegramUser(undefined)
  clipboardStub = undefined
})

afterEach(() => {
  setTelegramUser(undefined)
  if (clipboardStub !== undefined) {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    })
    clipboardStub = undefined
  }
  vi.restoreAllMocks()
})

function stubClipboard(): ReturnType<typeof vi.fn> {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
  clipboardStub = { writeText }
  return writeText
}

describe('InviteScreen (6.5: честные нули, без фиктивной статистики)', () => {
  it('условия программы и нули в статистике; вне Telegram кнопки недоступны', () => {
    render(<InviteScreen />)
    expect(screen.getByRole('heading', { name: /2 ★ за каждого друга/ })).toBeInTheDocument()
    expect(screen.getByText('как только он прокрутит бесплатный кейс')).toBeInTheDocument()
    const bank = screen.getByRole('region', { name: 'Банк звёзд' })
    expect(bank).toHaveTextContent('0/ 15')
    expect(bank).toHaveTextContent(/По ссылке: 0/)
    expect(screen.getByRole('button', { name: 'Забрать от 15 ★' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Пригласить друзей/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Скопировать ссылку/ })).toBeDisabled()
    expect(screen.getByText(/Откройте мини-апп в Telegram/)).toBeInTheDocument()
  })

  it('правила видны сразу: друг должен прокрутить бесплатный кейс, +2 ★ в банк, забрать от 15 ★', () => {
    render(<InviteScreen />)
    const rules = screen.getByRole('region', { name: 'Как это работает' })
    expect(rules).toHaveTextContent(/обязательно прокручивает бесплатный кейс/)
    expect(rules).toHaveTextContent(/звёзды не начисляются/)
    expect(rules).toHaveTextContent(/В банк падает \+2 ★ за друга \(один раз\)/)
    expect(rules).toHaveTextContent(/От 15 ★/)
  })

  it('правило чата: кнопка открывает чат SEXY DROP, история показывает плюсы и минусы с причиной', async () => {
    const openTelegramLink = vi.fn()
    setTelegramUser({ id: 9, first_name: 'C' }, { platform: 'ios', openTelegramLink })
    useRefBankStore.setState({
      stars: 2,
      min: 15,
      history: [
        { at: Date.now() - 60_000, d: -2, t: 'Оля не в чате SEXY DROP — звёзды за него сняты' },
        { at: Date.now() - 3_600_000, d: 2, t: 'Оля прокрутил бесплатный кейс' },
      ],
    })
    render(<InviteScreen />)
    expect(screen.getByRole('region', { name: 'Банк звёзд' })).toHaveTextContent(/в чате SEXY DROP/)
    await user.click(screen.getByRole('button', { name: 'Открыть чат' }))
    expect(openTelegramLink).toHaveBeenCalledWith('https://t.me/+hQUjqYtgmTA2NmQ0')
    const history = screen.getByLabelText('История банка')
    expect(history).toHaveTextContent('−2 ★')
    expect(history).toHaveTextContent('звёзды за него сняты')
    expect(history).toHaveTextContent('+2 ★')
  })

  it('банк полон — «Забрать» активна и переносит звёзды на баланс', async () => {
    useRefBankStore.setState({ stars: 18, min: 15 })
    useStarsBalanceStore.setState({ stars: 0 })
    render(<InviteScreen />)
    await user.click(screen.getByRole('button', { name: 'Забрать 18 ★' }))
    expect(await screen.findByRole('status')).toHaveTextContent('+18 ★ на баланс звёзд')
    expect(useStarsBalanceStore.getState().stars).toBe(18)
    expect(useRefBankStore.getState().stars).toBe(0)
  })

  it('в Telegram кнопки активны, ссылка ведёт на подтверждённого бота', () => {
    setTelegramUser({ id: 4242, first_name: 'Test' }, { platform: 'android' })
    render(<InviteScreen />)
    expect(REFERRAL_BOT_USERNAME).toBe('sexydropbot')
    expect(screen.getByRole('button', { name: /Пригласить друзей/ })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Скопировать ссылку/ })).toBeEnabled()
  })

  it('копирование ссылки через clipboard, подтверждение на кнопке', async () => {
    setTelegramUser({ id: 77, first_name: 'A' }, { platform: 'android' })
    const writeText = stubClipboard()
    render(<InviteScreen />)

    await user.click(screen.getByRole('button', { name: /Скопировать ссылку/ }))
    // сначала предупреждение во весь экран, ссылка ещё не скопирована
    expect(screen.getByRole('alertdialog', { name: 'Важно перед приглашением' })).toBeInTheDocument()
    expect(writeText).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Понятно, скопировать ссылку' }))
    expect(writeText).toHaveBeenCalledWith(
      `https://t.me/${REFERRAL_BOT_USERNAME}?startapp=ref-77`,
    )
    await waitFor(() => expect(screen.getByText('Скопировано')).toBeInTheDocument())
  })

  it('«Пригласить друзей» открывает окно «Поделиться» Telegram со ссылкой', async () => {
    const openTelegramLink = vi.fn()
    setTelegramUser({ id: 5, first_name: 'B' }, { platform: 'ios', openTelegramLink })
    render(<InviteScreen />)

    await user.click(screen.getByRole('button', { name: /Пригласить друзей/ }))
    const warn = screen.getByRole('alertdialog', { name: 'Важно перед приглашением' })
    expect(warn).toHaveTextContent(/только когда друг прокрутит бесплатный кейс/)
    expect(openTelegramLink).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Понятно, пригласить' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(openTelegramLink).toHaveBeenCalledTimes(1)
    const url = String(openTelegramLink.mock.calls[0]?.[0])
    expect(url.startsWith('https://t.me/share/url?url=')).toBe(true)
    expect(decodeURIComponent(url)).toContain(`https://t.me/${REFERRAL_BOT_USERNAME}?startapp=ref-5`)
  })

  it('«Отмена» закрывает предупреждение, ничего не отправляя', async () => {
    const openTelegramLink = vi.fn()
    setTelegramUser({ id: 6, first_name: 'C' }, { platform: 'ios', openTelegramLink })
    render(<InviteScreen />)
    await user.click(screen.getByRole('button', { name: /Пригласить друзей/ }))
    await user.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(openTelegramLink).not.toHaveBeenCalled()
  })
})
