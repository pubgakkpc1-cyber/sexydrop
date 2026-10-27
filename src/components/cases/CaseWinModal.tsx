import { useState } from 'react'
import { RARITY_LABELS, type Gift } from '../../data/catalog'
import { formatMinor } from '../../lib/money'
import { makeRequestId } from '../../lib/requestId'
import { hapticNotify } from '../../lib/telegram'
import { sellItem } from '../../services/demoInventoryService'
import { SparkleIcon, TonIcon } from '../shell/icons'
import styles from './CaseWinModal.module.css'

interface CaseWinModalProps {
  gift: Gift
  uid: string
  onClose: () => void
}

export function CaseWinModal({ gift, uid, onClose }: CaseWinModalProps) {
  const [sold, setSold] = useState(false)
  const [selling, setSelling] = useState(false)

  const handleSell = () => {
    if (selling || sold) return
    setSelling(true)
    const result = sellItem(uid, makeRequestId())
    if (result.status === 'ok') {
      setSold(true)
      hapticNotify('success')
      setTimeout(() => {
        onClose()
      }, 900)
    } else {
      setSelling(false)
    }
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Поздравляем!">
      <div className={styles.modal}>
        <div className={styles.glowRay} aria-hidden />

        <h2 className={styles.title}>
          <SparkleIcon style={{ width: '20px', height: '20px', display: 'inline', verticalAlign: '-2px', marginRight: '6px', color: '#fbbf24' }} />
          <span>Поздравляем!</span>
        </h2>
        <p className={styles.subtitle}>Вам выпал новый подарок</p>

        <div className={styles.imageWrap}>
          <img className={styles.giftImage} src={gift.image} alt={gift.name} />
        </div>

        <strong className={styles.giftName}>{gift.name}</strong>

        <div className={styles.metaRow}>
          <span className={styles.rarityBadge} data-rarity={gift.rarity}>
            {RARITY_LABELS[gift.rarity]}
          </span>
          <span className={styles.priceBadge}>
            <TonIcon style={{ width: '12px', height: '12px', display: 'inline', verticalAlign: '-1px', marginRight: '3px' }} />
            {formatMinor(gift.priceMinor)} TON
          </span>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.keepButton}
            onClick={onClose}
            disabled={selling || sold}
          >
            Забрать в инвентарь
          </button>

          <button
            type="button"
            className={`${styles.sellButton} ${sold ? styles.sellButtonSold : ''}`}
            onClick={handleSell}
            disabled={selling || sold}
          >
            {sold
              ? `Продано! +${formatMinor(gift.priceMinor)} TON`
              : `Продать за ${formatMinor(gift.priceMinor)} TON`}
          </button>
        </div>
      </div>
    </div>
  )
}
