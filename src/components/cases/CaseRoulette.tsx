import { useEffect, useRef, useState, type TransitionEvent } from 'react'
import { giftById, type CaseDefinition } from '../../data/catalog'
import { buildCaseStrip } from '../../lib/caseStrip'
import { hapticImpact, hapticNotify } from '../../lib/telegram'
import { playRouletteTick, playWinChime } from '../../lib/sound'
import styles from './CaseRoulette.module.css'

const STRIP_LENGTH = 50
const TARGET_INDEX = 40
const TILE_WIDTH = 80
const TILE_MARGIN = 5 // margin left and right = 10px total
const STRIDE = TILE_WIDTH + TILE_MARGIN * 2 // 90px
const DURATION_MS = 7200 // долгий прокрут: быстрый старт и очень медленный «ледяной» хвост (интрига до последнего)
const WINDUP_MS = 300 // «замах»: лента чуть откатывается назад перед рывком

interface CaseRouletteProps {
  caseDefinition: CaseDefinition
  targetGiftId: string | null
  isSpinning: boolean
  onSpinComplete: () => void
}

function generateInitialStrip(caseDefinition: CaseDefinition): string[] {
  return buildCaseStrip(caseDefinition, 20)
}

/**
 * Аналитический расчет cubic-bezier(0.1, 0.55, 0.04, 1) без тяжелых вызовов getBoundingClientRect.
 * Устраняет микрофризы (layout thrashing) и обеспечивает 120 FPS анимацию.
 */
function evaluateCubicBezier(t: number): number {
  const x1 = 0.1
  const y1 = 0.55
  const x2 = 0.04
  const y2 = 1.0

  let u = t
  for (let i = 0; i < 4; i += 1) {
    const xu = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u
    const dxu = 3 * (1 - u) * (1 - u) * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u * u * (1 - x2)
    if (Math.abs(dxu) < 1e-5) break
    u = Math.max(0, Math.min(1, u - (xu - t) / dxu))
  }
  return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u
}

