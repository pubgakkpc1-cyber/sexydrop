import { useEffect, useMemo, useRef, useState } from 'react'
import { giftById, type CaseDefinition } from '../../data/catalog'
import { pickWeighted } from '../../lib/caseMath'
import { hapticNotify } from '../../lib/telegram'
import { Button, GramAmount } from '../ui'
import styles from './CaseOpeningOverlay.module.css'

const STRIP_LENGTH = 40
const TARGET_INDEX = 34
const TILE_WIDTH = 72
const TILES_VISIBLE = 5

interface OpeningResult {
  giftId: string
}

interface CaseOpeningOverlayProps {
  caseDefinition: CaseDefinition
  result: OpeningResult
  onClose: () => void
}

function buildStrip(caseDefinition: CaseDefinition, resultGiftId: string): string[] {
  const strip: string[] = []
  for (let i = 0; i < STRIP_LENGTH; i += 1) {
    strip.push(i === TARGET_INDEX ? resultGiftId : pickWeighted(caseDefinition.entries).itemId)
  }
  return strip
}

/**
 * Оверлей открытия кейса (2.6). Горизонтальная рулетка — ТОЛЬКО визуализация
 * заранее полученного результата (в Demo Mode результат приходит из
 * demoCaseService, в production — с сервера). Анимация не влияет на исход.
 * При prefers-reduced-motion рулетка пропускается.
 */
export function CaseOpeningOverlay({ caseDefinition, result, onClose }: CaseOpeningOverlayProps) {
  const strip = useMemo(() => buildStrip(caseDefinition, result.giftId), [caseDefinition, result.giftId])
  const [phase, setPhase] = useState<'spin' | 'done'>('spin')
  const [target, setTarget] = useState<number | null>(null)
  const stripRef = useRef<HTMLDivElement>(null)

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (prefersReducedMotion) {
      setPhase('done')
      return
    }
    const raf = requestAnimationFrame(() => {
      const viewport = stripRef.current?.clientWidth ?? TILE_WIDTH * TILES_VISIBLE
      // центрируем целевую плитку под маркером
      setTarget(viewport / 2 - (TARGET_INDEX * TILE_WIDTH + TILE_WIDTH / 2))
    })
    return () => cancelAnimationFrame(raf)
  }, [prefersReducedMotion])

  const resultGift = giftById.get(result.giftId)
  if (!resultGift) return null

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Открытие кейса">
      <span className={styles.demoChip}>Demo Mode — результат сгенерирован локально</span>
      <div className={styles.caseImageWrap}>
        <img className={styles.caseImage} src={caseDefinition.image} alt="" />
      </div>

      <div className={styles.roulette}>
        <div className={styles.marker} aria-hidden />
        <div className={styles.viewport} ref={stripRef}>
          <div
            className={styles.strip}
            style={{
              transform: `translateX(${target ?? 0}px)`,
              transition:
                target !== null && !prefersReducedMotion
                  ? 'transform 4200ms cubic-bezier(0.08, 0.82, 0.12, 1)'
                  : 'none',
            }}
            onTransitionEnd={() => setPhase('done')}
          >
            {strip.map((giftId, index) => {
              const gift = giftById.get(giftId)
              if (!gift) return null
              return (
                <img
                  key={index}
                  className={styles.tile}
                  src={gift.image}
                  alt=""
                  data-target={index === TARGET_INDEX || undefined}
                />
              )
            })}
          </div>
        </div>
      </div>

      {phase === 'done' && (
        <ResultView gift={resultGift} onClose={onClose} />
      )}
    </div>
  )
}

function ResultView({
  gift,
  onClose,
}: {
  gift: NonNullable<ReturnType<typeof giftById.get>>
  onClose: () => void
}) {
  useEffect(() => {
    hapticNotify('success')
  }, [])
  return (
    <div className={styles.result}>
      <img className={styles.resultImage} src={gift.image} alt="" />
      <strong className={styles.resultName}>{gift.name}</strong>
      <GramAmount minor={gift.priceMinor} size="md" className={styles.resultPrice} />
      <p className={styles.resultNote}>Подарок зачислен в инвентарь</p>
      <Button fullWidth onClick={onClose}>
        Отлично
      </Button>
    </div>
  )
}
