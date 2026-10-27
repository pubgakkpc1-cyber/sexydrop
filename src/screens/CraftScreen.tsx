import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { giftById } from '../data/catalog'
import { useInventoryStore } from '../store/inventory'
import { formatMinor, type Minor } from '../lib/money'
import { makeRequestId } from '../lib/requestId'
import { craft, craftCandidates } from '../services/demoCraftService'
import { GAME_RTP } from '../lib/gameConfig'
import { BottomSheet, Button } from '../components/ui'
import { ChevronLeftIcon, CubeIcon } from '../components/shell/icons'
import { cx } from '../lib/cx'
import styles from './CraftScreen.module.css'

interface CraftOutcome {
  won: boolean
  targetGiftId: string
  inputsMinor: Minor
  chance: number
}

/**
 * Крафт (4.5). Demo Mode: EV результата крафта — функция суммарной
 * стоимости входов × RTP: цели и шансы считаются формулой
 * p_i = RTP·S / v_i (цели дороже 0.98·S), бросок — локальный demo-сервис;
 * сервер — TIER 7 (7.6).
 */
export function CraftScreen() {
  const navigate = useNavigate()
  const items = useInventoryStore((s) => s.items)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [outcome, setOutcome] = useState<CraftOutcome | null>(null)

  const rows = useMemo(
    () =>
      items.flatMap((item) => {
        const gift = giftById.get(item.giftId)
        return gift ? [{ item, gift }] : []
      }),
    [items],
  )

  const sumMinor = useMemo(
    () =>
      rows
        .filter(({ item }) => selected.has(item.uid))
        .reduce((sum, { gift }) => sum + gift.priceMinor, 0),
    [rows, selected],
  )

  const candidates = useMemo(() => craftCandidates(sumMinor), [sumMinor])

  const toggle = (uid: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(uid)) next.delete(uid)
      else next.add(uid)
      return next
    })
  }

  const confirm = () => {
    const uids = [...selected]
    if (uids.length < 2) return
    const result = craft(uids, makeRequestId())
    if (result.status !== 'ok') return
    setSelected(new Set())
    setOutcome({
      won: result.won,
      targetGiftId: result.targetGiftId,
      inputsMinor: result.inputsMinor,
      chance: result.chance,
    })
  }

  return (
    <div className={styles.screen}>
      <div className={styles.topRow}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)}>
          <ChevronLeftIcon className={styles.backIcon} aria-hidden /> Назад
        </button>
        <span className={styles.demoChip}>Demo Mode</span>
      </div>

      <h1 className={styles.title}>Крафт</h1>

      {/* Полотно: сумма входов + кандидаты с честными шансами */}
      <div className={styles.board}>
        <span className={styles.boardLabel}>Сумма предметов</span>
        <span className={styles.sumPill}>{formatMinor(sumMinor)} TON</span>
        {candidates.length > 0 ? (
          <div className={styles.candidates} aria-label="Возможные результаты">
            {candidates.slice(0, 4).map((candidate) => (
              <span key={candidate.giftId} className={styles.candidate}>
                <img
                  className={styles.candidateImage}
                  src={giftById.get(candidate.giftId)?.image}
                  alt=""
                />
                <span className={styles.candidateName}>
                  {giftById.get(candidate.giftId)?.name}
                </span>
                <span className={styles.candidateChance}>
                  {(Math.floor(candidate.chance * 10000) / 100)
                    .toFixed(2)
                    .replace(/\.?0+$/, '')}
                  %
                </span>
              </span>
            ))}
            {candidates.length > 4 && (
              <span className={styles.candidate}>
                <span className={styles.candidateName}>
                  +{candidates.length - 4} других
                </span>
              </span>
            )}
          </div>
        ) : (
          <span className={styles.boardEmpty}>
            {sumMinor === 0
              ? 'Выберите предметы для крафта'
              : 'Для этой суммы нет целей — добавьте или уберите предметы'}
          </span>
        )}
      </div>

      {/* Мульти-выбор реальных предметов инвентаря */}
      <h2 className={styles.sectionTitle}>Предметы для крафта</h2>
      {rows.length === 0 ? (
        <div className={styles.emptyInline}>
          <CubeIcon aria-hidden /> Инвентарь пуст — откройте кейсы, чтобы получить предметы
        </div>
      ) : (
        <div className={styles.grid}>
          {rows.map(({ item, gift }) => (
            <button
              key={item.uid}
              type="button"
              className={cx(styles.cell, selected.has(item.uid) && styles.cellActive)}
              data-rarity={gift.rarity}
              aria-pressed={selected.has(item.uid)}
              onClick={() => toggle(item.uid)}
            >
              <img className={styles.cellImage} src={gift.image} alt="" />
              <span className={styles.cellName}>{gift.name}</span>
              <span className={styles.cellPrice}>{formatMinor(gift.priceMinor)}</span>
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        className={styles.placeBet}
        disabled={selected.size < 2 || candidates.length === 0}
        onClick={confirm}
      >
        {selected.size < 2 ? 'Выберите минимум 2 предмета' : 'Крафт'}
      </button>

      <p className={styles.note}>
        Demo Mode: цели — предметы дороже {(GAME_RTP * 100).toFixed(0)}% суммы входа,
        шанс p = {GAME_RTP}·S/цена цели, EV крафта = {GAME_RTP}·S ровно. Проигрыш сжигает
        входные предметы. Серверный крафт — TIER 7 (7.6).
      </p>

      <BottomSheet open={outcome !== null} onClose={() => setOutcome(null)} title="Результат">
        {outcome && (
          <div className={styles.resultWrap}>
            <img
              className={cx(styles.resultImage, !outcome.won && styles.resultLost)}
              src={giftById.get(outcome.targetGiftId)?.image}
              alt=""
            />
            <span
              className={cx(
                styles.resultTitle,
                outcome.won ? styles.resultTitleWon : styles.resultTitleLost,
              )}
            >
              {outcome.won ? 'Крафт удался!' : 'Не получилось'}
            </span>
            <span className={styles.resultMeta}>
              {outcome.won
                ? `Получено: ${giftById.get(outcome.targetGiftId)?.name} · ${formatMinor(
                    outcome.inputsMinor,
                  )} TON израсходовано`
                : `Сумма сгорела: ${formatMinor(outcome.inputsMinor)} TON`}
            </span>
            <Button fullWidth variant="cta" onClick={() => setOutcome(null)}>
              Готово
            </Button>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
