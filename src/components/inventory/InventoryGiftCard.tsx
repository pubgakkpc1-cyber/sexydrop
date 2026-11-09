import { useNavigate } from 'react-router-dom'
import { FREE_NFT_CASE_MAINTENANCE } from '../../lib/features'
import type { Gift } from '../../data/catalog'
import { formatMinor } from '../../lib/money'
import { LockIcon, TonIcon } from '../shell/icons'
import type { LockedAction } from './LockedGiftSheet'
import styles from './InventoryGiftCard.module.css'

export interface InventoryGiftCardProps {
  gift: Gift
  onSell: () => void
  /** «Вывести»: открывает чат с менеджером с готовым сообщением о выигранном подарке. */
  onWithdraw: () => void
  /** Идёт анимация продажи: карточка плавно исчезает, всплывает «+X TON». */
  selling?: boolean
  /** Подарок из одноразового FREE-кейса под замком: реальный прогресс приглашений. */
  locked?: { joined: number; target: number }
  /** Нажатие на действие у подарка под замком — показать, сколько друзей осталось пригласить. */
  onLocked?: (action: LockedAction) => void
}

/**
 * Карточка подарка на экране инвентаря: крупная картинка на фоне NFT, цена в углу,
 * название, «Вывести» (чат с менеджером с готовым сообщением), «Продать за …»,
 * быстрые переходы в Апгрейд и Play Hub. Подарок под замком показывает замок и прогресс.
 */
export function InventoryGiftCard({ gift, onSell, onWithdraw, selling = false, locked, onLocked }: InventoryGiftCardProps) {
  const navigate = useNavigate()
  const price = formatMinor(gift.priceMinor)
  const lockedTap = (action: LockedAction) => () => onLocked?.(action)

  return (
    <article
      className={`${styles.card} ${selling ? styles.selling : ''} ${locked ? styles.locked : ''}`}
      data-rarity={gift.rarity}
      aria-label={locked ? `${gift.name}, под замком` : gift.name}
    >
      {selling && (
        <span className={styles.soldFloat} aria-hidden>
          +{price}
          <TonIcon className={styles.priceIcon} aria-hidden />
        </span>
      )}
      <div className={styles.art}>
        <img loading="lazy" decoding="async"
          className={/_\d\.webp$/.test(gift.image) ? styles.imageFull : styles.imageContain}
          src={gift.image}
          alt=""
        />
        <span className={styles.priceBadge}>
          {price}
          <TonIcon className={styles.priceIcon} aria-hidden />
        </span>
        {locked && (
          <button type="button" className={styles.lockOverlay} onClick={lockedTap('withdraw')} aria-label="Подарок под замком">
            <LockIcon className={styles.lockIcon} aria-hidden />
            <span className={styles.lockCount}>
              {locked.joined} / {locked.target}
            </span>
          </button>
        )}
      </div>

      <div className={styles.body}>
        <strong className={styles.name}>{gift.name}</strong>
        {locked && FREE_NFT_CASE_MAINTENANCE && (
          <span className={styles.tempUnavailable}>🛠 Временно недоступно</span>
        )}

        <button
          type="button"
          className={styles.withdraw}
          onClick={locked ? lockedTap('withdraw') : onWithdraw}
          title={locked ? 'Подарок под замком' : 'Написать менеджеру @SexyDropOwner для вывода подарка'}
        >
          {locked && <LockIcon className={styles.btnLock} aria-hidden />}
          Вывести
        </button>

        <button
          type="button"
          className={styles.sell}
          disabled={selling}
          onClick={locked ? lockedTap('sell') : onSell}
          aria-label={`Продать за ${price} TON`}
        >
          {locked && <LockIcon className={styles.btnLock} aria-hidden />}
          <span>Продать за</span>
          <span className={styles.sellPrice}>
            {price}
            <TonIcon className={styles.priceIcon} aria-hidden />
          </span>
        </button>

        <div className={styles.quick}>
          <button
            type="button"
            className={styles.upgrade}
            onClick={locked ? lockedTap('upgrade') : () => navigate('/games/upgrade')}
          >
            Апгрейд
          </button>
          <button type="button" className={styles.hub} onClick={() => navigate('/games')}>
            Play Hub
          </button>
        </div>
      </div>
    </article>
  )
}
