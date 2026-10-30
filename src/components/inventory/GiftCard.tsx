import { RARITY_LABELS, type Gift } from '../../data/catalog'
import { cx } from '../../lib/cx'
import { GramAmount } from '../ui'
import styles from './GiftCard.module.css'

export interface GiftCardProps {
  gift: Gift
  /** Дополнительный контент под карточкой (выбор для игры 3.3, продажа 3.4). */
  action?: React.ReactNode
  /** Клик по карточке (например, открыть действия предмета — 3.4). */
  onClick?: () => void
  className?: string
}

/**
 * Карточка подарка (3.2): редкость — через токены `data-rarity` (как в
 * ResultModal), название всегда обрезается, цена не вылезает из карточки.
 * Номер экземпляра показывается только если он реально известен в каталоге.
 * С onClick корневой элемент становится кнопкой (доступный клик).
 */
export function GiftCard({ gift, action, onClick, className }: GiftCardProps) {
  const rarityLabel = RARITY_LABELS[gift.rarity]
  const content = (
    <>
      <span className={styles.art}>
        <img className={styles.image} src={gift.image} alt="" />
      </span>
      <span className={styles.name}>{gift.name}</span>
      <span className={styles.footer}>
        <span className={styles.rarity}>{rarityLabel}</span>
        <GramAmount minor={gift.priceMinor} className={styles.price} />
      </span>
      {action}
    </>
  )
  const shared = {
    className: cx(styles.card, onClick && styles.clickable, className),
    'data-rarity': gift.rarity,
    title: `${gift.name} · ${rarityLabel}`,
  }
  return onClick ? (
    <button type="button" {...shared} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div {...shared}>{content}</div>
  )
}
