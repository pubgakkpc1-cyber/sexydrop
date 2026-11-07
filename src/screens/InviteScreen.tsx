import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
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
import { fetchMyFriends, type ReferralFriend } from '../lib/referralSync'
import styles from './InviteScreen.module.css'

/** Бот мини-аппа (username публичный; подтверждён через Bot API getMe: @sexydropbot). */
export const REFERRAL_BOT_USERNAME = 'sexydropbot'

/** Текст, с которым ссылка уходит друзьям в «Поделиться». */
export const SHARE_TEXT =
  '🎁 Залетай в SEXY DROP: крути бесплатные кейсы с NFT-подарками каждый день! ' +
  'Зайди по ссылке и сразу прокрути FREE-кейс.'

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
  // Друзья с сервера (источник правды); без ответа — локальный журнал (dev)
  const [serverFriends, setServerFriends] = useState<ReferralFriend[] | null>(null)
  const [warning, setWarning] = useState<null | 'share' | 'copy'>(null)

  useEffect(() => {
    let dead = false
    const load = () =>
      void fetchMyFriends().then((f) => {
        if (!dead && f) setServerFriends(f)
      })
    load()
    const t = window.setInterval(load, 30_000)
    return () => {
      dead = true
      window.clearInterval(t)
    }
  }, [])

  const invited = serverFriends ? serverFriends.length : Object.keys(credited).length
  const friends = serverFriends ? serverFriends.filter((f) => f.qualified).length : Object.keys(credited).length
  const waiting = invited - friends
  const starsEarned = serverFriends ? friends * REFERRAL_BONUS_STARS : referralStarsEarned(credited)

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
    shareTelegramLink(link, SHARE_TEXT)
  }

  /** Перед приглашением — предупреждение во весь экран: звёзды только за друга, который прокрутил FREE-кейс. */
  const confirmWarning = () => {
    const action = warning
    setWarning(null)
    if (action === 'share') share()
    if (action === 'copy') void copy()
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
          <p className={styles.sub}>как только он прокрутит бесплатный кейс</p>
        </div>
      </section>

      <section className={styles.promo} aria-label="Как заработать">
        <h2 className={styles.promoTitle}>Крути, зови, забирай</h2>
        <ol className={styles.promoSteps}>
          <li className={styles.promoStep}>
            <span className={styles.promoNum}>1</span>
            <span className={styles.promoText}>
              <b>Крути FREE-кейсы.</b> Сундук FREE 24 открывается бесплатно каждый день, а разовый
              FREE даёт NFT-подарок.
            </span>
          </li>
          <li className={styles.promoStep}>
            <span className={styles.promoNum}>2</span>
            <span className={styles.promoText}>
              <b>Зови друзей.</b> Кидай ссылку в чаты и сторис: каждый друг, прокрутивший бесплатный
              кейс, приносит тебе +{REFERRAL_BONUS_STARS} ★.
            </span>
          </li>
          <li className={styles.promoStep}>
            <span className={styles.promoNum}>3</span>
            <span className={styles.promoText}>
              <b>Забирай заработок.</b> Меняй звёзды на TON, а 5 друзей с Telegram Premium
              открывают вывод NFT из FREE-кейса.
            </span>
          </li>
        </ol>
        <p className={styles.promoNote}>Чем больше друзей — тем больше звёзд. Лимита нет.</p>
      </section>

      <section className={styles.rules} aria-label="Правила">
        <strong>Правила</strong>
        <ol className={styles.rulesList}>
          <li>Отправьте другу свою ссылку — он должен перейти по ней и запустить мини-апп.</li>
          <li>
            Друг <b>обязательно прокручивает бесплатный кейс</b> (FREE или FREE 24). Пока он этого не
            сделал, звёзды не начисляются.
          </li>
          <li>Вы <b>мгновенно получаете +{REFERRAL_BONUS_STARS} ★</b> на баланс звёзд.</li>
          <li>За одного друга награда выдаётся один раз. Пригласить самого себя нельзя.</li>
          <li>Звёзды можно обменять на TON в разделе «Заработок».</li>
        </ol>
      </section>

      <section className={styles.card} aria-label="Приглашение">
        <button type="button" className={styles.primary} disabled={!ready} onClick={() => setWarning('share')}>
          <ShareIcon className={styles.btnIcon} aria-hidden />
          Пригласить друзей
        </button>
        <button
          type="button"
          className={styles.secondary}
          disabled={!ready}
          onClick={() => setWarning('copy')}
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
          <span className={styles.statLabel}>Приглашено друзей</span>
          <span className={styles.statValue}>{invited}</span>
        </div>
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Прокрутили бесплатный кейс</span>
          <span className={styles.statValue}>{friends}</span>
        </div>
        {waiting > 0 && (
          <p className={styles.waiting}>
            {waiting} {friendWord(waiting)} ещё не {waiting === 1 ? 'прокрутил' : 'прокрутили'} бесплатный
            кейс. Напомните им: звёзды придут сразу после прокрута.
          </p>
        )}
      </section>

      <section className={styles.card} aria-label="Мои рефералы">
        <div className={styles.refHead}>
          <h2 className={styles.refTitle}>Мои рефералы</h2>
          <span className={styles.refCount}>{invited}</span>
        </div>
        {invited === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>
              <UsersIcon className={styles.emptyIconSvg} aria-hidden />
            </span>
            <p className={styles.emptyText}>Пока нет приглашений</p>
          </div>
        ) : (
          <p className={styles.refSummary}>
            По вашей ссылке пришли: {invited}. Из них прокрутили бесплатный кейс: {friends}.
          </p>
        )}
      </section>

      {warning && createPortal(
        <div className={styles.warnOverlay} role="alertdialog" aria-modal="true" aria-labelledby="invite-warn-title">
          <div className={styles.warnBox}>
            <span className={styles.warnIcon} aria-hidden>!</span>
            <h2 id="invite-warn-title" className={styles.warnTitle}>Важно перед приглашением</h2>
            <p className={styles.warnText}>
              Звёзды начисляются, <b>только когда друг прокрутит бесплатный кейс</b> (FREE или
              FREE 24).
            </p>
            <ul className={styles.warnList}>
              <li>Друг переходит именно по вашей ссылке и запускает приложение.</li>
              <li>Сразу открывает бесплатный кейс на главной.</li>
              <li>Только после этого вам приходит +{REFERRAL_BONUS_STARS} ★.</li>
            </ul>
            <p className={styles.warnText}>
              Просто перейти по ссылке недостаточно. Предупредите друга об этом.
            </p>
            <button type="button" className={styles.primary} onClick={confirmWarning}>
              Понятно, {warning === 'share' ? 'пригласить' : 'скопировать ссылку'}
            </button>
            <button type="button" className={styles.secondary} onClick={() => setWarning(null)}>
              Отмена
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

/** 1 друг, 2 друга, 5 друзей. */
function friendWord(n: number): string {
  const d = n % 10
  const dd = n % 100
  if (d === 1 && dd !== 11) return 'друг'
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'друга'
  return 'друзей'
}
