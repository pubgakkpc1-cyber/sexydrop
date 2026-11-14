import { useEffect, useMemo, useRef, useState } from 'react'
import { giftById, isTonPrize, type CaseDefinition } from '../../data/catalog'
import { buildCaseStrip } from '../../lib/caseStrip'
import { formatMinor } from '../../lib/money'
import { makeRequestId } from '../../lib/requestId'
import { hapticImpact, hapticNotify } from '../../lib/telegram'
import { playRouletteTick, playWinChime } from '../../lib/sound'
import { sellItemApi } from '../../services/gameApi'
import { caseSpinMs, useSpinSpeedStore } from '../../store/spinSpeed'
import styles from './CaseMultiOpen.module.css'

export interface MultiResult {
  giftId: string
  uid: string
}

const STRIP = 22
const TARGET = 17
const TILE = 84 // высота плитки, px

/**
 * Открытие нескольких кейсов за раз: каждый кейс — своя вертикальная лента; ленты разгоняются вместе
 * и останавливаются по очереди. Потом — итог: что выпало, на сколько TON, «Забрать» или «Продать всё».
 */
export function CaseMultiOpen({
  gameCase,
  results,
  onAnimationDone,
  onClose,
}: {
  gameCase: CaseDefinition
  results: MultiResult[]
  onAnimationDone: () => void
  onClose: () => void
}) {
  const turbo = useSpinSpeedStore((s) => s.turbo)
  const base = caseSpinMs(turbo) * 0.55
  const stagger = turbo ? 120 : 260
  const [phase, setPhase] = useState<'spin' | 'done'>('spin')
  const [go, setGo] = useState(false)
  const [selling, setSelling] = useState(false)
  const [sold, setSold] = useState<number | null>(null)
  const doneRef = useRef(false)

  const strips = useMemo(
    () => results.map((r) => buildCaseStrip(gameCase, STRIP, { index: TARGET, giftId: r.giftId })),
    [gameCase, results],
  )

  useEffect(() => {
    const start = window.setTimeout(() => setGo(true), 60)
    const total = base + stagger * results.length + 450
    // «тики» по мере остановки лент
    const ticks: number[] = []
    for (let i = 0; i < results.length; i += 1) {
      ticks.push(
        window.setTimeout(() => {
          playRouletteTick(1.1)
          hapticImpact('light')
        }, base + stagger * i),
      )
    }
    const finish = window.setTimeout(() => {
      if (doneRef.current) return
      doneRef.current = true
      playWinChime()
      hapticNotify('success')
      setPhase('done')
      onAnimationDone()
    }, total)
    return () => {
      window.clearTimeout(start)
      window.clearTimeout(finish)
      ticks.forEach((t) => window.clearTimeout(t))
    }
    // анимация запускается один раз на набор результатов
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results])

  useEffect(() => {
    // закрыли окно раньше конца — всё равно отпускаем удержанные обновления баланса
    return () => {
      if (!doneRef.current) {
        doneRef.current = true
        onAnimationDone()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const gifts = results.map((r) => ({ ...r, gift: giftById.get(r.giftId) })).filter((r) => r.gift)
  const total = gifts.reduce((a, r) => a + (r.gift?.priceMinor ?? 0), 0)
  const nft = gifts.filter((r) => r.gift && !isTonPrize(r.gift) && r.uid)
  const nftTotal = nft.reduce((a, r) => a + (r.gift?.priceMinor ?? 0), 0)
  const cols = results.length <= 5 ? results.length : 5

  const sellAll = async () => {
    if (selling) return
    setSelling(true)
    let credited = 0
    for (const r of nft) {
      try {
        const res = await sellItemApi(r.uid, makeRequestId())
        if (res.status === 'ok') credited += res.creditedMinor
      } catch {
        /* пропускаем неудавшиеся — подарок останется в инвентаре */
      }
    }
    setSold(credited)
    setSelling(false)
    hapticNotify('success')
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Открытие кейсов">
      <div className={styles.modal}>
        <h2 className={styles.title}>{phase === 'spin' ? `Открываем ×${results.length}` : 'Выпало'}</h2>

        {phase === 'spin' && (
          <div className={styles.reels} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, ${TILE + 16}px))` }}>
            {strips.map((strip, i) => (
              <div key={i} className={styles.reel} style={{ height: TILE }}>
                <div className={styles.reelMark} aria-hidden />
                <div
                  className={styles.reelStrip}
                  style={{
                    transform: go ? `translateY(${-TARGET * TILE}px)` : 'translateY(0)',
                    transition: go ? `transform ${base + stagger * i}ms cubic-bezier(0.1, 0.7, 0.12, 1)` : 'none',
                  }}
                >
                  {strip.map((id, k) => {
                    const g = giftById.get(id)
                    return g ? <img key={k} src={g.image} alt="" className={styles.tile} style={{ height: TILE }} decoding="async" /> : null
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {phase === 'done' && (
          <>
            <ul className={styles.results} style={{ gridTemplateColumns: `repeat(${Math.min(5, Math.max(3, cols))}, minmax(0, 1fr))` }}>
              {gifts.map((r, i) => (
                <li key={i} className={styles.result} style={{ animationDelay: `${i * 60}ms` }}>
                  <img src={r.gift!.image} alt={r.gift!.name} className={styles.resultImg} decoding="async" />
                  <span className={styles.resultName}>{r.gift!.name}</span>
                  <span className={styles.resultPrice}>{formatMinor(r.gift!.priceMinor)}</span>
                </li>
              ))}
            </ul>
            <p className={styles.sum}>
              Всего выпало на <b>{formatMinor(total)} TON</b>
            </p>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={onClose}>
                Забрать
              </button>
              {nft.length > 0 && sold === null && (
                <button type="button" className={styles.secondary} disabled={selling} onClick={() => void sellAll()}>
                  {selling ? 'Продаём…' : `Продать все подарки за ${formatMinor(nftTotal)} TON`}
                </button>
              )}
              {sold !== null && <p className={styles.soldNote}>Продано: +{formatMinor(sold)} TON на баланс</p>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
