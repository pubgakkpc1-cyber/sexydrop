import { useMemo, useState } from 'react'
import { getTelegramUser, isTelegramEnv } from '../lib/telegram'
import { CheckIcon } from '../components/shell/icons'
import styles from './InviteScreen.module.css'

/** Бот мини-аппа (username публичный; подтверждён через Bot API getMe). */
export const REFERRAL_BOT_USERNAME = 'ewfowfwfowbot'

/**
 * Вкладка «Пригласить» (6.5). Честная Demo-реализация: персональный код =
 * ID пользователя Telegram (или честный placeholder вне Telegram), ссылка
 * на бота с параметром start. Статистика приглашённых и начисления за друзей
 * считаются ТОЛЬКО сервером по журналу (TIER 7) — никаких фиктивных счётчиков.
 */
export function InviteScreen() {
  const tgUser = getTelegramUser()
  const [copied, setCopied] = useState(false)

  const code = useMemo(() => {
    if (tgUser?.id === undefined) return null
    return `ref-${tgUser.id}`
  }, [tgUser])

  const link = useMemo(
    () => (code === null ? null : `https://t.me/${REFERRAL_BOT_USERNAME}?start=${code}`),
    [code],
  )

  const copy = async () => {
    if (link === null) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard может быть запрещён — код можно скопировать вручную */
    }
  }

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Пригласить</h1>
      <p className={styles.lead}>Реферальная система</p>

      {isTelegramEnv() && code !== null && link !== null ? (
        <div className={styles.codeCard}>
          <span className={styles.codeLabel}>Ваш код</span>
          <span className={styles.codeValue}>{code}</span>
          <span className={styles.linkLabel}>Ссылка на бота</span>
          <span className={styles.linkValue}>{link}</span>
          <button type="button" className={styles.copy} onClick={() => void copy()}>
            {copied ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                <CheckIcon style={{ width: '16px', height: '16px' }} />
                <span>Скопировано</span>
              </span>
            ) : (
              'Скопировать ссылку'
            )}
          </button>
        </div>
      ) : (
        <div className={styles.codeCard}>
          <span className={styles.codeLabel}>Ваш код</span>
          <span className={styles.codeValue}>—</span>
          <p className={styles.codeHint}>
            Откройте мини-апп в Telegram — код привяжется к вашему Telegram ID.
            Фиктивные коды и счётчики запрещены спецификацией.
          </p>
        </div>
      )}

      <div className={styles.rules}>
        <strong>Реферальная программа</strong>
        <p>
          Приглашённый друг переходит по вашей ссылке и запускает игру. Получайте
          бонусы от активности и оборота каждого приглашённого друга.
        </p>
      </div>
    </div>
  )
}
