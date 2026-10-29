import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatMinor, toMinor, type Minor } from '../lib/money'
import { makeRequestId } from '../lib/requestId'
import { flipTvt } from '../services/demoTvtService'
import { useWalletStore } from '../store/wallet'
import { usePvpRoundsStore } from '../store/pvpRounds'
import { Input } from '../components/ui'
import { ChevronLeftIcon, IceIcon, FlameIcon, TonIcon } from '../components/shell/icons'
import { cx } from '../lib/cx'
import type { TvtSide } from '../lib/pvpMath'
import styles from './TvtScreen.module.css'

const PRESETS: readonly Minor[] = [100, 500, 1000, 5000] // 0.1 / 0.5 / 1 / 5 TON

const SIDE_META = {
  ice: { name: 'Лёд' },
  fire: { name: 'Огонь' },
} as const

/** Отображение результата броска (ok-часть ответа сервиса). */
interface TvtOutcome {
  flip: TvtSide
  won: boolean
  payoutMinor: Minor
  betMinor: Minor
}

/**
 * TVT: Ice vs Fire (5.3). Монета 50/50, выплата ×1.96, EV = 0.98 ставки.
 * Соперник — казна-контрагент (Demo): вторую сторону всегда держит казино,
 * никаких фиктивных игроков; реальные противники — TIER 7 (7.6/7.8).
 * Пока открыт раунд Джекпота — блок (5.4, синхронизация раундов).
 */
export function TvtScreen() {
  const navigate = useNavigate()
  const balance = useWalletStore((s) => s.balances[s.mode])
  const jackpotOpen = usePvpRoundsStore(
    (s) => s.jackpot !== null && !s.jackpot.finished,
  )
  const lastRound = usePvpRoundsStore((s) => s.tvt)

  const [side, setSide] = useState<TvtSide>('ice')
  const [amountInput, setAmountInput] = useState('1')
  const [outcome, setOutcome] = useState<TvtOutcome | null>(null)
  const [error, setError] = useState<string | null>(null)

  const amountMinor: Minor | null = (() => {
    try {
      const value = toMinor(amountInput)
      return value > 0 ? value : null
    } catch {
      return null
    }
  })()
  const insufficient = amountMinor === null || balance < amountMinor

  const flip = () => {
    if (amountMinor === null || insufficient) return
    setError(null)
    const result = flipTvt(side, amountMinor, makeRequestId())
    if (result.status !== 'ok') {
      setError(
        result.reason === 'round_in_progress'
          ? 'Открыт раунд Solo Jackpot — проведите тираж'
          : result.reason === 'insufficient_funds'
            ? 'Недостаточно средств на балансе'
            : 'Не удалось принять ставку — попробуйте ещё раз',
      )
      return
    }
    setOutcome({
      flip: result.flip,
      won: result.won,
      payoutMinor: result.payoutMinor,
      betMinor: result.betMinor,
    })
  }

  // Последний результат отображается, пока не сделан новый бросок
  // (восстановление при возврате на экран — 5.4).
  const shown: TvtOutcome | null =
    outcome ??
    (lastRound?.result
      ? {
          flip: lastRound.result.flip,
          won: lastRound.result.won,
          payoutMinor: lastRound.result.payoutMinor,
          betMinor: lastRound.betMinor,
        }
      : null)

  return (
    <div className={styles.screen}>
      <div className={styles.topRow}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)}>
          <ChevronLeftIcon className={styles.backIcon} aria-hidden /> Назад
        </button>
      </div>

      <h1 className={styles.title}>TVT: Лёд vs Огонь</h1>

      {/* Полотно: стороны + монета */}
      <div className={styles.canvas}>
        <div className={styles.sides} role="group" aria-label="Выбор стороны">
          <button
            type="button"
            className={cx(styles.side, styles.sideIce, side === 'ice' && styles.sideActive)}
            aria-pressed={side === 'ice'}
            onClick={() => setSide('ice')}
          >
            <span className={styles.sideEmoji} aria-hidden style={{ display: 'inline-flex', alignItems: 'center' }}>
              <IceIcon style={{ width: '20px', height: '20px', color: '#00c0ff' }} />
            </span>
            Лёд
          </button>
          <span className={styles.vs} aria-hidden>
            VS
          </span>
          <button
            type="button"
            className={cx(styles.side, styles.sideFire, side === 'fire' && styles.sideActive)}
            aria-pressed={side === 'fire'}
            onClick={() => setSide('fire')}
          >
            <span className={styles.sideEmoji} aria-hidden style={{ display: 'inline-flex', alignItems: 'center' }}>
              <FlameIcon style={{ width: '20px', height: '20px', color: '#ff6b35' }} />
            </span>
            Огонь
          </button>
        </div>

        <div className={styles.coinDisplay}>
          <span className={cx(styles.coin, shown && (shown.won ? styles.coinWon : styles.coinLost))} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            {shown ? (
              shown.flip === 'ice' ? (
                <IceIcon style={{ width: '28px', height: '28px', color: '#00c0ff' }} />
              ) : (
                <FlameIcon style={{ width: '28px', height: '28px', color: '#ff6b35' }} />
              )
            ) : (
              <TonIcon style={{ width: '28px', height: '28px', color: '#0098ea' }} />
            )}
          </span>
          <span className={styles.coinHint}>
            {shown
              ? `Выпал: ${SIDE_META[shown.flip].name} — ${shown.won ? 'выигрыш' : 'мимо'}`
              : 'Бросок: монета 50/50'}
          </span>
        </div>

        {shown && (
          <p className={shown.won ? styles.resultWon : styles.resultLost} data-testid="tvt-result">
            {shown.won
              ? `Выигрыш +${formatMinor(shown.payoutMinor - shown.betMinor)} TON (×1.96)`
              : `Мимо: −${formatMinor(shown.betMinor)} TON`}
          </p>
        )}
      </div>

      {/* Панель ставки */}
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
          hint={`Баланс: ${formatMinor(balance)} TON · выплата floor(ставка × 1.96)`}
        />

        {error && (
          <p className={styles.betError} role="alert">
            {error}
          </p>
        )}

        {jackpotOpen ? (
          <div className={styles.blocked}>
            <p>
              Открыт раунд Solo Jackpot — бросок заблокирован (5.4: один активный раунд).
            </p>
            <Link to="/pvp/jackpot" className={styles.blockedLink}>
              Вернуться в Джекпот →
            </Link>
          </div>
        ) : (
          <button
            type="button"
            className={styles.placeBet}
            disabled={amountMinor === null || insufficient}
            onClick={flip}
          >
            {amountMinor !== null
              ? `Бросить монету · ${formatMinor(amountMinor)} TON`
              : 'Бросить монету'}
          </button>
        )}
      </div>

      <p className={styles.note}>
        TVT: выберите сторону (Лёд или Огонь). Монета 50/50,
        выплата = ставка × 1.96 при победе вашей стороны.
      </p>
    </div>
  )
}
