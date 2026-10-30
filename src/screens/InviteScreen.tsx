import { useMemo, useState } from 'react'
import { getTelegramUser, isTelegramEnv, shareTelegramLink } from '../lib/telegram'
import {
  CheckIcon,
  CopyIcon,
  HelpIcon,
  ShareIcon,
  TicketIcon,
  TonIcon,
  UsersIcon,
} from '../components/shell/icons'
import styles from './InviteScreen.module.css'

/** Бот мини-аппа (username публичный; подтверждён через Bot API getMe). */
export const REFERRAL_BOT_USERNAME = 'ewfowfwfowbot'

/** Условия реферальной программы (настройка продукта; начисляет их сервер — TIER 7). */
export const REFERRAL_RULES = {
  percent: 10,
  ticketsPerFriend: 5,
  dailyTicketsLimit: 50,
} as const

/**
 * Вкладка «Пригласить» (6.5). Персональный код = ID пользователя Telegram,
 * ссылка на бота с параметром start. Статистика приглашённых и начисления за
 * друзей считаются ТОЛЬКО сервером по журналу (TIER 7): до этого честно нули.
 */
export function InviteScreen() {
  const tgUser = getTelegramUser()
  const [copied, setCopied] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  const code = useMemo(() => {
    if (tgUser?.id === undefined) return null
    return `ref-${tgUser.id}`
  }, [tgUser])

  const link = useMemo(
    () => (code === null ? null : `https://t.me/${REFERRAL_BOT_USERNAME}?start=${code}`),
    [code],
  )
  const ready = isTelegramEnv() && link !== null

  const copy = async () => {
    if (link === null) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard может быть запрещён — ссылку можно скопировать вручную */
    }
  }

  const share = () => {
    if (link === null) return
    shareTelegramLink(link, 'Залетай в SEXY DROP — кейсы, ракета и призы!')
  }

  return (
    <div className={styles.screen}>
      <section className={styles.hero} aria-label="Реферальная программа">
        <span className={styles.heroIcon}>
          <UsersIcon className={styles.heroIconSvg} aria-hidden />
        </span>
        <div className={styles.heroBody}>
          <h1 className={styles.title}>
            Зарабатывай до <span className={styles.accent}>{REFERRAL_RULES.percent}%</span> приглашая
            друзей
          </h1>
          <p className={styles.sub}>с их пополнений</p>
          <p className={styles.bonus}>
            А также по
            <span className={styles.ticketChip}>
              <TicketIcon className={styles.ticketIcon} aria-hidden />
              {REFERRAL_RULES.ticketsPerFriend}
            </span>
            за каждого
          </p>
          <p className={styles.limit}>но не более {REFERRAL_RULES.dailyTicketsLimit} в день</p>
        </div>
        <button
          type="button"
          className={styles.help}
          aria-label="Как это работает"
          aria-expanded={helpOpen}
          onClick={() => setHelpOpen((v) => !v)}
        >
          <HelpIcon className={styles.helpIcon} />
        </button>
      </section>

      {helpOpen && (
        <div className={styles.rules} role="note">
          <strong>Реферальная программа</strong>
          <p>
            Друг переходит по вашей ссылке и запускает игру. Вы получаете до {REFERRAL_RULES.percent}%
            от его пополнений и по {REFERRAL_RULES.ticketsPerFriend} билетов за каждого нового друга
            (не более {REFERRAL_RULES.dailyTicketsLimit} билетов в день). Начисления считает сервер.
          </p>
        </div>
      )}

      <section className={styles.card} aria-label="Приглашение">
        <button type="button" className={styles.primary} disabled={!ready} onClick={share}>
          <ShareIcon className={styles.btnIcon} aria-hidden />
          Пригласить друзей
        </button>
        <button
          type="button"
          className={styles.secondary}
          disabled={!ready}
          onClick={() => void copy()}
        >
          {copied ? (
            <>
              <CheckIcon className={styles.btnIcon} aria-hidden />
              <span>Скопировано</span>
            </>
          ) : (
            <>
              <CopyIcon className={styles.btnIcon} aria-hidden />
              <span>Скопировать ссылку</span>
            </>
          )}
        </button>
        {!ready && (
          <p className={styles.hint}>
            Откройте мини-апп в Telegram — ссылка привяжется к вашему Telegram ID.
          </p>
        )}
      </section>

      <section className={styles.card} aria-label="Заработок">
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Всего заработано</span>
          <span className={styles.statValue}>
            0
            <TonIcon className={styles.statIcon} aria-hidden />
          </span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Сегодня заработано</span>
          <span className={styles.statValue}>
            0 / {REFERRAL_RULES.dailyTicketsLimit}
            <TicketIcon className={styles.statIcon} aria-hidden />
          </span>
        </div>
      </section>

      <section className={styles.card} aria-label="Мои рефералы">
        <div className={styles.refHead}>
          <h2 className={styles.refTitle}>Мои рефералы</h2>
          <span className={styles.refCount}>0</span>
        </div>
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>
            <UsersIcon className={styles.emptyIconSvg} aria-hidden />
          </span>
          <p className={styles.emptyText}>Пока нет приглашений</p>
        </div>
      </section>
    </div>
  )
}
