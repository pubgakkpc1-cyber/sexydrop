import { useMemo, useState } from 'react'
import { getTelegramUser, isTelegramEnv, shareTelegramLink } from '../lib/telegram'
import {
  CheckIcon,
  CopyIcon,
  ShareIcon,
  StarIcon,
  UsersIcon,
} from '../components/shell/icons'
import { REFERRAL_BONUS_STARS } from '../lib/referral'
import { referralStarsEarned, useReferralsStore } from '../store/referrals'
import styles from './InviteScreen.module.css'

/** Бот мини-аппа (username публичный; подтверждён через Bot API getMe: @sexydropbot). */
export const REFERRAL_BOT_USERNAME = 'sexydropbot'

/** Условия реферальной программы (настройка продукта; начисляет их сервер — TIER 7). */
export const REFERRAL_RULES = {
  percent: 10,
} as const

/**
 * Вкладка «Пригласить» (6.5). Персональный код = ID пользователя Telegram,
 * ссылка на бота с параметром start. Статистика приглашённых и начисления за
 * друзей считаются ТОЛЬКО сервером по журналу (TIER 7): до этого честно нули.
 */
export function InviteScreen() {
  const tgUser = getTelegramUser()
  const [copied, setCopied] = useState(false)
  const credited = useReferralsStore((s) => s.credited)
  const friends = Object.keys(credited).length
  const starsEarned = referralStarsEarned(credited)

  const code = useMemo(() => {
    if (tgUser?.id === undefined) return null
    return `ref-${tgUser.id}`
  }, [tgUser])

  const link = useMemo(
    () => (code === null ? null : `https://t.me/${REFERRAL_BOT_USERNAME}?startapp=${code}`),
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
            Получай <span className={styles.accent}>{REFERRAL_BONUS_STARS} ★</span> за каждого друга
          </h1>
          <p className={styles.sub}>как только он откроет бесплатный кейс</p>
        </div>
      </section>

      <section className={styles.rules} aria-label="Правила">
        <strong>Правила</strong>
        <ol className={styles.rulesList}>
          <li>Отправьте другу свою ссылку — он должен перейти по ней и запустить мини-апп.</li>
          <li>Друг <b>открывает бесплатный кейс</b> (FREE или FREE 24).</li>
          <li>Вы <b>мгновенно получаете +{REFERRAL_BONUS_STARS} ★</b> на баланс звёзд.</li>
          <li>За одного друга награда выдаётся один раз. Пригласить самого себя нельзя.</li>
          <li>Звёзды можно обменять на TON в разделе «Заработок».</li>
        </ol>
      </section>

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
          <span className={styles.statLabel}>Заработано звёзд</span>
          <span className={styles.statValue}>
            {starsEarned}
            <StarIcon className={styles.statIcon} aria-hidden />
          </span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Друзей получили награду</span>
          <span className={styles.statValue}>{friends}</span>
        </div>
      </section>

      <section className={styles.card} aria-label="Мои рефералы">
        <div className={styles.refHead}>
          <h2 className={styles.refTitle}>Мои рефералы</h2>
          <span className={styles.refCount}>{friends}</span>
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
