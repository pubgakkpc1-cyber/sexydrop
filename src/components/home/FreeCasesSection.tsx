import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { freeCases, type FreeCaseId } from '../../data/catalog'
import { claimFreeCase } from '../../services/demoCaseService'
import { useFreeCasesStore } from '../../store/freeCases'
import { makeRequestId } from '../../lib/requestId'
import { hapticNotify } from '../../lib/telegram'
import { CalendarIcon, ClockIcon, GiftIcon } from '../shell/icons'
import { cx } from '../../lib/cx'
import { ResultModal } from '../cases/ResultModal'
import styles from './FreeCasesSection.module.css'

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * Бесплатные кейсы (7.3 / 10.10) в оформлении референса: плитки FREE24 (жёлтая
 * рамка, раз в 24 часа) и FREE (сиреневая рамка, раз в час) с пилюлей «FREE».
 * В Demo Mode кулдауны хранятся локально и помечены как демо; в production
 * право получения и лимиты проверяет backend по серверному времени (TIER 7).
 */
export function FreeCasesSection() {
  const lastClaimAt = useFreeCasesStore((s) => s.lastClaimAt)
  const [now, setNow] = useState(() => Date.now())
  const [resultGiftId, setResultGiftId] = useState<string | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <section className={styles.section} aria-label="Бесплатные кейсы">
      <h2 className={styles.title}>Бесплатные кейсы</h2>
      <div className={styles.grid}>
        {freeCases.map((gameCase) => {
          const caseId = gameCase.id as FreeCaseId
          const isDaily = caseId === 'free24'
          const last = lastClaimAt[caseId]
          const availableAt = last === 0 ? 0 : last + (gameCase.freeCooldownMs ?? 0)
          const available = availableAt <= now
          return (
            <div key={gameCase.id} className={cx(styles.tile, isDaily ? styles.daily : styles.hourly)}>
              <span className={cx(styles.headline, isDaily ? styles.headlineGold : styles.headlinePurple)}>
                {isDaily ? 'FREE24' : 'FREE'}
              </span>
              <Link
                to={`/case/${gameCase.id}`}
                className={styles.imageLink}
                aria-label={`Кейс ${gameCase.name}`}
              >
                <img className={styles.image} src={gameCase.image} alt="" />
              </Link>
              <span className={styles.footer}>
                <span className={styles.freeLabel}>
                  Free
                  {isDaily && <span className={styles.freePeriod}>24h</span>}
                </span>
                {available ? (
                  <button
                    type="button"
                    className={cx(styles.claimPill, isDaily ? styles.claimGold : styles.claimPurple)}
                    onClick={() => {
                      const result = claimFreeCase(caseId, makeRequestId(), Date.now())
                      if (result.status === 'ok') {
                        hapticNotify('success')
                        setResultGiftId(result.giftId)
                      }
                    }}
                  >
                    {isDaily ? <CalendarIcon className={styles.pillIcon} aria-hidden /> : <GiftIcon className={styles.pillIcon} aria-hidden />}
                    FREE
                    <span className={styles.srClaim}> — забрать кейс {gameCase.name}</span>
                  </button>
                ) : (
                  <span className={cx(styles.claimPill, styles.waiting)} role="timer">
                    <ClockIcon className={cx(styles.pillIcon, styles.clock)} aria-hidden />
                    {formatCountdown(availableAt - now)}
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </div>
      <ResultModal giftId={resultGiftId} onClose={() => setResultGiftId(null)} />
    </section>
  )
}
