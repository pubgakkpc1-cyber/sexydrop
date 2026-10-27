import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCrashStore, type CrashBet } from '../store/crash'
import { useWalletStore } from '../store/wallet'
import { useInventoryStore } from '../store/inventory'
import { formatMinor, mulByMultiplier } from '../lib/money'
import { makeRequestId } from '../lib/requestId'
import {
  cashout,
  CRASH_RTP,
  placeGramBet,
  startCrashEngine,
  stopCrashEngine,
  TICK_MS,
} from '../services/demoCrashService'
import { generateRoundPlayers, type SimulatedPlayer } from '../services/crashLivePlayers'
import {
  playCountdownTick,
  playRocketLaunch,
  playCrashBoom,
  playCashoutWin,
  isSoundEnabled,
  setSoundMuted,
} from '../lib/sound'
import { getWebApp } from '../lib/telegram'
import { BetSheet } from '../components/games/BetSheet'
import {
  ChevronLeftIcon,
  TonIcon,
  FlameIcon,
  VolumeIcon,
  VolumeMuteIcon,
  ZapIcon,
  StarIcon,
  CrownIcon,
  SparkleIcon,
  RocketIcon,
} from '../components/shell/icons'
import { giftById, gifts, type Gift } from '../data/catalog'
import { cx } from '../lib/cx'
import styles from './CrashScreen.module.css'

// Сгенерированные фоновые звёзды арены
const STARS = [
  { left: '12%', top: '22%', size: 2, opacity: 0.7 },
  { left: '28%', top: '65%', size: 1.5, opacity: 0.5 },
  { left: '45%', top: '18%', size: 2.5, opacity: 0.8 },
  { left: '60%', top: '78%', size: 1.5, opacity: 0.6 },
  { left: '72%', top: '28%', size: 3, opacity: 0.85 },
  { left: '84%', top: '55%', size: 2, opacity: 0.65 },
  { left: '92%', top: '15%', size: 1.5, opacity: 0.75 },
  { left: '18%', top: '82%', size: 2, opacity: 0.5 },
  { left: '38%', top: '42%', size: 1, opacity: 0.4 },
  { left: '54%', top: '88%', size: 2, opacity: 0.7 },
  { left: '78%', top: '85%', size: 1.5, opacity: 0.5 },
]

// Предустановленные значения автовывода
const AUTO_CASHOUT_OPTIONS = [null, 1.5, 2.0, 3.0, 5.0]

interface CountdownTheme {
  color: string
  glow: string
  bgGlow: string
  ringGradient: string
}

const COUNTDOWN_THEMES: Record<number, CountdownTheme> = {
  5: {
    color: '#38bdf8',
    glow: '0 0 24px rgba(56, 189, 248, 0.65)',
    bgGlow: 'radial-gradient(circle, rgba(56, 189, 248, 0.22) 0%, rgba(14, 13, 20, 0.9) 70%)',
    ringGradient: 'url(#countdownGrad5)',
  },
  4: {
    color: '#a855f7',
    glow: '0 0 24px rgba(168, 85, 247, 0.7)',
    bgGlow: 'radial-gradient(circle, rgba(168, 85, 247, 0.24) 0%, rgba(14, 13, 20, 0.9) 70%)',
    ringGradient: 'url(#countdownGrad4)',
  },
  3: {
    color: '#fbbf24',
    glow: '0 0 26px rgba(251, 191, 36, 0.75)',
    bgGlow: 'radial-gradient(circle, rgba(251, 191, 36, 0.25) 0%, rgba(14, 13, 20, 0.9) 70%)',
    ringGradient: 'url(#countdownGrad3)',
  },
  2: {
    color: '#fb923c',
    glow: '0 0 28px rgba(251, 146, 60, 0.8)',
    bgGlow: 'radial-gradient(circle, rgba(251, 146, 60, 0.28) 0%, rgba(14, 13, 20, 0.9) 70%)',
    ringGradient: 'url(#countdownGrad2)',
  },
  1: {
    color: '#ef4444',
    glow: '0 0 34px rgba(239, 68, 68, 0.9)',
    bgGlow: 'radial-gradient(circle, rgba(239, 68, 68, 0.32) 0%, rgba(14, 13, 20, 0.9) 70%)',
    ringGradient: 'url(#countdownGrad1)',
  },
}

