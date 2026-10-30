import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCrashStore, type CrashBet } from '../store/crash'
import { useWalletStore } from '../store/wallet'
import { useInventoryStore } from '../store/inventory'
import { mulByMultiplier } from '../lib/money'
import { makeRequestId } from '../lib/requestId'
import {
  cashout,
  cancelQueuedNextRoundBet,
  startCrashEngine,
  stopCrashEngine,
  TICK_MS,
} from '../services/demoCrashService'
import { generateRoundPlayers, type SimulatedPlayer } from '../services/crashLivePlayers'
import {
  playCountdownTick,
  playRocketLaunch,
  startRocketFlightSound,
  updateRocketFlightSound,
  stopRocketFlightSound,
  playCrashBoom,
  playCashoutWin,
} from '../lib/sound'
import { getWebApp, getTelegramUser } from '../lib/telegram'
import { MoneyRain } from '../components/effects/MoneyRain'
import { BetSheet } from '../components/games/BetSheet'
import { Rocket3DCanvas } from '../components/games/Rocket3DCanvas'
import { CrashMiniAdminModal } from '../components/admin/CrashMiniAdminModal'
import {
  ChevronLeftIcon,
  TonIcon,
  CrownIcon,
  SparkleIcon,
  RocketIcon,
} from '../components/shell/icons'
import { giftById, gifts, type Gift } from '../data/catalog'
import { cx } from '../lib/cx'
import styles from './CrashScreen.module.css'

interface CountdownTheme {
  color: string
  glow: string
  bgGlow: string
  ringGradient: string
}

const COUNTDOWN_THEMES: Record<number, CountdownTheme> = {
  5: {
    color: '#c7696d',
    glow: '0 0 24px rgba(199, 105, 109, 0.65)',
    bgGlow: 'radial-gradient(circle, rgba(199, 105, 109, 0.22) 0%, rgba(17, 16, 16, 0.9) 70%)',
    ringGradient: 'url(#countdownGrad5)',
  },
  4: {
    color: '#cf7d81',
    glow: '0 0 24px rgba(207, 125, 129, 0.7)',
    bgGlow: 'radial-gradient(circle, rgba(207, 125, 129, 0.24) 0%, rgba(17, 16, 16, 0.9) 70%)',
    ringGradient: 'url(#countdownGrad4)',
  },
  3: {
    color: '#c35c61',
    glow: '0 0 26px rgba(195, 92, 97, 0.75)',
    bgGlow: 'radial-gradient(circle, rgba(195, 92, 97, 0.25) 0%, rgba(17, 16, 16, 0.9) 70%)',
    ringGradient: 'url(#countdownGrad3)',
  },
  2: {
    color: '#c96e72',
    glow: '0 0 28px rgba(201, 110, 114, 0.8)',
    bgGlow: 'radial-gradient(circle, rgba(201, 110, 114, 0.28) 0%, rgba(17, 16, 16, 0.9) 70%)',
    ringGradient: 'url(#countdownGrad2)',
  },
  1: {
    color: '#ce6565',
    glow: '0 0 34px rgba(206, 101, 101, 0.9)',
    bgGlow: 'radial-gradient(circle, rgba(206, 101, 101, 0.32) 0%, rgba(17, 16, 16, 0.9) 70%)',
    ringGradient: 'url(#countdownGrad1)',
  },
}

/** TON в карточках игроков: максимум 1 знак после точки (округление вниз), целые без «.0». */
function formatCardTon(minor: number): string {
  if (minor <= 0) return '0'
  const val = Math.floor(minor / 100) / 10
  return Number.isInteger(val) ? `${val}` : val.toFixed(1)
}

/** Множитель: максимум 1 знак после точки (вниз), например 1.65 → 1.6 */
/** Число с выровненной десятичной точкой: целая часть прижата вправо, дробная — фиксированной ширины */
function AmountSplit({ text }: { text: string }) {
  const [int, frac] = text.split('.')
  return (
    <>
      <span className={styles.amtInt}>{int}</span>
      <span className={styles.amtFrac}>{frac !== undefined ? `.${frac}` : ''}</span>
    </>
  )
}

function fmtMult(value: number): string {
  return (Math.floor(value * 10 + 1e-9) / 10).toFixed(1)
}

