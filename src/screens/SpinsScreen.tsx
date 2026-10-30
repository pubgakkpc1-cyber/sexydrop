import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  SPINS_BONUS_WEIGHT,
  SPINS_BONUS_WEIGHT_DOUBLE,
  SPINS_CELLS,
  SPINS_GIFTS,
  bonusBuyPriceMinor,
  pickSpinsIndex,
  spinsMultiplier,
} from '../lib/spinsMath'
import { formatMinor, toMinor, type Minor } from '../lib/money'
import { makeRequestId } from '../lib/requestId'
import { buyBonus, spinSpins, type SpinsSpinOk } from '../services/demoSpinsService'
import { useWalletStore } from '../store/wallet'
import { Input } from '../components/ui'
import { ChevronLeftIcon, SparkleIcon } from '../components/shell/icons'
import { cx } from '../lib/cx'
import styles from './SpinsScreen.module.css'

const PRESETS: readonly Minor[] = [100, 500, 1000, 5000] // 0.1 / 0.5 / 1 / 5 GRAM
const AUTO_TARGETS: readonly number[] = [10, 25, 50, 100]
const AUTO_INTERVAL_MS = 650
/** Ячейка победителя — косметика; исход решает взвешенный выбор символа. */
const BONUS_INDEX = SPINS_GIFTS.length

interface ResultView {
  kind: 'gift' | 'bonus' | 'bonus-buy'
  line: string
  netMinor: Minor
  won: boolean
}

/**
 * Спины (4.9). Колесо 10 символов (9 подарков + бонус); исход — взвешенный
 * выбор в demo-сервисе, сетка 5×5 — витрина, ячейка победителя подсвечивается.
 * Множители — только формулы spinsMath; бонус-символ даёт бесплатный спин M2.
 */