export function CrashScreen() {
  const navigate = useNavigate()
  const { phase, ticksLeft, multiplier, history, myBet, roundId } = useCrashStore()
  const wallet = useWalletStore()
  const balance = wallet.balances[wallet.mode]

  const [betSheetOpen, setBetSheetOpen] = useState(false)
  const [soundActive, setSoundActive] = useState(() => isSoundEnabled())
  const [autoCashout, setAutoCashout] = useState<number | null>(null)
  const [cosmicReward, setCosmicReward] = useState<Gift | null>(null)

  // Пул живых игроков раунда
  const [players, setPlayers] = useState<SimulatedPlayer[]>([])

  // Предыдущие значения для аудио/тактильного триггера
  const prevPhaseRef = useRef(phase)
  const prevSecRef = useRef<number>(-1)

  // Запуск локального движка при входе
  useEffect(() => {
    startCrashEngine()
    return () => stopCrashEngine()
  }, [])

  // Обновление игроков при смене раунда
  useEffect(() => {
    setPlayers(generateRoundPlayers(roundId))
  }, [roundId])

  // Расчёт секунд обратного отсчёта (5.0с .. 0.0с)
  const secondsLeft = (ticksLeft * TICK_MS) / 1000

  // Звуковые и тактильные эффекты фаз
  useEffect(() => {
    const prevPhase = prevPhaseRef.current
    if (prevPhase !== phase) {
      if (phase === 'flying') {
        playRocketLaunch()
        getWebApp()?.HapticFeedback?.impactOccurred('heavy')
      } else if (phase === 'crashed') {
        playCrashBoom()
        getWebApp()?.HapticFeedback?.notificationOccurred('error')
      }
      prevPhaseRef.current = phase
    }
  }, [phase])

  // Тики обратного отсчёта
  useEffect(() => {
    if (phase === 'betting') {
      const wholeSec = Math.ceil(secondsLeft)
      if (wholeSec !== prevSecRef.current && wholeSec >= 1 && wholeSec <= 5) {
        playCountdownTick(wholeSec)
        getWebApp()?.HapticFeedback?.impactOccurred('light')
        prevSecRef.current = wholeSec
      }
    }
  }, [phase, secondsLeft])

  // Авто-вывод (Auto-Cashout)
  useEffect(() => {
    if (
      phase === 'flying' &&
      myBet?.status === 'active' &&
      autoCashout !== null &&
      multiplier >= autoCashout
    ) {
      handleCashout()
    }
  }, [phase, multiplier, myBet, autoCashout])

  // Естественные координаты и динамика полёта ракеты (горизонтальное парение в центре космоса)
  const flightProgress = Math.min(1, Math.max(0, Math.log2(multiplier) / 2.8))
  // Старт на 28%, плавный выход на 48% (центр экрана)
  const rocketLeft = 28 + flightProgress * 20
  // Удержание высоты под множителем для идеальной читаемости
  const rocketTop = 56 - flightProgress * 6
  // Угол тангажа: базовая ориентация -16° (чтобы корпус летел горизонтально, как в референсе)
  const rocketAngle = -16 + Math.min(6, flightProgress * 4)

  // Обработка ручного вывода
  const handleCashout = () => {
    playCashoutWin()
    getWebApp()?.HapticFeedback?.notificationOccurred('success')
    const res = cashout(makeRequestId())

    // Если выпал равноценный NFT или высокий полёт — показываем модалку
    if (res.status === 'ok') {
      if (res.wonGift) {
        setCosmicReward(res.wonGift)
      } else if (res.multiplier >= 2.5 && Math.random() < 0.45) {
        const dropCandidates = gifts.filter((g) => g.rarity !== 'common')
        const chosen = dropCandidates[Math.floor(Math.random() * dropCandidates.length)]
        if (chosen) {
          useInventoryStore.getState().addGifts([chosen.id], 'crash-drop')
          setCosmicReward(chosen)
        }
      }
    }
  }

  // Быстрая ставка GRAM в один клик
  const handleQuickBet = (amountGram: number) => {
    if (phase !== 'betting' || myBet !== null) return
    const amountMinor = Math.round(amountGram * 1000)
    placeGramBet(amountMinor, makeRequestId())
  }

  // Переключение звука
  const toggleSound = () => {
    const next = !soundActive
    setSoundActive(next)
    setSoundMuted(!next)
  }

  // Тема обратного отсчёта от 5 с плавными неоновыми переливами
  const countNumber = Math.min(5, Math.max(1, Math.ceil(secondsLeft)))
  const currentTheme = COUNTDOWN_THEMES[countNumber] ?? COUNTDOWN_THEMES[1]!
  const countdownDashoffset = 364.4 * (1 - Math.max(0, Math.min(1, secondsLeft / 5.0)))

  return (
    <div className={styles.screen}>
      {/* 1. Верхний чистый бар SEXY DROP (убран мусор, единая строка) */}
      <div className={styles.topHeader}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={() => navigate(-1)}
          aria-label="Назад"
        >
          <ChevronLeftIcon className={styles.backIcon} aria-hidden />
          <span className={styles.backText}>Назад</span>
        </button>

        <div className={styles.brandBadge}>
          <FlameIcon className={styles.brandFire} aria-hidden />
          <span className={styles.brandTitle}>SEXY DROP</span>
          <span className={styles.demoChip}>Demo Mode</span>
        </div>

        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.soundBtn}
            onClick={toggleSound}
            aria-label={soundActive ? 'Выключить звук' : 'Включить звук'}
          >
            {soundActive ? (
              <VolumeIcon className={styles.soundIcon} />
            ) : (
              <VolumeMuteIcon className={styles.soundIcon} />
            )}
          </button>

          <button
            type="button"
            className={styles.balancePill}
            onClick={() => navigate('/profile')}
            aria-label="Пополнить баланс"
          >
            <TonIcon className={styles.diamondIcon} />
            <span>{formatMinor(balance)}</span>
            <span className={styles.plusBadge}>+</span>
          </button>
        </div>
      </div>

      <h1 className={styles.srOnly}>Ракетка</h1>

      {/* 3. Космическая Арена Полёта Ракеты */}
      <div className={styles.arena} data-phase={phase} aria-label="Арена полёта ракеты">
        {/* Фоновые звёзды */}
        <div className={styles.starField} aria-hidden>
          {STARS.map((s, i) => (
            <span
              key={i}
              className={styles.star}
              style={{
                left: s.left,
                top: s.top,
                width: `${s.size}px`,
                height: `${s.size}px`,
                opacity: s.opacity,
              }}
            />
          ))}
        </div>

        {/* Скоростные линии гиперпространства при полёте */}
        {phase === 'flying' && (
          <div className={styles.speedLinesContainer} aria-hidden>
            <span
              className={styles.speedLine}
              style={{ top: '25%', width: '140px', animationDelay: '0s' }}
            />
            <span
              className={styles.speedLine}
              style={{ top: '48%', width: '180px', animationDelay: '0.2s' }}
            />
            <span
              className={styles.speedLine}
              style={{ top: '70%', width: '120px', animationDelay: '0.4s' }}
            />
          </div>
        )}

        {/* Маркеры космического дропа */}
        <div className={styles.milestonesRow} aria-hidden>
          <span
            className={cx(
              styles.milestoneBadge,
              phase === 'flying' && multiplier >= 2.0 && styles.milestoneActive,
            )}
          >
            <ZapIcon className={styles.milestoneIcon} />
            <span>2x Дроп</span>
          </span>
          <span
            className={cx(
              styles.milestoneBadge,
              phase === 'flying' && multiplier >= 5.0 && styles.milestoneActive,
            )}
          >
            <StarIcon className={styles.milestoneIcon} />
            <span>5x Редкий</span>
          </span>
          <span
            className={cx(
              styles.milestoneBadge,
              phase === 'flying' && multiplier >= 10.0 && styles.milestoneActive,
            )}
          >
            <CrownIcon className={styles.milestoneIcon} />
            <span>10x Легендарный</span>
          </span>
        </div>

        {/* Ракета (оригинальный хромированный спейс-джет с естественным аэродинамическим парением) */}
        {phase === 'flying' && (
          <div
            className={styles.rocketWrapper}
            style={{
              left: `${rocketLeft}%`,
              top: `${rocketTop}%`,
              transform: `translate(-50%, -50%) rotate(${rocketAngle}deg)`,
            }}
            aria-hidden
          >
            <div className={styles.rocketHover}>
              <img
                src="/games/crash_rocket.png"
                alt="Ракета"
                className={styles.rocketImg}
              />
              <span className={styles.rocketFlameGlow} />
            </div>
          </div>
        )}

        {/* ФАЗА 1: Круговой таймер обратного отсчёта от 5 (мини-моушен и плавные переливы цветов) */}
        {phase === 'betting' && (
          <div className={styles.countdownCenter}>
            <div
              className={styles.countdownCircle}
              style={{
                background: currentTheme.bgGlow,
                boxShadow: currentTheme.glow,
                borderColor: currentTheme.color,
              }}
            >
              {/* Пульсирующая ударная волна на каждый тик секунды */}
              <div
                key={`ripple-${countNumber}`}
                className={styles.countdownRipple}
                style={{ borderColor: currentTheme.color }}
              />

              <svg className={styles.countdownSvg} viewBox="0 0 130 130">
                <defs>
                  <linearGradient id="countdownGrad5" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#818cf8" />
                  </linearGradient>
                  <linearGradient id="countdownGrad4" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                  <linearGradient id="countdownGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                  <linearGradient id="countdownGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fb923c" />
                    <stop offset="100%" stopColor="#f97316" />
                  </linearGradient>
                  <linearGradient id="countdownGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f43f5e" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                </defs>
                <circle
                  cx="65"
                  cy="65"
                  r="58"
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="4"
                />
                <circle
                  cx="65"
                  cy="65"
                  r="58"
                  fill="none"
                  stroke={currentTheme.ringGradient}
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray="364.4"
                  strokeDashoffset={countdownDashoffset}
                  transform="rotate(-90 65 65)"
                  className={styles.countdownProgressCircle}
                />
              </svg>

              {/* Число с мини-моушен анимацией */}
              <span
                key={countNumber}
                className={styles.countdownNumber}
                style={{ color: currentTheme.color, textShadow: currentTheme.glow }}
              >
                {countNumber}
              </span>
            </div>

            {/* Скрыто визуально (без мини-текста снизу, как требовалось), доступно для ассистивных технологий и тестов */}
            <span className={styles.srOnly}>
              Старт через {secondsLeft.toFixed(1)}с
            </span>
          </div>
        )}

        {/* ФАЗА 2: Полёт — текущий множитель */}
        {phase === 'flying' && (
          <div className={styles.flyingCenter}>
            <span className={styles.multiplierFlying}>x{multiplier.toFixed(2)}</span>
          </div>
        )}

        {/* ФАЗА 3: Краш — взрыв и гигантский множитель (1:1 из кадра 11) */}
        {phase === 'crashed' && (
          <div className={styles.crashedCenter}>
            <span className={styles.multiplierCrashed}>x{multiplier.toFixed(2)}</span>
            <span className={styles.crashedLabel}>Улетел!</span>
            {/* Частицы взрыва */}
            {Array.from({ length: 16 }).map((_, idx) => {
              const angle = (idx / 16) * 360
              const rad = (angle * Math.PI) / 180
              const dist = 55 + (idx % 4) * 20
              return (
                <span
                  key={idx}
                  className={styles.explosionParticle}
                  style={
                    {
                      left: `${rocketLeft}%`,
                      top: `${rocketTop}%`,
                      width: `${4 + (idx % 3) * 2}px`,
                      height: `${4 + (idx % 3) * 2}px`,
                      background: idx % 2 === 0 ? '#ef4444' : '#f59e0b',
                      '--tx': `${Math.cos(rad) * dist}px`,
                      '--ty': `${Math.sin(rad) * dist}px`,
                    } as React.CSSProperties
                  }
                />
              )
            })}
          </div>
        )}
      </div>

      {/* 4. История крашей (Горизонтальные капсулы 1:1 из видео) */}
      <div className={styles.historyRow} aria-label="История крашей">
        {/* В фазе ставок показываем бейдж BET; в фазе полёта — живой множитель */}
        {phase === 'betting' && (
          <span className={cx(styles.historyPill, styles.activeLivePill)}>
            BET
          </span>
        )}
        {phase === 'flying' && (
          <span className={cx(styles.historyPill, styles.activeLivePill)}>
            <span className={styles.activeLiveDot} />
            x{multiplier.toFixed(2)}
          </span>
        )}

        {/* Предыдущие раунды с цветными рамками по величине */}
        {history.map((val, idx) => {
          let tierClass = styles.tierSlate
          if (val >= 10.0) tierClass = styles.tierGold
          else if (val >= 5.0) tierClass = styles.tierMagenta
          else if (val >= 2.0) tierClass = styles.tierPurple

          return (
            <span
              key={`${idx}-${val}`}
              className={cx(
                styles.historyPill,
                tierClass,
                phase === 'crashed' && idx === 0 && styles.activeLivePill,
              )}
            >
              {phase === 'crashed' && idx === 0 && <span className={styles.activeLiveDot} />}
              x{val.toFixed(2)}
            </span>
          )
        })}
      </div>

      {/* 5. Главная кнопка действия (Сделать ставку / Забрать) */}
      <div className={styles.actionArea}>
        {phase === 'betting' && myBet === null && (
          <button
            type="button"
            className={cx(styles.mainActionBtn, styles.btnBetting)}
            onClick={() => setBetSheetOpen(true)}
          >
            <span className={styles.btnGlassHighlight} />
            <span>Сделать ставку</span>
          </button>
        )}

        {phase === 'betting' && myBet !== null && myBet.status === 'active' && (
          <div className={styles.betLocked} aria-label="Ставка принята">
            <span>Ставка принята</span>
            <strong>{betValueLabel(myBet)}</strong>
          </div>
        )}

        {phase === 'flying' &&
          (myBet === null ? (
            <p className={styles.betMuted}>Раунд идёт — ставку можно сделать в следующем</p>
          ) : myBet.status === 'active' ? (
            <button
              type="button"
              className={cx(styles.mainActionBtn, styles.btnCashout)}
              onClick={handleCashout}
              aria-label={`Забрать x${multiplier.toFixed(2)}`}
            >
              <span className={styles.btnGlassHighlight} />
              <span>
                Забрать x{multiplier.toFixed(2)} (+
                {formatMinor(mulByMultiplier(myBet.valueMinor, multiplier))} TON)
              </span>
            </button>
          ) : (
            <ResultLine myBet={myBet} />
          ))}

        {phase === 'crashed' &&
          (myBet !== null ? (
            <ResultLine myBet={myBet} />
          ) : (
            <p className={styles.betMuted}>Раунд завершился</p>
          ))}

        {/* Быстрые фишки ставок и автовывод */}
        {phase === 'betting' && myBet === null && (
          <div className={styles.quickControlsRow}>
            <div className={styles.quickChipsGroup}>
              <button
                type="button"
                className={styles.quickChip}
                onClick={() => handleQuickBet(0.1)}
              >
                +0.1
              </button>
              <button
                type="button"
                className={styles.quickChip}
                onClick={() => handleQuickBet(0.5)}
              >
                +0.5
              </button>
              <button
                type="button"
                className={styles.quickChip}
                onClick={() => handleQuickBet(1.0)}
              >
                +1.0
              </button>
              <button
                type="button"
                className={styles.quickChip}
                onClick={() => handleQuickBet(2.0)}
              >
                +2.0
              </button>
              <button
                type="button"
                className={styles.quickChip}
                onClick={() => handleQuickBet(5.0)}
              >
                +5.0
              </button>
            </div>

            <button
              type="button"
              className={styles.autoCashoutPill}
              onClick={() => {
                const nextIdx =
                  (AUTO_CASHOUT_OPTIONS.indexOf(autoCashout) + 1) %
                  AUTO_CASHOUT_OPTIONS.length
                setAutoCashout(AUTO_CASHOUT_OPTIONS[nextIdx] ?? null)
              }}
              title="Переключить авто-вывод"
            >
              <span>Авто: {autoCashout ? `${autoCashout}x` : 'Выкл'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 6. Список живых ставок игроков (1:1 из видео с аватарками и Telegram NFT) */}
      <div className={styles.liveBetsSection}>
        <div className={styles.liveBetsHeader}>
          <span className={styles.liveBetsTitle}>Ставки раунда</span>
          <span className={styles.liveBetsCount}>
            {players.length + (myBet ? 1 : 0)} игроков
          </span>
        </div>

        <div className={styles.playersList}>
          {/* Если пользователь сделал ставку — его карточка закреплена первой */}
          {myBet && (
            <div
              className={cx(
                styles.playerCard,
                styles.playerCardUser,
                myBet.status === 'won' && styles.playerCardWon,
              )}
            >
              <div className={styles.playerLeft}>
                <img
                  src="/avatars/user_1.png"
                  alt="Вы"
                  className={styles.playerAvatar}
                />
                <div className={styles.playerInfo}>
                  <div className={styles.playerNameRow}>
                    <span className={styles.playerName}>Вы</span>
                    <span className={styles.userBadge}>YOU</span>
                  </div>
                  <div className={styles.playerStakeRow}>
                    <TonIcon className={styles.playerStakeDiamond} />
                    <span>
                      {formatMinor(myBet.valueMinor)} ×
                      {phase === 'crashed'
                        ? (myBet.cashedMultiplier ?? multiplier).toFixed(2)
                        : multiplier.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.playerRight}>
                {myBet.status === 'won' ? (
                  <span className={cx(styles.playerProfitPill, styles.profitWon)}>
                    <TonIcon className={styles.profitTonIcon} />
                    <span>+{formatMinor(myBet.wonMinor ?? 0)}</span>
                  </span>
                ) : phase === 'flying' ? (
                  <span className={styles.playerProfitPill}>
                    <TonIcon className={styles.profitTonIcon} />
                    <span>{formatMinor(mulByMultiplier(myBet.valueMinor, multiplier))}</span>
                  </span>
                ) : (
                  <span className={styles.playerProfitPill}>
                    <TonIcon className={styles.profitTonIcon} />
                    <span>{formatMinor(myBet.valueMinor)}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Игроки раунда */}
          {players.map((p) => {
            const isCashed =
              phase === 'crashed'
                ? p.targetMultiplier <= multiplier
                : phase === 'flying' && multiplier >= p.targetMultiplier
            const multToShow = isCashed
              ? p.targetMultiplier
              : phase === 'crashed'
                ? multiplier
                : multiplier
            const profitMinor = Math.round(p.stakeMinor * multToShow)
            const wonGift = p.wonGiftId ? giftById.get(p.wonGiftId) : undefined

            return (
              <div
                key={p.id}
                className={cx(styles.playerCard, isCashed && styles.playerCardWon)}
              >
                <div className={styles.playerLeft}>
                  <img
                    src={p.avatar}
                    alt={p.name}
                    className={styles.playerAvatar}
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src = '/avatars/user_1.png'
                    }}
                  />
                  <div className={styles.playerInfo}>
                    <div className={styles.playerNameRow}>
                      <span className={styles.playerName}>{p.name}</span>
                    </div>
                    <div className={styles.playerStakeRow}>
                      <TonIcon className={styles.playerStakeDiamond} />
                      <span>
                        {formatMinor(p.stakeMinor)} ×{multToShow.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.playerRight}>
                  <span
                    className={cx(
                      styles.playerProfitPill,
                      isCashed && styles.profitWon,
                    )}
                  >
                    <TonIcon className={styles.profitTonIcon} />
                    <span>{formatMinor(isCashed ? profitMinor : p.stakeMinor)}</span>
                  </span>

                  {/* Telegram NFT подарок при высоком кешауте (1:1 из видео) */}
                  {isCashed && wonGift && (
                    <img
                      src={wonGift.image}
                      alt={wonGift.name}
                      title={`Выиграл ${wonGift.name}`}
                      className={styles.playerGiftWon}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Обязательная заметка спецификации TIER 4.2 */}
      <p className={styles.note}>
        Demo Mode: раунды генерируются локально (RTP {CRASH_RTP}), множитель растёт ×2
        каждые 4 секунды. Серверные раунды, общий множитель и Provably Fair —
        TIER 7 (4.3). Других игроков в демо нет (симуляция живого лобби).
      </p>

      {/* Шит ставки (Dual Betting: GRAM или Подарок) */}
      <BetSheet open={betSheetOpen} onClose={() => setBetSheetOpen(false)} />

      {/* Модальное окно Космического Дропа / Победы с равноценным NFT */}
      {cosmicReward && (
        <div
          className={styles.cosmicModalOverlay}
          onClick={() => setCosmicReward(null)}
        >
          <div
            className={styles.cosmicModalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={styles.cosmicModalTitle}>
              <RocketIcon className={styles.cosmicTitleIcon} />
              <span>Выигран NFT подарок!</span>
            </h3>
            <p className={styles.cosmicModalSubtitle}>
              Равноценный Telegram NFT зачислен прямо в ваш инвентарь!
            </p>
            <img
              src={cosmicReward.image}
              alt={cosmicReward.name}
              className={styles.cosmicRewardImg}
            />
            <strong style={{ color: '#ffffff', fontSize: '17px' }}>
              {cosmicReward.name}
            </strong>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3px',
                margin: '4px 0 16px',
              }}
            >
              <span
                style={{
                  fontSize: '14px',
                  color: '#38bdf8',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 700,
                }}
              >
                <TonIcon style={{ width: '15px', height: '15px' }} />
                <span>Стоимость: {formatMinor(cosmicReward.priceMinor)} TON</span>
              </span>
              {cosmicReward.fragmentFloorTon && (
                <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.55)' }}>
                  Флор на Fragment: ~{cosmicReward.fragmentFloorTon} TON
                </span>
              )}
            </div>
            <button
              type="button"
              className={styles.cosmicClaimBtn}
              onClick={() => setCosmicReward(null)}
            >
              <span>Забрать в инвентарь</span>
              <SparkleIcon style={{ width: '16px', height: '16px', marginLeft: '6px' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function betValueLabel(bet: CrashBet): string {
  if (bet.kind === 'gram') return `${formatMinor(bet.valueMinor)} TON`
  const gift = bet.giftId ? giftById.get(bet.giftId) : undefined
  return gift ? gift.name : 'Подарок'
}

function ResultLine({
  myBet,
}: {
  myBet: {
    status: 'active' | 'won' | 'lost'
    valueMinor: number
    wonMinor?: number
    cashedMultiplier?: number
    wonGift?: Gift
  }
}) {
  if (myBet.status === 'won') {
    if (myBet.wonGift) {
      return (
        <p className={styles.resultWon}>
          Выигран NFT {myBet.wonGift.name} ({formatMinor(myBet.wonMinor ?? 0)} TON)
        </p>
      )
    }
    return (
      <p className={styles.resultWon}>
        Выигрыш +{formatMinor(myBet.wonMinor ?? 0)} TON (x
        {myBet.cashedMultiplier?.toFixed(2)})
      </p>
    )
  }
  return <p className={styles.resultLost}>Ставка сгорела</p>
}
