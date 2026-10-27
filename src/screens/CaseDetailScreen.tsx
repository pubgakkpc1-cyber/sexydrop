import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CaseRoulette } from '../components/cases/CaseRoulette'
import { CaseWinModal } from '../components/cases/CaseWinModal'
import {
  ChevronLeftIcon,
  ClockIcon,
  SlotIcon,
  GiftIcon,
  CubeIcon,
  TonIcon,
} from '../components/shell/icons'
import { UserAvatar } from '../components/ui/UserAvatar'
import { caseById, giftById, type FreeCaseId, type Gift } from '../data/catalog'
import { displayProbabilityBps } from '../lib/caseMath'
import { formatMinor } from '../lib/money'
import { makeRequestId } from '../lib/requestId'
import { claimFreeCase, openCase } from '../services/demoCaseService'
import { hapticImpact } from '../lib/telegram'
import { useFreeCasesStore } from '../store/freeCases'
import { useWalletStore } from '../store/wallet'
import styles from './CaseDetailScreen.module.css'

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }
  return `${minutes}m ${seconds}s`
}

function formatChance(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`
}

/**
 * Экран кейса (по референсу видео 1:1):
 * 1. Шапка: Назад, бренд Epic Gift, баланс + пополнить.
 * 2. Верхний тикер последних ТОП дропов.
 * 3. Встроенная горизонтальная рулетка с центральной стрелкой-маркером, физикой замедления и звуками.
 * 4. Блок действия: таймер кулдауна («Возвращайтесь через ...») либо яркая кнопка «Открыть».
 * 5. Сетка наград в 2 колонки с золотой рамкой, ценой и плашкой «Случайный».
 * 6. Модалка победы с возможностью забрать подарок или мгновенно продать за GRAM.
 */
export function CaseDetailScreen() {
  const { caseId } = useParams()
  const navigate = useNavigate()
  const gameCase = caseId !== undefined ? caseById.get(caseId) : undefined

  const balance = useWalletStore((s) => s.balances[s.mode])
  const lastClaimAt = useFreeCasesStore((s) => s.lastClaimAt)

  const [now, setNow] = useState(() => Date.now())
  const [isSpinning, setIsSpinning] = useState(false)
  const [targetGiftId, setTargetGiftId] = useState<string | null>(null)
  const [spinResult, setSpinResult] = useState<{ gift: Gift; uid: string } | null>(null)
  const [winModalOpen, setWinModalOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Таймер для обновления кулдауна каждую секунду
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (!gameCase) {
    return (
      <div className={styles.emptyScreen}>
        <p>Кейс не найден</p>
        <Link to="/" className={styles.backButton}>
          <ChevronLeftIcon className={styles.backIcon} aria-hidden /> На главную
        </Link>
      </div>
    )
  }

  // Расчёт кулдауна для бесплатных кейсов
  const isFreeCase = gameCase.freeCooldownMs !== null
  const freeCaseId = isFreeCase ? (gameCase.id as FreeCaseId) : null
  const lastClaim = freeCaseId ? lastClaimAt[freeCaseId] : 0
  const availableAt = freeCaseId && lastClaim > 0 ? lastClaim + (gameCase.freeCooldownMs ?? 0) : 0
  const onCooldown = isFreeCase && availableAt > now
  const cooldownRemainingMs = onCooldown ? availableAt - now : 0

  const affordable = balance >= gameCase.priceMinor

  // Список наград кейса для 2-колоночной сетки
  const rewardRows = gameCase.entries
    .map((entry, index) => ({
      gift: giftById.get(entry.itemId),
      chance: displayProbabilityBps(gameCase.entries)[index] ?? 0,
    }))
    .filter((row): row is { gift: Gift; chance: number } => row.gift !== undefined)
    .sort((a, b) => b.chance - a.chance)

  const handleOpen = () => {
    if (isSpinning) return
    setError(null)

    if (isFreeCase && freeCaseId) {
      if (onCooldown) return
      const result = claimFreeCase(freeCaseId, makeRequestId(), Date.now())
      if (result.status === 'ok') {
        const gift = giftById.get(result.giftId)
        if (gift) {
          setTargetGiftId(result.giftId)
          setSpinResult({ gift, uid: result.uid })
          setIsSpinning(true)
        }
      } else {
        setError('Кейс пока на кулдауне')
      }
    } else {
      if (!affordable) {
        setError('Недостаточно TON — пополните баланс')
        return
      }
      const result = openCase(gameCase.id, makeRequestId())
      if (result.status === 'ok') {
        const gift = giftById.get(result.giftId)
        if (gift) {
          setTargetGiftId(result.giftId)
          setSpinResult({ gift, uid: result.uid })
          setIsSpinning(true)
        }
      } else {
        setError('Недостаточно средств')
      }
    }
  }

  const handleSpinComplete = () => {
    setIsSpinning(false)
    setWinModalOpen(true)
  }

  const handleCloseWinModal = () => {
    setWinModalOpen(false)
    setSpinResult(null)
    setTargetGiftId(null)
  }

  return (
    <div className={styles.screen}>
      {/* 1. Верхняя панель в стиле Apple Liquid Glass */}
      <header className={styles.topNav}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => {
            hapticImpact('light')
            navigate(-1)
          }}
          aria-label="Вернуться назад"
        >
          <span className={styles.backIconWrap}>
            <ChevronLeftIcon className={styles.backIcon} aria-hidden />
          </span>
          <span className={styles.backText}>Назад</span>
        </button>

        <div className={styles.centerBadge}>
          <span className={styles.appBrand}>SEXY DROP</span>
          <span className={styles.badgeDivider}>•</span>
          <span className={styles.caseBadgeTitle}>{gameCase.name}</span>
        </div>

        <div className={styles.balancePill}>
          <UserAvatar size={24} className={styles.balanceAvatar} />
          <div className={styles.balanceTextGroup}>
            <span className={styles.balanceValue}>
              <TonIcon style={{ width: '13px', height: '13px', display: 'inline', verticalAlign: '-1px', marginRight: '3px' }} />
              {formatMinor(balance)} TON
            </span>
          </div>
          <button
            type="button"
            className={styles.depositButton}
            onClick={() => {
              hapticImpact('light')
              navigate('/deposit')
            }}
            title="Пополнить баланс"
            aria-label="Пополнить баланс"
          >
            + Пополнить
          </button>
        </div>
      </header>

      {/* 2. Горизонтальная рулетка с анимацией и центральной стрелкой */}
      <CaseRoulette
        caseDefinition={gameCase}
        targetGiftId={targetGiftId}
        isSpinning={isSpinning}
        onSpinComplete={handleSpinComplete}
      />

      {/* 4. Блок статуса и кнопки открытия */}
      <div className={styles.actionSection}>
        {onCooldown ? (
          <>
            <span className={styles.cooldownLabel}>Возвращайтесь через</span>
            <button
              type="button"
              className={`${styles.openButton} ${styles.openButtonWaiting}`}
              disabled
            >
              <span className={styles.buttonIcon}>
                <ClockIcon style={{ width: '18px', height: '18px' }} />
              </span>
              <span>{formatCountdown(cooldownRemainingMs)}</span>
            </button>
          </>
        ) : isSpinning ? (
          <button
            type="button"
            className={`${styles.openButton} ${styles.openButtonSpinning}`}
            disabled
          >
            <span className={styles.buttonIcon}>
              <SlotIcon style={{ width: '18px', height: '18px' }} />
            </span>
            <span>Крутим...</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              className={`${styles.openButton} ${styles.openButtonCta}`}
              disabled={!isFreeCase && !affordable}
              onClick={handleOpen}
            >
              <span className={styles.buttonIcon}>
                <GiftIcon style={{ width: '18px', height: '18px' }} />
              </span>
              <span>
                {isFreeCase
                  ? 'Открыть бесплатно'
                  : affordable
                  ? `Открыть за ${formatMinor(gameCase.priceMinor)} TON`
                  : 'Недостаточно TON'}
              </span>
            </button>
            {error && <span className={styles.errorHint}>{error}</span>}
          </>
        )}
      </div>

      {/* 5. Сетка наград в 2 колонки (как в референс-видео) */}
      <section className={styles.rewardsSection} aria-label="Содержимое кейса">
        <div className={styles.rewardsHeader}>
          <h2 className={styles.rewardsTitle}>
            <CubeIcon style={{ width: '17px', height: '17px', display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} />
            <span>{isFreeCase ? 'Ежедневные награды' : 'Содержимое кейса'}</span>
          </h2>
          <span className={styles.rewardsCount}>{rewardRows.length} предметов</span>
        </div>

        <div className={styles.rewardsGrid}>
          {rewardRows.map(({ gift, chance }) => (
            <div key={gift.id} className={styles.rewardCard}>
              <span className={styles.rewardPriceBadge}>
                <TonIcon style={{ width: '11px', height: '11px', display: 'inline', verticalAlign: '-1px', marginRight: '2px' }} />
                {formatMinor(gift.priceMinor)} TON
              </span>
              <div className={styles.rewardImageWrap}>
                <img className={styles.rewardImage} src={gift.image} alt={gift.name} />
              </div>
              <strong className={styles.rewardName}>{gift.name}</strong>
              <div className={styles.rewardPill}>
                <span>Случайный</span>
                <span className={styles.rewardChance}>· {formatChance(chance)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Модалка победы */}
      {winModalOpen && spinResult && (
        <CaseWinModal
          gift={spinResult.gift}
          uid={spinResult.uid}
          onClose={handleCloseWinModal}
        />
      )}
    </div>
  )
}
