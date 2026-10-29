import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CaseRoulette } from '../components/cases/CaseRoulette'
import { CaseWinModal } from '../components/cases/CaseWinModal'
import { FreeQuestModal } from '../components/cases/FreeQuestModal'
import {
  ChevronLeftIcon,
  ClockIcon,
  SlotIcon,
  GiftIcon,
  CubeIcon,
  TonIcon,
  LockIcon,
} from '../components/shell/icons'
import { UserAvatar } from '../components/ui/UserAvatar'
import { caseById, giftById, type FreeCaseId, type Gift } from '../data/catalog'
import { displayProbabilityBps } from '../lib/caseMath'
import { formatMinor } from '../lib/money'
import { makeRequestId } from '../lib/requestId'
import { claimFreeCase, openCase } from '../services/demoCaseService'
import { hapticImpact } from '../lib/telegram'
import { useFreeCasesStore, getMsk23ResetInfo } from '../store/freeCases'
import { useWalletStore } from '../store/wallet'
import styles from './CaseDetailScreen.module.css'

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}ч ${String(minutes).padStart(2, '0')}м ${String(seconds).padStart(2, '0')}с`
  }
  return `${minutes}м ${String(seconds).padStart(2, '0')}с`
}

function formatChance(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`
}

export function CaseDetailScreen() {
  const { caseId } = useParams()
  const navigate = useNavigate()
  const gameCase = caseId !== undefined ? caseById.get(caseId) : undefined

  const balance = useWalletStore((s) => s.balances[s.mode])
  const lastClaimAt = useFreeCasesStore((s) => s.lastClaimAt)
  const quest = useFreeCasesStore((s) => s.quest)

  const [now, setNow] = useState(() => Date.now())
  const [isSpinning, setIsSpinning] = useState(false)
  const [targetGiftId, setTargetGiftId] = useState<string | null>(null)
  const [spinResult, setSpinResult] = useState<{ gift: Gift; uid: string } | null>(null)
  const [winModalOpen, setWinModalOpen] = useState(false)
  const [questModalOpen, setQuestModalOpen] = useState(false)
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

  // Расчёт кулдауна для бесплатных кейсов (ежедневный сброс в 23:00 МСК)
  const isFreeCase = gameCase.freeCooldownMs !== null
  const freeCaseId = isFreeCase ? (gameCase.id as FreeCaseId) : null
  const isDailyFree = freeCaseId === 'free24'
  const isQuestFree = freeCaseId === 'free'

  const resetInfo = getMsk23ResetInfo(now)
  const lastClaim = freeCaseId ? lastClaimAt[freeCaseId] : 0
  const isAvailable = isFreeCase ? resetInfo.isAvailable(lastClaim) : true
  const onCooldown = isFreeCase && !isAvailable
  const cooldownRemainingMs = onCooldown ? resetInfo.remainingMs : 0

  const hasPendingQuestReward =
    isQuestFree && quest.pendingReward !== null && now < quest.pendingReward.expiresAt

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
        setError('Кейс пока на кулдауне (сброс в 23:00 МСК)')
      }
    } else {
      if (!affordable) {
        navigate('/deposit')
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
    if (isQuestFree) {
      setQuestModalOpen(true)
    } else {
      setWinModalOpen(true)
    }
  }

  const handleCloseWinModal = () => {
    setWinModalOpen(false)
    setSpinResult(null)
    setTargetGiftId(null)
  }

  const handleCloseQuestModal = () => {
    setQuestModalOpen(false)
    setSpinResult(null)
    setTargetGiftId(null)
  }

  return (
    <div className={styles.screen}>
      {/* 1. Верхняя панель (по референсу фото) */}
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

        <div className={styles.brandTitle}>
          <span>SEXY DROP</span>
        </div>

        <div className={styles.headerRight}>
          <UserAvatar size={32} className={styles.userAvatar} />
          <div className={styles.balanceCol}>
            <span className={styles.balanceLabel}>Ваш баланс</span>
            <span className={styles.balanceVal}>
              <TonIcon style={{ width: '13px', height: '13px', marginRight: '3px' }} />
              {formatMinor(balance)}
            </span>
          </div>

          <button
            type="button"
            className={styles.depositPill}
            onClick={() => {
              hapticImpact('light')
              navigate('/deposit')
            }}
          >
            + Пополнить
          </button>
        </div>
      </header>

      {/* 2. Заголовок кейса (как на фото) */}
      <div className={styles.caseHeading}>
        <h1 className={styles.caseTitle}>{gameCase.name} Кейс</h1>
        <p className={styles.caseSubtitle}>
          {isDailyFree
            ? 'Ежедневный сундук · Доступно 1 раз в 24 часа (сброс в 23:00 МСК)'
            : isQuestFree
            ? 'Фри кейс с заданием · Пригласите 5 друзей с TG Premium (3 дня на активацию)'
            : 'Официальные Telegram подарки · Мгновенный вывод или продажа за TON'}
        </p>
      </div>

      {/* Плашка напоминания активного квеста, если подарок заблокирован */}
      {hasPendingQuestReward && (
        <div
          className={styles.questReminderBanner}
          onClick={() => setQuestModalOpen(true)}
          role="button"
          tabIndex={0}
        >
          <div className={styles.reminderLeft}>
            <LockIcon className={styles.reminderLockIcon} />
            <div className={styles.reminderTexts}>
              <strong className={styles.reminderTitle}>У вас есть выигранный подарок на замке!</strong>
              <span className={styles.reminderSub}>Нажмите, чтобы открыть задания для активации (3 дня)</span>
            </div>
          </div>
          <span className={styles.reminderBtn}>Открыть</span>
        </div>
      )}

      {/* 3. Горизонтальная рулетка */}
      <CaseRoulette
        caseDefinition={gameCase}
        targetGiftId={targetGiftId}
        isSpinning={isSpinning}
        onSpinComplete={handleSpinComplete}
      />

      {/* 4. Главная кнопка действия */}
      <div className={styles.actionSection}>
        {isSpinning ? (
          <button
            type="button"
            className={`${styles.openButton} ${styles.openButtonSpinning}`}
            disabled
          >
            <span className={styles.buttonIcon}>
              <SlotIcon style={{ width: '19px', height: '19px' }} />
            </span>
            <span>Крутим...</span>
          </button>
        ) : onCooldown ? (
          <div className={styles.cooldownContainer}>
            <span className={styles.cooldownNote}>Возвращайтесь через</span>
            <button
              type="button"
              className={`${styles.openButton} ${styles.openButtonWaiting}`}
              disabled
            >
              <ClockIcon style={{ width: '18px', height: '18px', marginRight: '6px' }} />
              <span>{formatCountdown(cooldownRemainingMs)}</span>
            </button>
            <span className={styles.mskResetHint}>Сундук всегда обновляется в 23:00 по МСК</span>
          </div>
        ) : hasPendingQuestReward ? (
          <button
            type="button"
            className={`${styles.openButton} ${styles.openButtonQuest}`}
            onClick={() => setQuestModalOpen(true)}
          >
            <LockIcon style={{ width: '19px', height: '19px', marginRight: '6px' }} />
            <span>Активировать выигрыш (Квест 3 дня)</span>
          </button>
        ) : !isFreeCase && !affordable ? (
          /* Не хватает баланса — кнопка как на фото «Пополнить баланс» */
          <button
            type="button"
            className={`${styles.openButton} ${styles.openButtonDeposit}`}
            onClick={() => navigate('/deposit')}
          >
            <span>Пополнить баланс</span>
          </button>
        ) : (
          <button
            type="button"
            className={`${styles.openButton} ${styles.openButtonCta}`}
            onClick={handleOpen}
          >
            <span className={styles.buttonIcon}>
              <GiftIcon style={{ width: '19px', height: '19px' }} />
            </span>
            <span>
              {isFreeCase
                ? 'Открыть бесплатно'
                : `Открыть за ${formatMinor(gameCase.priceMinor)} TON`}
            </span>
          </button>
        )}

        {error && <span className={styles.errorHint}>{error}</span>}
      </div>

      {/* 5. Сетка наград (по референсу фото: 2 колонки, золотая рамка, черная плашка цены, плашка «Случайный») */}
      <section className={styles.rewardsSection} aria-label="Содержимое кейса">
        <div className={styles.rewardsHeader}>
          <h2 className={styles.rewardsTitle}>
            <CubeIcon style={{ width: '19px', height: '19px', verticalAlign: '-3px', marginRight: '7px', color: '#c084fc' }} />
            <span>Коллекции в этом кейсе</span>
          </h2>
          <span className={styles.rewardsCount}>{rewardRows.length} предметов</span>
        </div>

        <div className={styles.rewardsGrid}>
          {rewardRows.map(({ gift, chance }) => (
            <div key={gift.id} className={styles.rewardCard}>
              {/* Плашка цены в правом верхнем углу (как на фото) */}
              <span className={styles.rewardPriceBadge}>
                {formatMinor(gift.priceMinor)}
                <TonIcon style={{ width: '11px', height: '11px', marginLeft: '3px' }} />
              </span>

              {/* 3D изображение предмета */}
              <div className={styles.rewardImageWrap}>
                <img className={styles.rewardImage} src={gift.image} alt={gift.name} loading="lazy" />
              </div>

              {/* Название */}
              <strong className={styles.rewardName}>{gift.name}</strong>

              {/* Нижняя пилюля «Случайный» (как на фото) */}
              <div className={styles.rewardPill}>
                <span>Случайный</span>
                <span className={styles.rewardChance}>· {formatChance(chance)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. Модалка обычной победы */}
      {winModalOpen && spinResult && (
        <CaseWinModal
          gift={spinResult.gift}
          uid={spinResult.uid}
          onClose={handleCloseWinModal}
        />
      )}

      {/* 7. Модалка квеста с замком для кейса FREE */}
      {questModalOpen && (
        <FreeQuestModal onClose={handleCloseQuestModal} />
      )}
    </div>
  )
}
