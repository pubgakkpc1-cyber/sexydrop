import { useEffect, useRef, useState } from 'react'
import { giftById, type CaseDefinition } from '../../data/catalog'
import { pickWeighted } from '../../lib/caseMath'
import { hapticImpact, hapticNotify } from '../../lib/telegram'
import { playRouletteTick, playWinChime } from '../../lib/sound'
import styles from './CaseRoulette.module.css'

const STRIP_LENGTH = 50
const TARGET_INDEX = 40
const TILE_WIDTH = 80
const TILE_MARGIN = 5 // margin left and right = 10px total
const STRIDE = TILE_WIDTH + TILE_MARGIN * 2 // 90px
const DURATION_MS = 4200
const WINDUP_MS = 300 // «замах»: лента чуть откатывается назад перед рывком

interface CaseRouletteProps {
  caseDefinition: CaseDefinition
  targetGiftId: string | null
  isSpinning: boolean
  onSpinComplete: () => void
}

function generateInitialStrip(caseDefinition: CaseDefinition): string[] {
  const list: string[] = []
  for (let i = 0; i < 20; i += 1) {
    list.push(pickWeighted(caseDefinition.entries).itemId)
  }
  return list
}

/**
 * Аналитический расчет cubic-bezier(0.08, 0.82, 0.12, 1) без тяжелых вызовов getBoundingClientRect.
 * Устраняет микрофризы (layout thrashing) и обеспечивает 120 FPS анимацию.
 */
function evaluateCubicBezier(t: number): number {
  const x1 = 0.08
  const y1 = 0.82
  const x2 = 0.12
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
  const [burstKey, setBurstKey] = useState(0)

  const viewportRef = useRef<HTMLDivElement>(null)
  const lastTileIndexRef = useRef<number>(-1)
  const animationFrameRef = useRef<number | null>(null)
  const isFinishedRef = useRef(false)

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
    setWinningIndex(null)

    // Формируем новую ленту с целевым подарком на TARGET_INDEX
    const newStrip: string[] = []
    for (let i = 0; i < STRIP_LENGTH; i += 1) {
      if (i === TARGET_INDEX) {
        newStrip.push(targetGiftId)
      } else {
        newStrip.push(pickWeighted(caseDefinition.entries).itemId)
      }
    }
    setStrip(newStrip)

    const vpWidth = viewportRef.current?.clientWidth ?? 360
    const startOffset = vpWidth / 2 - (2 * STRIDE + STRIDE / 2)
    setTranslateX(startOffset)
    setTransitionStyle('none')

    // Естественный разброс остановки внутри карточки (±14px от центра)
    const jitter = Math.floor((Math.random() - 0.5) * 28)
    const targetOffset = vpWidth / 2 - (TARGET_INDEX * STRIDE + STRIDE / 2) + jitter

    let safetyTimer: ReturnType<typeof setTimeout> | null = null

    // Замах: короткий откат ленты назад + вспышка у маркера
    const windupTimer = setTimeout(() => {
      setBurstKey((k) => k + 1)
      setTransitionStyle(`transform ${WINDUP_MS}ms cubic-bezier(0.3, 0, 0.3, 1)`)
      setTranslateX(startOffset + 38)
      hapticImpact('medium')
    }, 40)

    const launchTimer = setTimeout(() => {
      // Включаем аппаратное ускорение и CSS transition
      setTransitionStyle(`transform ${DURATION_MS}ms cubic-bezier(0.08, 0.82, 0.12, 1)`)
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

  const handleTransitionEnd = () => {
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
        {burstKey > 0 && <div key={burstKey} className={styles.launchBurst} aria-hidden />}
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
            const isWinner = winningIndex === index
            return (
              <div
                key={`${giftId}-${index}`}
                className={`${styles.tile} ${isWinner ? styles.tileWinning : ''}`}
                data-rarity={gift.rarity}
              >
                <img className={styles.tileImage} src={gift.image} alt={gift.name} />
                <span className={styles.tileName}>{gift.name}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
