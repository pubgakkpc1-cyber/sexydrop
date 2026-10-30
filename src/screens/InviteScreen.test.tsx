import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InviteScreen, REFERRAL_BOT_USERNAME, REFERRAL_RULES } from './InviteScreen'
import type { TelegramUser } from '../lib/telegram'

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
    expect(
      screen.getByRole('heading', { name: new RegExp(`до ${REFERRAL_RULES.percent}% приглашая`) }),
    ).toBeInTheDocument()
    expect(screen.getByText('с их пополнений')).toBeInTheDocument()
    expect(screen.getByText(`но не более ${REFERRAL_RULES.dailyTicketsLimit} в день`)).toBeInTheDocument()
    expect(screen.getByText('Всего заработано')).toBeInTheDocument()
    expect(screen.getByText(`0 / ${REFERRAL_RULES.dailyTicketsLimit}`)).toBeInTheDocument()
    expect(screen.getByText('Мои рефералы')).toBeInTheDocument()
    expect(screen.getByText('Пока нет приглашений')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Пригласить друзей/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Скопировать ссылку/ })).toBeDisabled()
    expect(screen.getByText(/Откройте мини-апп в Telegram/)).toBeInTheDocument()
  })

  it('кнопка «?» раскрывает правила программы', async () => {
    render(<InviteScreen />)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Как это работает' }))
    expect(screen.getByRole('note')).toHaveTextContent(/Начисления считает сервер/)
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
    expect(writeText).toHaveBeenCalledWith(
      `https://t.me/${REFERRAL_BOT_USERNAME}?start=ref-77`,
    )
    await waitFor(() => expect(screen.getByText('Скопировано')).toBeInTheDocument())
  })

  it('«Пригласить друзей» открывает окно «Поделиться» Telegram со ссылкой', async () => {
    const openTelegramLink = vi.fn()
    setTelegramUser({ id: 5, first_name: 'B' }, { platform: 'ios', openTelegramLink })
    render(<InviteScreen />)

    await user.click(screen.getByRole('button', { name: /Пригласить друзей/ }))
    expect(openTelegramLink).toHaveBeenCalledTimes(1)
    const url = String(openTelegramLink.mock.calls[0]?.[0])
    expect(url.startsWith('https://t.me/share/url?url=')).toBe(true)
    expect(decodeURIComponent(url)).toContain(`https://t.me/${REFERRAL_BOT_USERNAME}?start=ref-5`)
  })
})
