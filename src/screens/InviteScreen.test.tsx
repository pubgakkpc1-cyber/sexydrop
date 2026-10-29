import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InviteScreen, REFERRAL_BOT_USERNAME } from './InviteScreen'
import type { TelegramUser } from '../lib/telegram'

const user = userEvent.setup()

/** Подмена Telegram-окружения (window.Telegram) для конкретного теста. */
function setTelegramUser(userValue: TelegramUser | undefined): void {
  if (userValue === undefined) {
    delete (window as { Telegram?: unknown }).Telegram
    return
  }
  ;(window as { Telegram?: unknown }).Telegram = {
    WebApp: {
      initDataUnsafe: { user: userValue },
      ready: () => undefined,
      expand: () => undefined,
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

describe('InviteScreen (6.5: честный код, без фиктивной статистики)', () => {
  it('вне Telegram — честный placeholder вместо кода, правила TIER 7', () => {
    render(<InviteScreen />)
    expect(screen.getByText('Пригласить')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText(/Откройте мини-апп в Telegram/)).toBeInTheDocument()
    expect(screen.getByText(/Фиктивные коды и счётчики запрещены/)).toBeInTheDocument()
    expect(screen.getByText(/Реферальная программа/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Скопировать/ })).not.toBeInTheDocument()
  })

  it('в Telegram: код ref-<id> и ссылка на подтверждённого бота', () => {
    setTelegramUser({ id: 4242, first_name: 'Test' })
    render(<InviteScreen />)
    expect(screen.getByText('ref-4242')).toBeInTheDocument()
    expect(
      screen.getByText(`https://t.me/${REFERRAL_BOT_USERNAME}?start=ref-4242`),
    ).toBeInTheDocument()
    expect(REFERRAL_BOT_USERNAME).toBe('ewfowfwfowbot')
    expect(screen.getByRole('button', { name: 'Скопировать ссылку' })).toBeEnabled()
  })

  it('копирование ссылки через clipboard, подтверждение на кнопке', async () => {
    setTelegramUser({ id: 77, first_name: 'A' })
    const writeText = stubClipboard()
    render(<InviteScreen />)

    await user.click(screen.getByRole('button', { name: 'Скопировать ссылку' }))
    expect(writeText).toHaveBeenCalledWith(
      `https://t.me/${REFERRAL_BOT_USERNAME}?start=ref-77`,
    )
    await waitFor(() => expect(screen.getByText('Скопировано')).toBeInTheDocument())
  })
})
