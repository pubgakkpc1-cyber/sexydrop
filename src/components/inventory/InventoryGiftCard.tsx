import { useNavigate } from 'react-router-dom'
import type { Gift } from '../../data/catalog'
import { formatMinor } from '../../lib/money'
import { TonIcon } from '../shell/icons'
import styles from './InventoryGiftCard.module.css'

export interface InventoryGiftCardProps {
  gift: Gift
  onSell: () => void
}

/**
 * Карточка подарка на экране инвентаря: крупная картинка на фоне NFT, цена в углу,
 * название, «Вывести» (серверная функция — пока недоступна), «Продать за …»,
 * быстрые переходы в Апгрейд и Play Hub.
 */
export function InventoryGiftCard({ gift, onSell }: InventoryGiftCardProps) {
  const navigate = useNavigate()
  const price = formatMinor(gift.priceMinor)

  return (
    <article className={styles.card} data-rarity={gift.rarity} aria-label={gift.name}>
      <div className={styles.art}>
        <img
          className={gift.image.endsWith('.png') ? styles.imageFull : styles.imageContain}
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
          disabled
          title="Вывод подарков включится после подключения сервера"
        >
          Вывести
        </button>

        <button
          type="button"
          className={styles.sell}
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
