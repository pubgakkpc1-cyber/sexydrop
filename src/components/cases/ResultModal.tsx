import { Modal, GramAmount } from '../ui'
import { RARITY_LABELS, giftById } from '../../data/catalog'
import styles from './ResultModal.module.css'

interface ResultModalProps {
  giftId: string | null
  onClose: () => void
}

/** Результат открытия кейса / получения бесплатного кейса. */
export function ResultModal({ giftId, onClose }: ResultModalProps) {
  const gift = giftId ? giftById.get(giftId) : undefined
  if (!gift) return null

  return (
    <Modal open onClose={onClose} title="Ваш подарок">
      <div className={styles.body}>
        <span className={styles.rarityRing} data-rarity={gift.rarity}>
          <img className={styles.image} src={gift.image} alt={gift.name} />
        </span>
        <strong className={styles.name}>{gift.name}</strong>
        <span className={styles.meta}>
          {RARITY_LABELS[gift.rarity]} · <GramAmount minor={gift.priceMinor} />
        </span>
        <p className={styles.note}>Подарок зачислен в инвентарь</p>
      </div>
    </Modal>
  )
}
