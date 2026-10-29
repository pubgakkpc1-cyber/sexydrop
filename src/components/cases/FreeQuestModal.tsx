import { useState, useEffect } from 'react'
import { giftById } from '../../data/catalog'
import { formatMinor } from '../../lib/money'
import { makeRequestId } from '../../lib/requestId'
import { hapticNotify, hapticImpact } from '../../lib/telegram'
import { sellItem } from '../../services/demoInventoryService'
import { useFreeCasesStore } from '../../store/freeCases'
import { LockIcon, LockOpenIcon, TonIcon, SparkleIcon, UsersIcon, CheckIcon } from '../shell/icons'
import styles from './FreeQuestModal.module.css'

interface FreeQuestModalProps {
  onClose: () => void
}

function formatHoursCountdown(expiresAt: number, now: number): string {
  const diffMs = Math.max(0, expiresAt - now)
  const totalSeconds = Math.floor(diffMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours}ч ${String(minutes).padStart(2, '0')}м ${String(seconds).padStart(2, '0')}с`
}

export function FreeQuestModal({ onClose }: FreeQuestModalProps) {
  const quest = useFreeCasesStore((s) => s.quest)
  const simulateFriendJoin = useFreeCasesStore((s) => s.simulateFriendJoin)
  const clearQuestReward = useFreeCasesStore((s) => s.clearQuestReward)

  const [now, setNow] = useState(() => Date.now())
  const [copied, setCopied] = useState(false)
  const [sold, setSold] = useState(false)
  const [selling, setSelling] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  if (!quest.pendingReward) return null

  const gift = giftById.get(quest.pendingReward.giftId)
  if (!gift) return null

  const isExpired = now >= quest.pendingReward.expiresAt
  const isCompleted =
    !isExpired &&
    quest.referralsJoined >= 5 &&
    quest.channelsSubscribed >= 5 &&
    quest.spinsWithPremium >= 5

  const handleCopy = () => {
    hapticImpact('light')
    const refLink = `https://t.me/sexydropbot?start=ref_${makeRequestId().slice(0, 8)}`
    navigator.clipboard?.writeText(refLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleSimulate = () => {
    hapticImpact('medium')
    simulateFriendJoin()
  }

  const handleClaim = () => {
    hapticNotify('success')
    clearQuestReward()
    onClose()
  }

  const handleSell = () => {
    if (selling || sold || !quest.pendingReward) return
    setSelling(true)
    const result = sellItem(quest.pendingReward.uid, makeRequestId())
    if (result.status === 'ok') {
      setSold(true)
      hapticNotify('success')
      clearQuestReward()
      setTimeout(() => {
        onClose()
      }, 1000)
    } else {
      setSelling(false)
    }
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Активация награды">
      <div className={styles.modal}>
        {/* Верхний декоративный свет */}
        <div className={isCompleted ? styles.glowGold : styles.glowCyan} aria-hidden />

        {/* Иконка замка */}
        <div className={isCompleted ? styles.lockCircleUnlocked : styles.lockCircle}>
          {isCompleted ? (
            <LockOpenIcon className={styles.lockIcon} />
          ) : (
            <LockIcon className={styles.lockIcon} />
          )}
        </div>

        <h2 className={styles.title}>
          {isCompleted ? 'Награда разблокирована!' : 'Временная блокировка дропа'}
        </h2>

        {/* 3-дневный таймер */}
        <div className={styles.timerBadge}>
          <span className={styles.timerDot} />
          {isExpired ? (
            <span className={styles.expiredText}>Срок 3 дня истёк</span>
          ) : (
            <span>На активацию осталось: <strong>{formatHoursCountdown(quest.pendingReward.expiresAt, now)}</strong></span>
          )}
        </div>

        <p className={styles.subtitle}>
          {isCompleted
            ? 'Все задания выполнены! Вы можете забрать подарок в инвентарь или продать его за TON.'
            : 'Чтобы получить, вывести или продать этот подарок, пригласите 5 друзей с Telegram Premium, которые прокрутят колесо:'}
        </p>

        {/* Карточка выигранного подарка */}
        <div className={styles.giftPreviewCard}>
          <div className={styles.giftImageWrap}>
            <img className={styles.giftImage} src={gift.image} alt={gift.name} />
          </div>
          <div className={styles.giftMeta}>
            <strong className={styles.giftName}>{gift.name}</strong>
            <span className={styles.giftPrice}>
              <TonIcon style={{ width: '13px', height: '13px', verticalAlign: '-1px', marginRight: '3px' }} />
              {formatMinor(gift.priceMinor)} TON
            </span>
          </div>
        </div>

        {/* 3 счётчика выполнения */}
        <div className={styles.countersBox}>
          {/* Счётчик 1: Друг перешел */}
          <div className={styles.counterRow}>
            <div className={styles.counterHeader}>
              <span className={styles.counterLabel}>
                <span className={styles.stepNum}>1</span>
                Друзья перешли по ссылке
              </span>
              <span className={styles.counterValue}>
                {quest.referralsJoined} / 5
                {quest.referralsJoined >= 5 && <CheckIcon className={styles.checkDone} />}
              </span>
            </div>
            <div className={styles.progressBarBg}>
              <div
                className={styles.progressBarFill}
                style={{ width: `${Math.min(100, (quest.referralsJoined / 5) * 100)}%` }}
              />
            </div>
          </div>

          {/* Счётчик 2: Подписка на каналы */}
          <div className={styles.counterRow}>
            <div className={styles.counterHeader}>
              <span className={styles.counterLabel}>
                <span className={styles.stepNum}>2</span>
                Подписались на нужные каналы
              </span>
              <span className={styles.counterValue}>
                {quest.channelsSubscribed} / 5
                {quest.channelsSubscribed >= 5 && <CheckIcon className={styles.checkDone} />}
              </span>
            </div>
            <div className={styles.progressBarBg}>
              <div
                className={styles.progressBarFill}
                style={{ width: `${Math.min(100, (quest.channelsSubscribed / 5) * 100)}%` }}
              />
            </div>
          </div>

          {/* Счётчик 3: TG Premium + прокрут */}
          <div className={styles.counterRow}>
            <div className={styles.counterHeader}>
              <span className={styles.counterLabel}>
                <span className={styles.stepNum}>3</span>
                Прокрутили колесо + TG Premium
              </span>
              <span className={styles.counterValue}>
                {quest.spinsWithPremium} / 5
                {quest.spinsWithPremium >= 5 && <CheckIcon className={styles.checkDone} />}
              </span>
            </div>
            <div className={styles.progressBarBg}>
              <div
                className={styles.progressBarFill}
                style={{ width: `${Math.min(100, (quest.spinsWithPremium / 5) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Кнопки действий */}
        <div className={styles.actionCol}>
          {!isCompleted ? (
            <>
              <button
                type="button"
                className={styles.inviteButton}
                onClick={handleCopy}
              >
                <UsersIcon style={{ width: '18px', height: '18px', marginRight: '6px' }} />
                <span>{copied ? '✓ Реферальная ссылка скопирована!' : 'Пригласить друзей'}</span>
              </button>

              <button
                type="button"
                className={styles.simulateButton}
                onClick={handleSimulate}
                title="Для проверки и демонстрации работы механики"
              >
                <SparkleIcon style={{ width: '15px', height: '15px', marginRight: '5px' }} />
                <span>+1 друг для теста (симуляция)</span>
              </button>
            </>
          ) : (
            <div className={styles.unlockedActionsRow}>
              <button
                type="button"
                className={styles.claimButton}
                onClick={handleClaim}
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
          )}

          <button type="button" className={styles.closeBtn} onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