export function SpinsScreen() {
  const navigate = useNavigate()
  const balance = useWalletStore((s) => s.balances[s.mode])

  const [doubleChance, setDoubleChance] = useState(false)
  const [amountInput, setAmountInput] = useState('1')
  const [cells, setCells] = useState<(number | null)[]>(Array(SPINS_CELLS).fill(null))
  const [winnerIndex, setWinnerIndex] = useState<number | null>(null)
  const [result, setResult] = useState<ResultView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [autoTarget, setAutoTarget] = useState<number | null>(null)

  const autoRef = useRef<{ done: number; timer: number } | null>(null)
  const autoBetRef = useRef<Minor | null>(null)
  const autoDoubleRef = useRef(false)

  const amountMinor: Minor | null = useMemo(() => {
    try {
      const value = toMinor(amountInput)
      return value > 0 ? value : null
    } catch {
      return null
    }
  }, [amountInput])
  const insufficient = amountMinor === null || balance < amountMinor
  const buyPriceMinor = amountMinor !== null ? bonusBuyPriceMinor(amountMinor) : 0

  const stopAuto = useCallback(() => {
    if (autoRef.current !== null) {
      window.clearInterval(autoRef.current.timer)
      autoRef.current = null
    }
    autoBetRef.current = null
    setAutoTarget(null)
  }, [])

  useEffect(() => stopAuto, [stopAuto])

  const showResult = (serviceResult: SpinsSpinOk, betMinor: Minor) => {
    setCells((current) => {
      const next = current.map(() => pickSpinsIndex(doubleChance, Math.random))
      next[serviceResult.winnerIndex] =
        serviceResult.kind === 'gift' ? serviceResult.symbolIndex : BONUS_INDEX
      return next
    })
    setWinnerIndex(serviceResult.winnerIndex)
    if (serviceResult.kind === 'gift') {
      const symbol = SPINS_GIFTS[serviceResult.symbolIndex]
      const mult = serviceResult.multiplierHundredths / 100
      const net = serviceResult.payoutMinor - betMinor
      setResult({
        kind: 'gift',
        line: `${symbol?.name ?? 'Символ'} · x${mult.toFixed(2)} · ${
          net >= 0 ? `+${formatMinor(serviceResult.payoutMinor)} TON` : `−${formatMinor(betMinor)} TON`
        }`,
        netMinor: net,
        won: net >= 0,
      })
    } else {
      const symbol = SPINS_GIFTS[serviceResult.bonusSymbolIndex]
      const mult = serviceResult.bonusMultiplierHundredths / 100
      const net = serviceResult.bonusPayoutMinor - betMinor
      setResult({
        kind: 'bonus',
        line: `Бонус! Спин ×${(serviceResult.freeStakeMinor / betMinor).toFixed(2)} → ${symbol?.name ?? ''} x${mult.toFixed(2)} · +${formatMinor(serviceResult.bonusPayoutMinor)} TON`,
        netMinor: net,
        won: net >= 0,
      })
    }
  }

  const spinOnce = useCallback(
    (betMinor: Minor, double: boolean): boolean => {
      const serviceResult = spinSpins(betMinor, double, makeRequestId())
      if (serviceResult.status === 'rejected') {
        if (autoRef.current === null) {
          setError(
            serviceResult.reason === 'insufficient_funds'
              ? 'Недостаточно средств на балансе'
              : 'Не удалось принять ставку — попробуйте ещё раз',
          )
        }
        return false
      }
      showResult(serviceResult, betMinor)
      return true
    },
    // doubleChance в замыкании — для ручного спина; автоспин берёт из ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doubleChance],
  )

  const startAuto = (target: number) => {
    if (amountMinor === null || insufficient || autoTarget !== null) return
    setError(null)
    autoBetRef.current = amountMinor
    autoDoubleRef.current = doubleChance
    setAutoTarget(target)
    let done = 0
    const step = () => {
      const bet = autoBetRef.current
      if (bet === null) {
        stopAuto()
        return
      }
      const ok = spinOnce(bet, autoDoubleRef.current)
      if (!ok) {
        stopAuto()
        return
      }
      done += 1
      if (done >= target) stopAuto()
    }
    step() // первый спин сразу
    if (done < target) {
      const timer = window.setInterval(step, AUTO_INTERVAL_MS)
      autoRef.current = { done, timer }
    }
  }

  const spinManual = () => {
    if (amountMinor === null || insufficient || autoTarget !== null) return
    setError(null)
    spinOnce(amountMinor, doubleChance)
  }

  const buyBonusOnce = () => {
    if (amountMinor === null || insufficient || autoTarget !== null) return
    setError(null)
    const serviceResult = buyBonus(amountMinor, makeRequestId())
    if (serviceResult.status !== 'ok') {
      setError(
        serviceResult.reason === 'insufficient_funds'
          ? 'Недостаточно средств на цене бонуса'
          : 'Не удалось принять запрос — попробуйте ещё раз',
      )
      return
    }
    const symbol = SPINS_GIFTS[serviceResult.bonusSymbolIndex]
    const mult = serviceResult.bonusMultiplierHundredths / 100
    const net = serviceResult.payoutMinor - serviceResult.priceMinor
    setResult({
      kind: 'bonus-buy',
      line: `Бонус куплен · ${symbol?.name ?? ''} x${mult.toFixed(2)} · +${formatMinor(
        serviceResult.payoutMinor,
      )} TON`,
      netMinor: net,
      won: net >= 0,
    })
  }

  const cellContent = (index: number) => {
    const symbolIndex = cells[index]
    if (symbolIndex === null || symbolIndex === undefined) return null
    if (symbolIndex === BONUS_INDEX) {
      return (
        <span className={styles.cellBonus} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SparkleIcon style={{ width: '24px', height: '24px', color: '#ba454b' }} />
        </span>
      )
    }
    const symbol = SPINS_GIFTS[symbolIndex]
    if (!symbol) return null
    return (
      <img
        className={styles.cellImage}
        src={`/gifts/${symbol.giftId}.svg`}
        alt={symbol.name}
        loading="lazy"
      />
    )
  }

  return (
    <div className={styles.screen}>
      <div className={styles.topRow}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)}>
          <ChevronLeftIcon className={styles.backIcon} aria-hidden /> Назад
        </button>
      </div>

      <h1 className={styles.title}>Спины</h1>

      <div className={styles.canvas}>
        <div className={styles.grid} role="group" aria-label={`Сетка ${SPINS_CELLS} ячеек`}>
          {cells.map((_, index) => (
            <div
              key={index}
              className={cx(styles.cell, winnerIndex === index && styles.cellWinner)}
              aria-label={`Ячейка ${index + 1}`}
            >
              {cellContent(index)}
            </div>
          ))}
        </div>

        <div className={styles.symbols} role="list" aria-label="Символы колеса">
          {SPINS_GIFTS.map((symbol, index) => (
            <span key={symbol.giftId} className={styles.symbolChip} role="listitem">
              <img
                className={styles.symbolImage}
                src={`/gifts/${symbol.giftId}.svg`}
                alt=""
                loading="lazy"
              />
              <span className={styles.symbolName}>{symbol.name}</span>
              <span className={styles.symbolOdds}>
                x{(spinsMultiplier(index, doubleChance) || 0).toFixed(2)}
              </span>
            </span>
          ))}
          <span className={styles.symbolChip} role="listitem">
            <span className={styles.symbolBonus} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <SparkleIcon style={{ width: '16px', height: '16px', color: '#ba454b' }} />
            </span>
            <span className={styles.symbolName}>Бонус</span>
            <span className={styles.symbolOdds}>
              {(
                (100 * (doubleChance ? SPINS_BONUS_WEIGHT_DOUBLE : SPINS_BONUS_WEIGHT)) /
                (doubleChance ? 88 : 80)
              ).toFixed(1)}
              %
            </span>
          </span>
          <button
            type="button"
            className={cx(styles.doubleChip, doubleChance && styles.doubleChipActive)}
            aria-pressed={doubleChance}
            onClick={() => setDoubleChance((value) => !value)}
          >
            Шанс бонуса ×2
          </button>
        </div>
      </div>

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
          placeholder="Сумма в TON"
          suffix="TON"
          value={amountInput}
          onChange={(event) => {
            setError(null)
            setAmountInput(event.target.value)
          }}
          hint={`Баланс: ${formatMinor(balance)} TON`}
        />

        {error && (
          <p className={styles.betError} role="alert">
            {error}
          </p>
        )}

        <div className={styles.controls}>
          <button
            type="button"
            className={styles.placeBet}
            disabled={amountMinor === null || insufficient || autoTarget !== null}
            onClick={spinManual}
          >
            {amountMinor !== null ? `Крутить · ${formatMinor(amountMinor)} TON` : 'Крутить'}
          </button>
          <button
            type="button"
            className={styles.buyBonus}
            disabled={
              amountMinor === null ||
              insufficient ||
              autoTarget !== null ||
              buyPriceMinor === 0 ||
              balance < buyPriceMinor
            }
            onClick={buyBonusOnce}
          >
            Купить бонус · {buyPriceMinor > 0 ? formatMinor(buyPriceMinor) : '—'} TON
          </button>
        </div>

        <div className={styles.autoRow}>
          <span className={styles.autoLabel}>Автоспин:</span>
          {AUTO_TARGETS.map((target) => (
            <button
              key={target}
              type="button"
              className={cx(styles.autoChip, autoTarget === target && styles.autoChipActive)}
              disabled={autoTarget !== null && autoTarget !== target}
              onClick={() => startAuto(target)}
            >
              {target}
            </button>
          ))}
          {autoTarget !== null && (
            <button
              type="button"
              className={cx(styles.autoChip, styles.autoStop)}
              onClick={stopAuto}
            >
              Стоп
            </button>
          )}
        </div>

        {result && (
          <p className={result.won ? styles.resultWon : styles.resultLost}>{result.line}</p>
        )}
      </div>

      <p className={styles.note}>
        Спины: вращайте барабан для получения редких подарков и бонусов.
        Множители рассчитываются по таблице выплат.
      </p>
    </div>
  )
}
