import { useNavigate } from 'react-router-dom'
import type { Gift } from '../../data/catalog'
import { formatMinor } from '../../lib/money'
import { TonIcon } from '../shell/icons'
import styles from './InventoryGiftCard.module.css'

export interface InventoryGiftCardProps {
  gift: Gift
  onSell: () => void
  /** «Вывести»: открывает чат с менеджером с готовым сообщением о выигранном подарке. */
  onWithdraw: () => void
  /** Идёт анимация продажи: карточка плавно исчезает, всплывает «+X TON». */
  selling?: boolean
}

/**
 * Карточка подарка на экране инвентаря: крупная картинка на фоне NFT, цена в углу,
 * название, «Вывести» (чат с менеджером с готовым сообщением), «Продать за …»,
 * быстрые переходы в Апгрейд и Play Hub.
 */
export function InventoryGiftCard({ gift, onSell, onWithdraw, selling = false }: InventoryGiftCardProps) {
  const navigate = useNavigate()
  const price = formatMinor(gift.priceMinor)

  return (
    <article
      className={`${styles.card} ${selling ? styles.selling : ''}`}
      data-rarity={gift.rarity}
      aria-label={gift.name}
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
      </div>

      <div className={styles.body}>
        <strong className={styles.name}>{gift.name}</strong>

        <button
          type="button"
          className={styles.withdraw}
          onClick={onWithdraw}
          title="Написать менеджеру @SexyDropOwner для вывода подарка"
        >
          Вывести
        </button>

        <button
          type="button"
          className={styles.sell}
          disabled={selling}
          onClick={onSell}
          aria-label={`Продать за ${price} TON`}
        >
          <span>Продать за</span>
          <span className={styles.sellPrice}>
            {price}
            <TonIcon className={styles.priceIcon} aria-hidden />
          </span>
        </button>

        <div className={styles.quick}>
          <button type="button" className={styles.upgrade} onClick={() => navigate('/games/upgrade')}>
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
