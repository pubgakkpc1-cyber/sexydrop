import { useState, type CSSProperties } from 'react'
import { RARITY_LABELS, isTonPrize, type Gift } from '../../data/catalog'
import { formatMinor } from '../../lib/money'
import { makeRequestId } from '../../lib/requestId'
import { hapticNotify } from '../../lib/telegram'
import { sellItemApi } from '../../services/gameApi'
import { SparkleIcon, TonIcon } from '../shell/icons'
import styles from './CaseWinModal.module.css'

interface CaseWinModalProps {
  gift: Gift
  uid: string
  onClose: () => void
}

const SPARKS = Array.from({ length: 12 }, (_, i) => ({ a: i * 30 + (i % 2) * 9, d: 92 + (i % 3) * 22 }))

export function CaseWinModal({ gift, uid, onClose }: CaseWinModalProps) {
  const [sold, setSold] = useState(false)
  const [selling, setSelling] = useState(false)
  const isTon = isTonPrize(gift)

  const handleSell = () => {
    if (selling || sold) return
    setSelling(true)
    void sellItemApi(uid, makeRequestId())
      .then((result) => {
        if (result.status === 'ok') {
          setSold(true)
          hapticNotify('success')
          setTimeout(() => {
            onClose()
          }, 900)
        } else {
          setSelling(false)
        }
      })
      .catch(() => setSelling(false))
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Поздравляем!">
      <div className={styles.modal}>
        <div className={styles.glowRay} aria-hidden />

        <h2 className={styles.title}>
          <SparkleIcon style={{ width: '20px', height: '20px', display: 'inline', verticalAlign: '-2px', marginRight: '6px', color: '#c35c61' }} />
          <span>Поздравляем!</span>
        </h2>
        <p className={styles.subtitle}>{isTon ? 'Выигрыш уже на вашем балансе' : 'Вам выпал новый подарок'}</p>

        <div className={styles.stageWrap}>
          <div className={styles.rays} aria-hidden />
          {SPARKS.map((s, i) => (
            <span
              key={i}
              className={styles.spark}
              aria-hidden
              style={{ '--a': `${s.a}deg`, '--d': `${s.d}px`, '--t': `${0.5 + (i % 4) * 0.06}s` } as CSSProperties}
            />
          ))}
          <div className={styles.imageWrap} data-rarity={gift.rarity}>
            <img className={styles.giftImage} src={gift.image} alt={gift.name} />
            <span className={styles.shine} aria-hidden />
          </div>
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
            {isTon ? 'Отлично!' : 'Забрать в инвентарь'}
          </button>

          {!isTon && (
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
          )}
        </div>
      </div>
    </div>
  )
}
