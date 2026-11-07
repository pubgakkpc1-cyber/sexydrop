import { useEffect, useState } from 'react'
import type { Gift } from '../../data/catalog'
import { getTelegramUser, hapticImpact } from '../../lib/telegram'
import { shareRefGif } from '../../lib/refShare'
import { syncReferrals } from '../../lib/referralSync'
import { BottomSheet, Button } from '../ui'
import { LockIcon, UsersIcon } from '../shell/icons'
import styles from './LockedGiftSheet.module.css'

export type LockedAction = 'withdraw' | 'sell' | 'upgrade'

const ACTION_TEXT: Record<LockedAction, string> = {
  withdraw: 'вывести',
  sell: 'продать',
  upgrade: 'улучшить',
}

export interface LockedGiftSheetProps {
  gift: Gift
  action: LockedAction
  joined: number
  target: number
  expiresAt: number
  onClose: () => void
}

function friendsWord(n: number): string {
  return n % 10 === 1 && n % 100 !== 11 ? 'друга' : 'друзей'
}

function countdown(expiresAt: number, now: number): string {
  const s = Math.max(0, Math.floor((expiresAt - now) / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return d > 0 ? `${d} д ${h} ч` : `${h} ч ${String(m).padStart(2, '0')} мин`
}

/**
 * Подарок из одноразового FREE-кейса под замком: показывает реальный прогресс задания
 * (друзья с Premium, открывшие бесплатный кейс по ссылке) и кнопку приглашения.
 */
export function LockedGiftSheet({ gift, action, joined, target, expiresAt, onClose }: LockedGiftSheetProps) {
  const [now, setNow] = useState(() => Date.now())
  const left = Math.max(0, target - joined)
  const tgId = getTelegramUser()?.id
  const refLink = tgId === undefined ? null : `https://t.me/sexydropbot?startapp=ref-${tgId}`

  useEffect(() => {
    void syncReferrals()
    const tick = window.setInterval(() => setNow(Date.now()), 30_000)
    const sync = window.setInterval(() => void syncReferrals(), 15_000)
    return () => {
      window.clearInterval(tick)
      window.clearInterval(sync)
    }
  }, [])

  const invite = () => {
    hapticImpact('light')
    if (refLink === null) return
    // гифка «рулетка NFT» с текстовой ссылкой; на старом Telegram — обычная ссылка
    void shareRefGif('roulette', refLink, 'Залетай в SEXY DROP — первый кейс с NFT бесплатно!')
  }

  return (
    <BottomSheet open onClose={onClose} title="Подарок под замком">
      <div className={styles.body}>
        <span className={styles.art}>
          <img loading="lazy" decoding="async" className={styles.image} src={gift.image} alt="" />
          <span className={styles.lock} aria-hidden>
            <LockIcon className={styles.lockIcon} />
          </span>
        </span>
        <strong className={styles.titleGift}>{gift.name}</strong>

        <p className={styles.message}>
          {left > 0
            ? `Чтобы ${ACTION_TEXT[action]} подарок, пригласите ещё ${left} ${friendsWord(left)}`
            : 'Задание выполнено — подарок откроется через несколько секунд'}
        </p>

        <div className={styles.progress} aria-label={`Засчитано ${joined} из ${target}`}>
          <div className={styles.progressHead}>
            <span>Друзья</span>
            <span className={styles.count}>
              {joined} / {target}
            </span>
          </div>
          <div className={styles.bar}>
            <div className={styles.fill} style={{ width: `${Math.min(100, (joined / target) * 100)}%` }} />
          </div>
        </div>

        <p className={styles.terms}>
          Засчитывается друг с Telegram Premium, который перешёл по вашей ссылке, открыл бесплатный
          кейс и состоит в чате SEXY DROP (проверяем перед выдачей). Осталось времени:{' '}
          {countdown(expiresAt, now)}.
        </p>

        <div className={styles.actions}>
          <Button fullWidth className={styles.inviteBtn} onClick={invite} disabled={refLink === null}>
            <UsersIcon className={styles.btnIcon} aria-hidden />
            Пригласить друзей
          </Button>
          <Button fullWidth variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
