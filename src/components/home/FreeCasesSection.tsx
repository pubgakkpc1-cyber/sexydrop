import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { freeCases, type FreeCaseId } from '../../data/catalog'
import { useFreeCasesStore, getMsk23ResetInfo } from '../../store/freeCases'
import { ClockIcon, SparkleIcon, LockIcon } from '../shell/icons'
import { cx } from '../../lib/cx'
import styles from './FreeCasesSection.module.css'

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function FreeCasesSection() {
  const lastClaimAt = useFreeCasesStore((s) => s.lastClaimAt)
  const quest = useFreeCasesStore((s) => s.quest)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const resetInfo = getMsk23ResetInfo(now)

  return (
    <section className={styles.section} aria-label="Бесплатные кейсы">
      <div className={styles.headerRow}>
        <h2 className={styles.title}>
          <SparkleIcon className={styles.titleIcon} aria-hidden />
          <span>Бесплатные кейсы</span>
        </h2>
        <span className={styles.resetBadge}>
          Сброс в 23:00 МСК
        </span>
      </div>

      <div className={styles.grid}>
        {freeCases.map((gameCase) => {
          const caseId = gameCase.id as FreeCaseId
          const isDaily = caseId === 'free24'
          const lastClaim = lastClaimAt[caseId]
          const available = resetInfo.isAvailable(lastClaim)
          const remainingMs = resetInfo.remainingMs

          const hasPendingQuest =
            !isDaily && quest.pendingReward !== null && now < quest.pendingReward.expiresAt

          return (
            <Link
              key={gameCase.id}
              to={`/case/${gameCase.id}`}
              className={cx(
                styles.tile,
                isDaily ? styles.tileDaily : styles.tileQuest,
                available && styles.tileAvailable,
              )}
              aria-label={`Кейс ${gameCase.name} — открыть`}
            >
              {/* Беспаливный световой блик (shimmer) */}
              <div className={styles.shimmerEffect} aria-hidden />

              {/* Верхняя строка бейджей */}
              <div className={styles.topBadgesRow}>
                <span className={cx(styles.categoryPill, isDaily ? styles.pillGold : styles.pillPurple)}>
                  {isDaily ? '⚡ 24 ЧАСА' : '⭐ 5 ДРУЗЕЙ'}
                </span>
                <span className={styles.freeZeroBadge}>0 TON</span>
              </div>

              {/* 3D Арт кейса с эффектом левитации и радиальным свечением */}
              <div className={styles.artWrapper}>
                <div
                  className={cx(styles.artGlow, isDaily ? styles.glowGold : styles.glowPurple)}
                  aria-hidden
                />
                <img
                  className={styles.image}
                  src={gameCase.image}
                  alt={gameCase.name}
                  loading="lazy"
                />
              </div>

              {/* Название и статус */}
              <div className={styles.infoCol}>
                <span className={cx(styles.caseName, isDaily ? styles.nameGold : styles.namePurple)}>
                  {isDaily ? 'FREE 24' : 'FREE'}
                </span>
                <span className={styles.caseSubtext}>
                  {isDaily ? 'Ежедневный сундук' : 'Дроп до 100 TON'}
                </span>
              </div>

              {/* Нижняя кнопка-статус (клик переходит на карточку кейса) */}
              <div className={styles.statusFooter}>
                {hasPendingQuest ? (
                  <span className={cx(styles.actionPill, styles.pillLocked)}>
                    <LockIcon className={styles.pillIcon} aria-hidden />
                    <span>Квест: 3 дня</span>
                  </span>
                ) : available ? (
                  <span
                    className={cx(
                      styles.actionPill,
                      isDaily ? styles.pillReadyGold : styles.pillReadyPurple,
                    )}
                  >
                    <span className={styles.pulseDot} />
                    <span>{isDaily ? 'Открыть' : 'Крутить'}</span>
                  </span>
                ) : (
                  <span className={cx(styles.actionPill, styles.pillWaiting)}>
                    <ClockIcon className={styles.pillIcon} aria-hidden />
                    <span>{formatCountdown(remainingMs)}</span>
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
