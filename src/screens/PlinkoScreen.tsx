import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  formatMultiplier,
  plinkoChipColor,
  plinkoMultipliers,
  plinkoMaxMultiplier,
  PLINKO_ROWS,
  type PlinkoRows,
} from '../lib/plinkoMath'
import { formatMinor, toMinor, type Minor } from '../lib/money'
import { makeRequestId } from '../lib/requestId'
import { dropPlinko } from '../services/demoPlinkoService'
import { useWalletStore } from '../store/wallet'
import { GAME_RTP } from '../lib/gameConfig'
import { Input } from '../components/ui'
import { ChevronLeftIcon } from '../components/shell/icons'
import { cx } from '../lib/cx'
import styles from './PlinkoScreen.module.css'

const PRESETS: readonly Minor[] = [100, 500, 1000, 5000] // 0.1 / 0.5 / 1 / 5 GRAM
const STEP_MS = 60 // шаг анимации шара; исход уже определён сервисом
const PEG_GAP = 24 // расстояние между центрами точек (6px точка + 18px gap)
const ROW_PITCH = 14 // вертикальный шаг между рядами (6px точка + 8px gap)

interface Flight {
  result: Extract<ReturnType<typeof dropPlinko>, { status: 'ok' }>
  step: number
}

/**
 * Плинко (4.6). Demo Mode: путь шара — n независимых монеток локального
 * demo-сервиса; множители карманов — только формула m_k = floor2(RTP/(P(k)·(n+1))),
 * EV ряда ≤ RTP (PROGRESS 10.x). Исход определяется ДО анимации; сервер
 * с CSPRNG и Provably Fair — TIER 7 (7.6).
 */
export function PlinkoScreen() {
  const navigate = useNavigate()
  const balance = useWalletStore((s) => s.balances[s.mode])

  const [rows, setRows] = useState<PlinkoRows>(8)
  const [amountInput, setAmountInput] = useState('1')
  const [flight, setFlight] = useState<Flight | null>(null)
  const [error, setError] = useState<string | null>(null)

  const amountMinor: Minor | null = useMemo(() => {
    try {
      const value = toMinor(amountInput)
      return value > 0 ? value : null
    } catch {
      return null
    }
  }, [amountInput])
  const insufficient = amountMinor === null || balance < amountMinor

  const multipliers = useMemo(() => plinkoMultipliers(rows), [rows])
  const maxMultiplier = plinkoMaxMultiplier(16)

  // Цепочка шагов анимации — на setInterval (60мс/монетка): подмена только
  // интервальных таймеров оставляет планировщик React живым (паттерн 4.2).
  const flying = flight !== null && flight.step < flight.result.path.length
  useEffect(() => {
    if (flight === null || flight.step >= flight.result.path.length) return
    const interval = setInterval(() => {
      setFlight((current) =>
        current !== null && current.step < current.result.path.length
          ? { ...current, step: current.step + 1 }
          : current,
      )
    }, STEP_MS)
    return () => clearInterval(interval)
  }, [flight])
  const done = flight !== null && flight.step >= flight.result.path.length

  const drop = () => {
    if (flying || amountMinor === null || insufficient) return
    setError(null)
    const result = dropPlinko(amountMinor, rows, makeRequestId())
    if (result.status !== 'ok') {
      setError('Не удалось принять ставку — попробуйте ещё раз')
      return
    }
    setFlight({ result, step: 0 })
  }

  // Позиция шара на глубине d: слот pos_d = Σ первых d бит пути.
  const ballStyle = useMemo(() => {
    if (flight === null) return null
    const d = flight.step
    const pos = flight.result.path.slice(0, d).reduce<number>((sum, bit) => sum + bit, 0)
    const x = (pos - d / 2) * PEG_GAP
    const y = d * ROW_PITCH + 4
    return { left: `calc(50% + ${x.toFixed(1)}px)`, top: `${y}px` }
  }, [flight])

  return (
    <div className={styles.screen}>
      <div className={styles.topRow}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)}>
          <ChevronLeftIcon className={styles.backIcon} aria-hidden /> Назад
        </button>
        <span className={styles.demoChip}>Demo Mode</span>
      </div>

      <h1 className={styles.title}>Плинко</h1>

      {/* Полотно: точечная пирамида + шар + карманы */}
      <div className={styles.canvas}>
        <div className={styles.pyramid}>
          {Array.from({ length: rows }, (_, row) => (
            <div key={row} className={styles.pegRow}>
              {Array.from({ length: row + 1 }, (_, peg) => (
                <span key={peg} className={styles.peg} />
              ))}
            </div>
          ))}
          {ballStyle !== null && <span className={styles.ball} style={ballStyle} aria-hidden />}
        </div>
        <div className={styles.buckets} aria-label="Множители карманов">
          {multipliers.map((multiplier, k) => (
            <span
              key={k}
              className={cx(styles.bucket, styles[`bucket${capitalize(plinkoChipColor(multiplier))}`])}
            >
              {formatMultiplier(multiplier)}
            </span>
          ))}
        </div>
      </div>

      {/* Панель ставки: пресеты, ввод суммы, число рядов, CTA */}
      <div className={styles.betPanel}>
        <div className={styles.presets} role="group" aria-label="Быстрые суммы">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              className={cx(styles.preset, amountMinor === preset && styles.presetActive)}
              aria-pressed={amountMinor === preset}
              onClick={() => setAmountInput(formatMinor(preset))}
            >
              {formatMinor(preset)}
            </button>
          ))}
        </div>

        <Input
          label="Сумма ставки"
          inputMode="decimal"
          placeholder="Сумма в GRAM"
          suffix="GRAM"
          value={amountInput}
          onChange={(event) => {
            setError(null)
            setAmountInput(event.target.value)
          }}
          hint={`Баланс: ${formatMinor(balance)} GRAM`}
        />

        <div className={styles.rowsSegmented} role="group" aria-label="Число рядов">
          <span className={styles.rowsLabel}>Ряды</span>
          {PLINKO_ROWS.map((option) => (
            <button
              key={option}
              type="button"
              className={cx(styles.rowChip, rows === option && styles.rowChipActive)}
              aria-pressed={rows === option}
              onClick={() => setRows(option)}
            >
              {option}
            </button>
          ))}
        </div>

        {error && (
          <p className={styles.betError} role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          className={styles.placeBet}
          disabled={amountMinor === null || insufficient || flying}
          onClick={drop}
        >
          {flying
            ? 'Шар летит…'
            : amountMinor !== null
              ? `Бросить шар · ${formatMinor(amountMinor)} GRAM`
              : 'Бросить шар'}
        </button>

        {done && flight.result.winMinor > flight.result.betMinor && (
          <p className={styles.resultWon}>
            Выигрыш +{formatMinor(flight.result.winMinor - flight.result.betMinor)} GRAM (
            {formatMultiplier(flight.result.multiplier)})
          </p>
        )}
        {done &&
          flight.result.winMinor <= flight.result.betMinor && (
            <p className={styles.resultLost}>
              Карман {formatMultiplier(flight.result.multiplier)}: −
              {formatMinor(flight.result.betMinor - flight.result.winMinor)} GRAM
            </p>
          )}
      </div>

      <p className={styles.note}>
        Demo Mode: путь шара — {rows} монеток локально (RTP {GAME_RTP}, нормировка на{' '}
        {rows + 1} карманов), выплата — floor(ставка × множитель). Максимальный карман
        при 16 рядах — {formatMultiplier(maxMultiplier)}. Серверный бросок и
        Provably Fair — TIER 7 (7.6).
      </p>
    </div>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