function formatTonMaxOneDecimal(minor: number): string {
  const val = Math.floor((minor / 1000) * 10) / 10
  return Number.isInteger(val) ? `${val}` : val.toFixed(1)
}

function ScreenStarfield() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof canvas.getContext !== 'function') return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    const dpr = Math.min(2, typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1)

    const stars: Array<{ x: number; y: number; size: number; speed: number; opacity: number }> = []
    const count = 85
    const initW = typeof window !== 'undefined' ? window.innerWidth : 420
    const initH = typeof window !== 'undefined' ? window.innerHeight : 840

    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * initW,
        y: Math.random() * initH,
        size: 0.8 + Math.random() * 2.2,
        speed: 0.35 + Math.random() * 1.6,
        opacity: 0.25 + Math.random() * 0.7,
      })
    }

    const render = () => {
      const w = window.innerWidth || 360
      const h = window.innerHeight || 800
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr
        canvas.height = h * dpr
      }
      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, w, h)

      for (const s of stars) {
        s.x -= s.speed
        if (s.x < 0) {
          s.x = w + Math.random() * 25
          s.y = Math.random() * h
        }
        ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size / 2, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)
    return () => cancelAnimationFrame(animId)
  }, [])

  return <canvas ref={canvasRef} className={styles.screenStarfield} aria-hidden />
}

