import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { RARITY_LABELS, isTonPrize, type Gift } from '../../data/catalog'
import { formatMinor } from '../../lib/money'
import { makeRequestId } from '../../lib/requestId'
import { hapticNotify } from '../../lib/telegram'
import { sellItemApi, withdrawItemApi } from '../../services/gameApi'
import { SERVER_MODE } from '../../lib/serverMode'
import { openOwnerChat } from '../../lib/telegram'
import { buildWithdrawMessage } from '../../lib/withdraw'
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
  const [withdrawing, setWithdrawing] = useState(false)
  const isTon = isTonPrize(gift)
  const navigate = useNavigate()

  const handleWithdraw = () => {
    if (withdrawing || selling || sold) return
    setWithdrawing(true)
    const open = () => openOwnerChat(buildWithdrawMessage(gift, uid))
    if (!SERVER_MODE) {
      open()
      onClose()
      return
    }
    void withdrawItemApi(uid)
      .then(() => {
        open()
        onClose()
      })
      .catch(() => setWithdrawing(false))
  }

  const handleUpgrade = () => {
    if (selling || sold || withdrawing) return
    onClose()
    navigate('/games/upgrade')
  }

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
            <img decoding="async" className={styles.giftImage} src={gift.image} alt={gift.name} />
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
          {isTon ? (
            <button type="button" className={styles.keepButton} onClick={onClose}>
              Отлично!
            </button>
          ) : (
            <>
              <button type="button" className={styles.keepButton} onClick={onClose} disabled={selling || sold || withdrawing}>
                Получить в инвентарь
              </button>
              <div className={styles.actionGrid}>
                <button
                  type="button"
                  className={`${styles.sellButton} ${sold ? styles.sellButtonSold : ''}`}
                  onClick={handleSell}
                  disabled={selling || sold || withdrawing}
                >
                  {sold ? `Продано +${formatMinor(gift.priceMinor)}` : `Продать ${formatMinor(gift.priceMinor)} TON`}
                </button>
                <button type="button" className={styles.sellButton} onClick={handleUpgrade} disabled={selling || sold || withdrawing}>
                  Улучшить
                </button>
              </div>
              <button type="button" className={styles.sellButton} onClick={handleWithdraw} disabled={selling || sold || withdrawing}>
                {withdrawing ? 'Оформляем…' : 'Вывести'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
