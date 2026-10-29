import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { jackpotEvMinor } from '../lib/pvpMath'
import { formatMinor, toMinor, type Minor } from '../lib/money'
import { makeRequestId } from '../lib/requestId'
import {
  addJackpotStake,
  drawJackpot,
  startJackpotRound,
} from '../services/demoJackpotService'
import { useWalletStore } from '../store/wallet'
import { usePvpRoundsStore } from '../store/pvpRounds'
import { Input } from '../components/ui'
import { ChevronLeftIcon } from '../components/shell/icons'
import { cx } from '../lib/cx'
import styles from './JackpotScreen.module.css'

const PRESETS: readonly Minor[] = [100, 500, 1000, 5000] // 0.1 / 0.5 / 1 / 5 GRAM

/**
 * Solo Jackpot (5.2). Банк открывается первым вкладом; казино добивает
 * h = 9·вклада; до тиража можно докидывать — шанс = доля ставки в банке:
 * p = floor(9800·s/(s+h))/10000, выплата — весь банк, EV = −2% внесённого
 * (публикуется). Состояние раунда живёт в store/pvpRounds («сервер»), экран
 * его отображает — возврат восстанавливает раунд (5.4). Production — TIER 7.
 */
export function JackpotScreen() {
  const navigate = useNavigate()
  const balance = useWalletStore((s) => s.balances[s.mode])
  const round = usePvpRoundsStore((s) => s.jackpot)

  const [amountInput, setAmountInput] = useState('1')
  const [error, setError] = useState<string | null>(null)

  const open = round !== null && !round.finished
  const finished = round !== null && round.finished

  const amountMinor: Minor | null = (() => {
    try {
      const value = toMinor(amountInput)
      return value > 0 ? value : null
    } catch {
      return null
    }
  })()
  const insufficient = amountMinor === null || balance < amountMinor

  const stake = () => {
    if (amountMinor === null || insufficient) return
    setError(null)
    const result = startJackpotRound(amountMinor, makeRequestId())
    if (result.status !== 'ok') {
      setError(
        result.reason === 'round_in_progress'
          ? 'Раунд уже открыт — докиньте или проведите тираж'
          : result.reason === 'insufficient_funds'
            ? 'Недостаточно средств на балансе'
            : 'Не удалось принять ставку — попробуйте ещё раз',
      )
    }
  }

  const topUp = () => {
    if (amountMinor === null || insufficient || !open) return
    setError(null)
    const result = addJackpotStake(amountMinor, makeRequestId())
    if (result.status !== 'ok') {
      setError(
        result.reason === 'insufficient_funds'
          ? 'Недостаточно средств на балансе'
          : 'Не удалось принять докидывание — попробуйте ещё раз',
      )
    }
  }

  const draw = () => {
    if (!open) return
    setError(null)
    const result = drawJackpot(makeRequestId())
    if (result.status !== 'ok') {
      setError('Тираж не состоялся — попробуйте ещё раз')
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.topRow}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)}>
          <ChevronLeftIcon className={styles.backIcon} aria-hidden /> Назад
        </button>
      </div>

      <h1 className={styles.title}>Solo Jackpot</h1>

      {/* Полотно: банк, доля в банке, билет тиража */}
      <div className={styles.canvas}>
        <div className={styles.bankRow}>
          <span className={styles.bankLabel}>Банк</span>
          <span className={styles.bankValue} data-testid="bank">
            {round ? `${formatMinor(round.poolMinor)} TON` : '—'}
          </span>
        </div>

        {round && (
          <>
            <div
              className={styles.shareBar}
              role="img"
              aria-label={`Доля игрока ${(round.shareParts / 100).toFixed(2)}% банка`}
            >
              <span
                className={styles.shareFill}
                style={{ width: `${round.shareParts / 100}%` }}
              />
            </div>
            <div className={styles.shareRow}>
              <span className={styles.sharePlayer}>
                Вы: {(round.shareParts / 100).toFixed(2)}%
              </span>
              <span className={styles.shareHouse}>Казино: добивка ×9 первой ставки</span>
            </div>
          </>
        )}

        <div className={styles.rollDisplay}>
          <span
            className={cx(
              styles.rollValue,
              finished && round?.result && (round.result.won ? styles.rollWon : styles.rollLost),
            )}
          >
            {finished && round?.result ? String(round.result.roll).padStart(4, '0') : '· · · ·'}
          </span>
          <span className={styles.rollHint}>
            {finished && round?.result
              ? `Билет из 10000 · выигрыш < ${round.chanceTickets}`
              : open
                ? 'Докиньте вклад или проведите тираж'
                : 'Тираж — билет из 10000; откройте банк ставкой'}
          </span>
        </div>

        {finished && round?.result && (
          <p
            className={
              round.result.won ? styles.resultWon : styles.resultLost
            }
            data-testid="jackpot-result"
          >
            {round.result.won
              ? `Банк ваш: +${formatMinor(round.result.payoutMinor - round.stakedMinor)} TON`
              : `Банк забирает казино: −${formatMinor(round.stakedMinor)} TON`}
          </p>
        )}
      </div>

      {/* Панель вклада / тиража */}
      <div className={styles.betPanel}>
        {(!open || finished) && (
          <>
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
              label="Вклад в банк"
              inputMode="decimal"
              placeholder="Сумма в TON"
              suffix="TON"
              value={amountInput}
              onChange={(event) => {
                setError(null)
                setAmountInput(event.target.value)
              }}
              hint={
                round
                  ? `Первый вклад задаёт добивку казино ×9 · баланс: ${formatMinor(balance)} TON`
                  : `Казино добивает ×9 · выплата — весь банк · баланс: ${formatMinor(balance)} TON`
              }
            />

            <button
              type="button"
              className={styles.placeBet}
              disabled={amountMinor === null || insufficient}
              onClick={stake}
            >
              {amountMinor !== null
                ? `Зайти в банк · ${formatMinor(amountMinor)} TON`
                : 'Зайти в банк'}
            </button>
          </>
        )}

        {open && round && (
          <>
            <div className={styles.openStats}>
              <span>Внесено: {formatMinor(round.stakedMinor)} TON</span>
              <span>
                Шанс: {(round.chanceTickets / 100).toFixed(2)}%
                {(() => {
                  const ev = jackpotEvMinor(round.stakedMinor, round.houseMinor)
                  return ` · EV: ${ev < 0 ? '−' : ''}${formatMinor(Math.abs(ev))} TON`
                })()}
              </span>
            </div>

            <div className={styles.presets} role="group" aria-label="Быстрые суммы докидывания">
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
              label="Докинуть в банк"
              inputMode="decimal"
              placeholder="Сумма в TON"
              suffix="TON"
              value={amountInput}
              onChange={(event) => {
                setError(null)
                setAmountInput(event.target.value)
              }}
              hint={`Докидывание растит вашу долю и шанс · баланс: ${formatMinor(balance)} TON`}
            />

            <button
              type="button"
              className={styles.placeBet}
              disabled={amountMinor === null || insufficient}
              onClick={topUp}
            >
              {amountMinor !== null
                ? `Докинуть · ${formatMinor(amountMinor)} TON`
                : 'Докинуть'}
            </button>

            <button type="button" className={styles.drawBet} onClick={draw}>
              Провести тираж
            </button>
          </>
        )}

        {error && (
          <p className={styles.betError} role="alert">
            {error}
          </p>
        )}
      </div>

      <p className={styles.note}>
        Джекпот: шанс победы равен доле вашей ставки в общем банке.
        Победитель забирает весь банк раунда!
      </p>
    </div>
  )
}