export function CrashScreen() {
  const navigate = useNavigate()
  const { phase, ticksLeft, multiplier, history, myBet, roundId, queuedNextBet } = useCrashStore()
  const wallet = useWalletStore()
  const balance = wallet.balances[wallet.mode]

  const [betSheetOpen, setBetSheetOpen] = useState(false)
  const [adminModalOpen, setAdminModalOpen] = useState(false)
  const [cosmicReward, setCosmicReward] = useState<Gift | null>(null)

  // Проверка супер-администратора (@zapixxgarant)
  const tgUser = useMemo(() => getTelegramUser(), [])
  const cleanUsername = (tgUser?.username || '').toLowerCase().replace(/^@/, '')
  const isAdmin =
    cleanUsername === 'zapixxgarant' ||
    (typeof window !== 'undefined' && window.localStorage?.getItem('sexydrop_admin') === 'true')

  // Динамический фон арены по тирам множителя
  const bgTier = useMemo(() => {
    if (phase !== 'flying' && phase !== 'crashed') return 'cosmic'
    if (multiplier >= 10.0) return 'supernova'
    if (multiplier >= 5.0) return 'hyper'
    if (multiplier >= 2.0) return 'nebula'
    return 'cosmic'
  }, [phase, multiplier])

  // Плавный переход цвета и свечения множителя
  const multColor = useMemo(() => {
    if (multiplier >= 10.0) return '#dda3a6'
    if (multiplier >= 5.0) return '#c35c61'
    if (multiplier >= 2.0) return '#c7696d'
    return '#f8fafc'
  }, [multiplier])

  const multGlow = useMemo(() => {
    if (multiplier >= 10.0) return '0 0 24px rgba(221, 163, 166, 0.7), 0 2px 10px rgba(0, 0, 0, 0.8)'
    if (multiplier >= 5.0) return '0 0 22px rgba(195, 92, 97, 0.7), 0 2px 10px rgba(0, 0, 0, 0.8)'
    if (multiplier >= 2.0) return '0 0 20px rgba(199, 105, 109, 0.75), 0 2px 10px rgba(0, 0, 0, 0.8)'
    return '0 0 16px rgba(248, 250, 252, 0.35), 0 2px 10px rgba(0, 0, 0, 0.8)'
  }, [multiplier])

  // Пул живых игроков раунда
  const [players, setPlayers] = useState<SimulatedPlayer[]>([])
  const [showMoneyRain, setShowMoneyRain] = useState(false)
  const prevMyBetStatusRef = useRef(myBet?.status)

  // Триггер дождика деньгами при победе игрока (без просадки FPS на слабых устройствах)
  useEffect(() => {
    if (myBet?.status === 'won' && prevMyBetStatusRef.current !== 'won') {
      setShowMoneyRain(true)
    }
    prevMyBetStatusRef.current = myBet?.status
  }, [myBet?.status])


  // Предыдущие значения для аудио/тактильного триггера
  const prevPhaseRef = useRef(phase)
  const prevSecRef = useRef<number>(-1)

  // Запуск локального движка: в живом приложении ракетка всегда активна (24/7);
  // в vitest-тестах останавливается для изоляции окружения; звук полёта глушится при размонтировании
  useEffect(() => {
    startCrashEngine()
    return () => {
      stopRocketFlightSound()
      if (import.meta.env.MODE === 'test') {
        stopCrashEngine()
      }
    }
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
        startRocketFlightSound(multiplier)
        getWebApp()?.HapticFeedback?.impactOccurred('heavy')
      } else if (phase === 'crashed') {
        stopRocketFlightSound()
        playCrashBoom()
        getWebApp()?.HapticFeedback?.notificationOccurred('error')
      } else if (phase === 'betting') {
        stopRocketFlightSound()
      }
      prevPhaseRef.current = phase
    }
  }, [phase, multiplier])

  // Динамическое усиление звука турбины полёта при разгоне множителя
  useEffect(() => {
    if (phase === 'flying') {
      updateRocketFlightSound(multiplier)
    }
  }, [phase, multiplier])

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

  // Обработка ручного вывода
  const handleCashout = () => {
    playCashoutWin()
    getWebApp()?.HapticFeedback?.notificationOccurred('success')
    const res = cashout(makeRequestId())

    // Если выпал равноценный NFT или высокий полёт — показываем модалку
    if (res.status === 'ok') {
      setShowMoneyRain(true)
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


  
  // Тема обратного отсчёта от 5 с плавными неоновыми переливами
  const countNumber = Math.min(5, Math.max(1, Math.ceil(secondsLeft)))
  const currentTheme = COUNTDOWN_THEMES[countNumber] ?? COUNTDOWN_THEMES[1]!
  const countdownDashoffset = 364.4 * (1 - Math.max(0, Math.min(1, secondsLeft / 5.0)))

  // Все ставки раунда, отсортированные от большого к маленькому (от большего к меньшему)
  // со строгим отображением Telegram NFT подарка по стоимости ставки и выигрыша.
  const sortedBetRows = useMemo(() => {
    interface BetRow {
      id: string
      isUser: boolean
      name: string
      avatar: string
      stakeMinor: number
      targetMultiplier?: number
      isCashed: boolean
      multToShow: number
      profitMinor: number
      stakeGift?: Gift
      wonGift?: Gift
    }

    const rows: BetRow[] = []

    if (myBet) {
      const isWon = myBet.status === 'won'
      const multToShow =
        phase === 'crashed'
          ? (myBet.cashedMultiplier ?? multiplier)
          : multiplier
      const profitMinor = isWon
        ? (myBet.wonMinor ?? 0)
        : phase === 'flying'
          ? mulByMultiplier(myBet.valueMinor, multiplier)
          : myBet.valueMinor

      const stakeGift = myBet.giftId ? giftById.get(myBet.giftId) : undefined
      const wonGift = myBet.wonGift

      rows.push({
        id: 'user-my-bet',
        isUser: true,
        name: 'Вы',
        avatar: '/avatars/user_1.png',
        stakeMinor: myBet.valueMinor,
        isCashed: isWon,
        multToShow,
        profitMinor,
        stakeGift,
        wonGift,
      })
    }

    for (const p of players) {
      const isCashed =
        phase === 'crashed'
          ? p.targetMultiplier <= multiplier
          : phase === 'flying' && multiplier >= p.targetMultiplier
      const multToShow = isCashed ? p.targetMultiplier : multiplier
      const profitMinor = Math.round(p.stakeMinor * multToShow)
      const stakeGift = p.stakeGiftId ? giftById.get(p.stakeGiftId) : undefined

      rows.push({
        id: p.id,
        isUser: false,
        name: p.name,
        avatar: p.avatar,
        stakeMinor: p.stakeMinor,
        targetMultiplier: p.targetMultiplier,
        isCashed,
        multToShow,
        profitMinor,
        stakeGift,
      })
    }

    // Сортировка:
    // 1. Выигравшие игроки (isCashed) — ВВЕРХУ (выше всех)
    // 2. Активные ставки (в полёте) — ПОСЕРЕДИНЕ
    // 3. Слившие игроки (в фазе краша без кешаута) — В САМЫЙ НИЗ
    // Внутри каждой группы — сортировка по величине ставки (descending)
    return rows.sort((a, b) => {
      const isLostA = phase === 'crashed' && !a.isCashed
      const isLostB = phase === 'crashed' && !b.isCashed
      const priorityA = a.isCashed ? 1 : isLostA ? 3 : 2
      const priorityB = b.isCashed ? 1 : isLostB ? 3 : 2

      if (priorityA !== priorityB) {
        return priorityA - priorityB
      }
      return b.stakeMinor - a.stakeMinor
    })
  }, [players, myBet, phase, multiplier])

  return (
    <div className={styles.screen}>
      {/* Фоновый звёздный космос на весь экран под всеми элементами */}
      <ScreenStarfield />

      {/* 1. Верхний чистый бар (без лишних квадратов, только Назад и Баланс) */}
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

        <div className={styles.brandBadge} aria-label="SEXY DROP">
          <svg viewBox="0 0 24 24" className={styles.brandDrop} aria-hidden="true">
            <path d="M12 2.5c3.6 4.3 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 2.4-6.7 6-11z" fill="currentColor" />
          </svg>
          <span>SEXY DROP</span>
        </div>

        <div className={styles.headerRight}>
          {isAdmin && (
            <button
              type="button"
              className={styles.adminQuickBtn}
              onClick={() => setAdminModalOpen(true)}
              aria-label="Панель администратора"
            >
              <CrownIcon className={styles.adminCrownIcon} />
              <span>Админ</span>
            </button>
          )}

          <button
            type="button"
            className={styles.balancePill}
            onClick={() => navigate('/profile')}
            aria-label="Пополнить баланс"
          >
            <TonIcon className={styles.diamondIcon} />
            <span>{formatTonMaxOneDecimal(balance)}</span>
            <span className={styles.plusBadge}>+</span>
          </button>
        </div>
      </div>

      <h1 className={styles.srOnly}>Ракетка</h1>

      {/* 3. Космическая Арена Полёта Ракеты */}
      <div
        className={styles.arena}
        data-phase={phase}
        data-tier={bgTier}
        aria-label="Арена полёта ракеты"
      >
        {/* Высокодетализированная 3D Ракета с NFT Plush Pepe и неоновой траекторией (скины меняются автоматически каждый раунд) */}
        <Rocket3DCanvas
          phase={phase}
          multiplier={multiplier}
          roundId={roundId}
        />

        {/* ФАЗА 1: Круговой таймер обратного отсчёта от 5 */}
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
                    <stop offset="0%" stopColor="#c7696d" />
                    <stop offset="100%" stopColor="#db9ea1" />
                  </linearGradient>
                  <linearGradient id="countdownGrad4" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#cf7d81" />
                    <stop offset="100%" stopColor="#c86c70" />
                  </linearGradient>
                  <linearGradient id="countdownGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#c35c61" />
                    <stop offset="100%" stopColor="#ba464b" />
                  </linearGradient>
                  <linearGradient id="countdownGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#c96e72" />
                    <stop offset="100%" stopColor="#be5156" />
                  </linearGradient>
                  <linearGradient id="countdownGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ce656a" />
                    <stop offset="100%" stopColor="#ce6565" />
                  </linearGradient>
                </defs>
                <circle
                  cx="65"
                  cy="65"
                  r="58"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.08)"
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

            {/* Скрыто визуально, доступно для ассистивных технологий и тестов */}
            <span className={styles.srOnly}>
              Старт через {secondsLeft.toFixed(1)}с
            </span>
          </div>
        )}

        {/* ФАЗА 2: Полёт — Множитель слева, немного меньше, без рамок */}
        {phase === 'flying' && (
          <div className={styles.flyingLeft}>
            <span
              className={styles.seamlessMultiplier}
              style={{
                color: multColor,
                textShadow: multGlow,
              }}
            >
              x{fmtMult(multiplier)}
            </span>
          </div>
        )}

        {/* ФАЗА 3: Краш — слева */}
        {phase === 'crashed' && (
          <div className={styles.crashedLeft}>
            <span className={styles.multiplierCrashed}>x{fmtMult(multiplier)}</span>
            <span className={styles.crashedLabel}>Улетел!</span>
          </div>
        )}
      </div>

      {/* 4. История крашей (Горизонтальные компактные капсулы, без скролла) */}
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
            x{fmtMult(multiplier)}
          </span>
        )}

        {/* Предыдущие 7 раундов с цветными рамками по величине (не скроллятся) */}
        {history.slice(0, 7).map((val, idx) => {
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
              x{fmtMult(val)}
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
            queuedNextBet ? (
              <div className={styles.queuedBetCard}>
                <div className={styles.queuedBetInfo}>
                  <span className={styles.queuedBetBadge}>Ожидает следующий раунд</span>
                  <strong className={styles.queuedBetAmount}>
                    {queuedNextBet.kind === 'gram'
                      ? `${formatTonMaxOneDecimal(queuedNextBet.valueMinor)} TON`
                      : (giftById.get(queuedNextBet.giftId ?? '')?.name ?? 'Подарок')}
                  </strong>
                </div>
                <button
                  type="button"
                  className={styles.queuedCancelBtn}
                  onClick={cancelQueuedNextRoundBet}
                >
                  Отменить
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={cx(styles.mainActionBtn, styles.btnNextRound)}
                onClick={() => setBetSheetOpen(true)}
              >
                <span className={styles.btnGlassHighlight} />
                <span>Поставить на след. раунд</span>
              </button>
            )
          ) : myBet.status === 'active' ? (
            <button
              type="button"
              className={cx(styles.mainActionBtn, styles.btnCashout)}
              onClick={handleCashout}
              aria-label={`Забрать x${fmtMult(multiplier)}`}
            >
              <span className={styles.btnGlassHighlight} />
              <span>
                Забрать x{fmtMult(multiplier)} (
                {formatTonMaxOneDecimal(mulByMultiplier(myBet.valueMinor, multiplier))} TON)
              </span>
            </button>
          ) : (
            <ResultLine myBet={myBet} />
          ))}

        {phase === 'crashed' &&
          (myBet !== null && myBet.status !== 'active' ? (
            <ResultLine myBet={myBet} />
          ) : queuedNextBet ? (
            <div className={styles.queuedBetCard}>
              <div className={styles.queuedBetInfo}>
                <span className={styles.queuedBetBadge}>Ожидает следующий раунд</span>
                <strong className={styles.queuedBetAmount}>
                  {queuedNextBet.kind === 'gram'
                    ? `${formatTonMaxOneDecimal(queuedNextBet.valueMinor)} TON`
                    : (giftById.get(queuedNextBet.giftId ?? '')?.name ?? 'Подарок')}
                </strong>
              </div>
              <button
                type="button"
                className={styles.queuedCancelBtn}
                onClick={cancelQueuedNextRoundBet}
              >
                Отменить
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={cx(styles.mainActionBtn, styles.btnNextRound)}
              onClick={() => setBetSheetOpen(true)}
            >
              <span className={styles.btnGlassHighlight} />
              <span>Поставить на след. раунд</span>
            </button>
          ))}

      </div>

      {/* 6. Список живых ставок игроков (отсортирован от большого к маленькому, Telegram NFT по стоимости) */}
      <div className={styles.liveBetsSection}>
        <div className={styles.liveBetsHeader}>
          <span className={styles.liveBetsTitle}>Ставки раунда</span>
          <span className={styles.liveBetsCount}>
            {sortedBetRows.length} игроков
          </span>
        </div>

        <div
          className={styles.playersList}
          style={
            {
              '--stake-int': Math.max(1, ...sortedBetRows.map((r) => formatCardTon(r.stakeMinor).split('.')[0]!.length)),
              '--payout-int': Math.max(1, ...sortedBetRows.map((r) => formatCardTon(r.profitMinor).split('.')[0]!.length)),
            } as React.CSSProperties
          }
        >
          {sortedBetRows.map((row) => {
            const isWon = row.isCashed
            const isLost = phase === 'crashed' && !row.isCashed
            const isActive = !isWon && !isLost
            const displayGift = isWon ? (row.wonGift ?? row.stakeGift) : row.stakeGift

            return (
              <div
                key={row.id}
                className={cx(
                  styles.playerCard,
                  isWon && styles.playerCardWon,
                  isActive && styles.playerCardActive,
                  isLost && styles.playerCardLost,
                  row.isUser && styles.playerCardUser,
                )}
              >
                <div className={styles.playerLeft}>
                  <div className={styles.playerAvatarBox}>
                    <img
                      src={row.avatar}
                      alt={row.name}
                      className={styles.playerAvatar}
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).src = '/avatars/user_1.png'
                      }}
                    />
                  </div>
                  <div className={styles.playerInfo}>
                    <div className={styles.playerNameRow}>
                      <span className={styles.playerName}>{row.name}</span>
                      {row.isUser && <span className={styles.userBadge}>YOU</span>}
                    </div>
                    <div
                      className={cx(
                        styles.playerBetPill,
                        isWon && styles.playerBetPillWon,
                        isActive && styles.playerBetPillActive,
                        isLost && styles.playerBetPillLost,
                      )}
                    >
                      <TonIcon className={styles.playerBetDiamond} />
                      <span className={styles.playerBetAmount}>
                        <AmountSplit text={formatCardTon(row.stakeMinor)} />
                      </span>
                      {isWon && (
                        <span className={styles.playerBetMult}>
                          ×{fmtMult(row.multToShow)}
                        </span>
                      )}
                      {isLost && (
                        <span className={styles.playerBetLostText}>
                          (Краш)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className={styles.playerRight}>
                  <div
                    className={cx(
                      styles.playerPayoutPill,
                      isWon && styles.payoutWon,
                      isActive && styles.payoutActive,
                      isLost && styles.payoutLost,
                    )}
                  >
                    <TonIcon
                      className={cx(
                        styles.profitTonIcon,
                        isLost && styles.profitTonIconLost,
                      )}
                    />
                    <span className={styles.playerPayoutVal}>
                      <AmountSplit text={isLost ? '0' : formatCardTon(row.profitMinor)} />
                    </span>
                  </div>

                  <div
                    className={cx(
                      styles.playerNftBox,
                      !displayGift && styles.playerNftBoxTon,
                      isWon && styles.playerNftBoxWon,
                      isActive && styles.playerNftBoxActive,
                      isLost && styles.playerNftBoxLost,
                    )}
                    data-rarity={displayGift?.rarity}
                  >
                    {displayGift ? (
                      <img
                        src={displayGift.image}
                        alt=""
                        className={cx(
                          styles.playerNftImg,
                          displayGift.image.endsWith('.png') && styles.playerNftImgFull,
                        )}
                        onError={(e) => {
                          const el = e.currentTarget
                          if (!el.dataset.fallback) {
                            el.dataset.fallback = '1'
                            el.src = el.src.replace('.svg', '.png')
                          }
                        }}
                      />
                    ) : (
                      <TonIcon className={styles.playerNftTonIcon} />
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className={styles.note}>
        Честная игра: множитель растёт плавно, вывод доступен в любой момент до краша.
        Ставки других игроков раунда обновляются в реальном времени.
      </p>

      {/* Шит ставки (Dual Betting: GRAM или Подарок) */}
      <BetSheet open={betSheetOpen} onClose={() => setBetSheetOpen(false)} />

      {/* Мини-админка для @zapixxgarant */}
      {isAdmin && (
        <CrashMiniAdminModal open={adminModalOpen} onClose={() => setAdminModalOpen(false)} />
      )}

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
                  color: '#c7696d',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 700,
                }}
              >
                <TonIcon style={{ width: '15px', height: '15px' }} />
                <span>Стоимость: {formatTonMaxOneDecimal(cosmicReward.priceMinor)} TON</span>
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
      {/* Лёгкий дождик деньгами при выигрыше (без просадки FPS на слабых устройствах) */}
      {showMoneyRain && (
        <MoneyRain onComplete={() => setShowMoneyRain(false)} />
      )}
    </div>
  )
}

function betValueLabel(bet: CrashBet): string {
  if (bet.kind === 'gram') return `${formatTonMaxOneDecimal(bet.valueMinor)} TON`
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
          Выигран NFT {myBet.wonGift.name} ({formatTonMaxOneDecimal(myBet.wonMinor ?? 0)} TON)
        </p>
      )
    }
    return (
      <p className={styles.resultWon}>
        Выигрыш +{formatTonMaxOneDecimal(myBet.wonMinor ?? 0)} TON (x
        {fmtMult(myBet.cashedMultiplier ?? 0)})
      </p>
    )
  }
  return <p className={styles.resultLost}>Ставка сгорела</p>
}