export function CaseRoulette({
  caseDefinition,
  targetGiftId,
  isSpinning,
  onSpinComplete,
}: CaseRouletteProps) {
  // Текущая лента подарков
  const [strip, setStrip] = useState<string[]>(() => generateInitialStrip(caseDefinition))
  const [translateX, setTranslateX] = useState<number>(0)
  const [transitionStyle, setTransitionStyle] = useState<string>('none')
  const [winningIndex, setWinningIndex] = useState<number | null>(null)

  const viewportRef = useRef<HTMLDivElement>(null)
  const lastTileIndexRef = useRef<number>(-1)
  const animationFrameRef = useRef<number | null>(null)
  const isFinishedRef = useRef(false)
  const launchedRef = useRef(false) // основной прокрут начался (замах не считается)
  const launchAtRef = useRef(0) // когда начался основной прокрут (мс, performance.now)

  // Начальное центрирование ленты в покое
  useEffect(() => {
    if (!isSpinning && winningIndex === null) {
      const vpWidth = viewportRef.current?.clientWidth ?? 360
      const initialOffset = vpWidth / 2 - (10 * STRIDE + STRIDE / 2)
      setTranslateX(initialOffset)
      setTransitionStyle('none')
    }
  }, [caseDefinition, isSpinning, winningIndex])

  const finishSpin = () => {
    if (isFinishedRef.current) return
    isFinishedRef.current = true

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    setWinningIndex(TARGET_INDEX)
    playWinChime()
    hapticNotify('success')

    setTimeout(() => {
      onSpinComplete()
    }, 600)
  }

  // Запуск прокрута
  useEffect(() => {
    if (!isSpinning || !targetGiftId) return

    isFinishedRef.current = false
    launchedRef.current = false
    launchAtRef.current = 0
    setWinningIndex(null)

    // Формируем новую ленту с целевым подарком на TARGET_INDEX
    // лента — все подарки кейса вперемешку, без повторов подряд; выигрыш решён заранее
    const newStrip = buildCaseStrip(caseDefinition, STRIP_LENGTH, { index: TARGET_INDEX, giftId: targetGiftId })
    setStrip(newStrip)

    const vpWidth = viewportRef.current?.clientWidth ?? 360
    const startOffset = vpWidth / 2 - (2 * STRIDE + STRIDE / 2)
    setTranslateX(startOffset)
    setTransitionStyle('none')

    // Лента еле-еле доползает и замирает у самого края карточки (байт: кажется, что вот-вот поедет дальше)
    const jitter = Math.floor((Math.random() - 0.5) * 68)
    const targetOffset = vpWidth / 2 - (TARGET_INDEX * STRIDE + STRIDE / 2) + jitter

    let safetyTimer: ReturnType<typeof setTimeout> | null = null

    // Замах: короткий откат ленты назад + вспышка у маркера
    const windupTimer = setTimeout(() => {
      setTransitionStyle(`transform ${WINDUP_MS}ms cubic-bezier(0.3, 0, 0.3, 1)`)
      setTranslateX(startOffset + 38)
      hapticImpact('medium')
    }, 40)

    const launchTimer = setTimeout(() => {
      // Включаем аппаратное ускорение и CSS transition
      launchedRef.current = true
      launchAtRef.current = performance.now()
      setTransitionStyle(`transform ${DURATION_MS}ms cubic-bezier(0.1, 0.55, 0.04, 1)`)
      setTranslateX(targetOffset)

      lastTileIndexRef.current = -1
      const startTime = performance.now()

      const trackTicks = (now: number) => {
        const elapsed = now - startTime
        const rawProgress = Math.min(1, Math.max(0, elapsed / DURATION_MS))

        if (rawProgress < 1 && !isFinishedRef.current) {
          const easedProgress = evaluateCubicBezier(rawProgress)
          const currentX = startOffset + (targetOffset - startOffset) * easedProgress
          const markerOffsetInStrip = vpWidth / 2 - currentX
          const currentTileIdx = Math.floor(markerOffsetInStrip / STRIDE)

          if (
            currentTileIdx !== lastTileIndexRef.current &&
            currentTileIdx >= 0 &&
            currentTileIdx < STRIP_LENGTH
          ) {
            lastTileIndexRef.current = currentTileIdx
            const pitch = 1.0 + (1.0 - rawProgress) * 0.4
            playRouletteTick(pitch)
            hapticImpact('light')
          }

          animationFrameRef.current = requestAnimationFrame(trackTicks)
        }
      }

      animationFrameRef.current = requestAnimationFrame(trackTicks)

      // Гарантированный таймер завершения на случай сбоев transitionend в WebView
      safetyTimer = setTimeout(() => {
        finishSpin()
      }, DURATION_MS + 80)
    }, 40 + WINDUP_MS)

    return () => {
      clearTimeout(windupTimer)
      clearTimeout(launchTimer)
      if (safetyTimer) clearTimeout(safetyTimer)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [isSpinning, targetGiftId, caseDefinition])

  const handleTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    // конец «замаха» и анимации плиток не считаются: завершаем только когда лента сама доехала до выигрыша
    if (e.target !== e.currentTarget || e.propertyName !== 'transform' || !launchedRef.current) return
    // страховка от ложных сигналов: настоящий конец прокрута не раньше, чем через почти всё время анимации
    if (performance.now() - launchAtRef.current < DURATION_MS - 300) return
    if (isSpinning) {
      finishSpin()
    }
  }

  return (
    <div className={styles.rouletteContainer} aria-label="Рулетка кейса">
      <div
        className={`${styles.rouletteViewport} ${isSpinning ? styles.viewportSpinning : ''}`}
        ref={viewportRef}
      >
        {/* Боковые маски затемнения */}
        <div className={styles.fadeMaskLeft} aria-hidden />
        <div className={styles.fadeMaskRight} aria-hidden />

        {/* Центральный маркер с указателями */}
        <div className={styles.markerWrapper} aria-hidden>
          <div className={styles.markerTop} />
          <div className={styles.markerLine} />
          <div className={styles.markerBottom} />
        </div>

        {/* Лента подарков */}
        <div
          className={styles.strip}
          style={{
            transform: `translateX(${translateX}px) translateZ(0)`,
            transition: transitionStyle,
          }}
          onTransitionEnd={handleTransitionEnd}
        >
          {strip.map((giftId, index) => {
            const gift = giftById.get(giftId)
            if (!gift) return null
                        return (
              <div
                key={`${giftId}-${index}`}
                className={styles.tile}
                data-rarity={gift.rarity}
              >
                <img decoding="async" className={styles.tileImage} src={gift.image} alt={gift.name} />
                <span className={styles.tileName}>{gift.name}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
