import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { getTelegramUser, isTelegramEnv, openTelegramUrl } from '../lib/telegram'
import { shareRefGif } from '../lib/refShare'
import {
  CheckIcon,
  CopyIcon,
  ShareIcon,
  StarIcon,
  UsersIcon,
} from '../components/shell/icons'
import { REFERRAL_BONUS_STARS } from '../lib/referral'
import { useReferralsStore } from '../store/referrals'
import { useRefBankStore } from '../store/refBank'
import { claimBankApi } from '../services/gameApi'
import { hapticNotify } from '../lib/telegram'
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
  const bank = useRefBankStore((s) => s.stars)
  const bankMin = useRefBankStore((s) => s.min)
  const chatUrl = useRefBankStore((s) => s.chatUrl)
  const history = useRefBankStore((s) => s.history)
  const [claiming, setClaiming] = useState(false)
  const [claimNote, setClaimNote] = useState<string | null>(null)
  const canClaim = bank >= bankMin
  const left = Math.max(0, bankMin - bank)
  const friendsLeft = Math.ceil(left / REFERRAL_BONUS_STARS)

  const claim = async () => {
    if (!canClaim || claiming) return
    setClaiming(true)
    setClaimNote(null)
    try {
      const amount = bank
      const res = await claimBankApi()
      if (res === 'ok') {
        hapticNotify('success')
        setClaimNote(`+${amount} ★ на баланс звёзд`)
      } else {
        setClaimNote(`Забрать можно от ${bankMin} ★`)
      }
    } catch {
      setClaimNote('Не получилось, попробуйте ещё раз')
    } finally {
      setClaiming(false)
    }
  }

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
    // гифка «бесплатные NFT-кейсы» с текстовой ссылкой; на старом Telegram — обычная ссылка
    void shareRefGif('invite', link, SHARE_TEXT)
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

      <section className={styles.bank} aria-label="Банк звёзд">
        <div className={styles.bankHead}>
          <span className={styles.bankTitle}>Банк</span>
          <span className={styles.bankHint}>забрать от {bankMin} ★</span>
        </div>
        <div className={styles.bankAmount}>
          <span className={styles.bankNum}>{bank}</span>
          <span className={styles.bankOf}>/ {bankMin}</span>
          <StarIcon className={styles.bankStar} aria-hidden />
        </div>
        <div
          className={styles.bankBar}
          role="progressbar"
          aria-label="Накоплено в банке"
          aria-valuemin={0}
          aria-valuemax={bankMin}
          aria-valuenow={Math.min(bank, bankMin)}
        >
          <span className={styles.bankFill} style={{ width: `${Math.min(100, (bank / bankMin) * 100)}%` }} />
        </div>
        <p className={styles.bankText}>
          {canClaim
            ? 'Банк полон — забирайте звёзды и меняйте их на TON.'
            : `Ещё ${left} ★ — это ${friendsLeft} ${friendWord(friendsLeft)}, прокрутивших бесплатный кейс.`}
        </p>
        <div className={styles.chatRule}>
          <span className={styles.chatRuleText}>
            Друг засчитывается, только если он <b>в чате SEXY DROP</b>. При «Забрать» проверяем всех:
            кого нет в чате — звёзды за него снимаются.
          </span>
          <button type="button" className={styles.chatBtn} onClick={() => openTelegramUrl(chatUrl)}>
            Открыть чат
          </button>
        </div>
        <button type="button" className={styles.claimBtn} disabled={!canClaim || claiming} onClick={() => void claim()}>
          {claiming ? 'Забираем…' : canClaim ? `Забрать ${bank} ★` : `Забрать от ${bankMin} ★`}
        </button>
        {claimNote && <p className={styles.claimNote} role="status">{claimNote}</p>}
        <div className={styles.bankStats}>
          <span>
            По ссылке: <b>{invited}</b>
          </span>
          <span>
            Прокрутили FREE: <b>{friends}</b>
          </span>
        </div>
        {waiting > 0 && (
          <p className={styles.waiting}>
            {waiting} {friendWord(waiting)} ещё не {waiting === 1 ? 'прокрутил' : 'прокрутили'} бесплатный
            кейс. Напомните: звёзды придут в банк сразу после прокрута.
          </p>
        )}
        {history.length > 0 && (
          <div className={styles.history} aria-label="История банка">
            <span className={styles.historyTitle}>История</span>
            {history.slice(0, 8).map((h, i) => (
              <div key={`${h.at}-${i}`} className={styles.historyRow}>
                <span className={h.d > 0 ? styles.histPlus : h.d < 0 ? styles.histMinus : styles.histZero}>
                  {h.d > 0 ? `+${h.d} ★` : h.d < 0 ? `−${-h.d} ★` : '•'}
                </span>
                <span className={styles.historyText}>{h.t}</span>
                <span className={styles.historyAt}>{shortAgo(h.at)}</span>
              </div>
            ))}
          </div>
        )}
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

      <section className={styles.promo} aria-label="Как это работает">
        <h2 className={styles.promoTitle}>Как это работает</h2>
        <ol className={styles.promoSteps}>
          <li className={styles.promoStep}>
            <span className={styles.promoNum}>1</span>
            <span className={styles.promoText}>
              <b>Кидай ссылку</b> в чаты и сторис. Друг переходит по ней, запускает приложение и
              вступает в чат SEXY DROP.
            </span>
          </li>
          <li className={styles.promoStep}>
            <span className={styles.promoNum}>2</span>
            <span className={styles.promoText}>
              Друг <b>обязательно прокручивает бесплатный кейс</b> (FREE или FREE 24). Пока он этого не
              сделал, звёзды не начисляются.
            </span>
          </li>
          <li className={styles.promoStep}>
            <span className={styles.promoNum}>3</span>
            <span className={styles.promoText}>
              В банк падает <b>+{REFERRAL_BONUS_STARS} ★</b> за друга (один раз). От {bankMin} ★ — забирай и
              меняй на TON в «Заработке».
            </span>
          </li>
        </ol>
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
              <li>Вступает в чат SEXY DROP и не выходит из него — иначе звёзды за него снимут.</li>
              <li>Только после этого в ваш банк приходит +{REFERRAL_BONUS_STARS} ★.</li>
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

/** «сейчас», «12 мин», «3 ч», «2 дн» — для мини-истории (at в миллисекундах). */
function shortAgo(atMs: number): string {
  const s = Math.max(0, Math.floor((Date.now() - atMs) / 1000))
  if (s < 90) return 'сейчас'
  if (s < 3600) return `${Math.floor(s / 60)} мин`
  if (s < 86400) return `${Math.floor(s / 3600)} ч`
  return `${Math.floor(s / 86400)} дн`
}

/** 1 друг, 2 друга, 5 друзей. */
function friendWord(n: number): string {
  const d = n % 10
  const dd = n % 100
  if (d === 1 && dd !== 11) return 'друг'
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return 'друга'
  return 'друзей'
}
