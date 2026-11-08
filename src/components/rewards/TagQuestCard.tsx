import { useEffect, useState } from 'react'
import { ApiError, apiPost } from '../../lib/api'
import { hydrateFromServer } from '../../lib/serverSync'
import { useTagQuestStore } from '../../store/tagQuest'
import { hapticNotify } from '../../lib/telegram'
import { StarIcon } from '../shell/icons'
import styles from './TagQuestCard.module.css'

function hms(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`
}

/** Задание «Поставь @sexydropbot в имя или описание»: 3 этапа, награда в звёздах раз в сутки. */
export function TagQuestCard() {
  const q = useTagQuestStore((s) => s.quest)
  const [now, setNow] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  if (!q) return null
  const expired = q.expires_at !== null && now > q.expires_at
  const stage: 1 | 2 | 3 = !q.started_at || expired ? 1 : q.ready_at !== null && now >= q.ready_at ? 3 : 2

  const copyTag = async () => {
    try {
      await navigator.clipboard.writeText(q.tag)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setNote({ ok: false, text: `Не удалось скопировать — введите ${q.tag} вручную` })
    }
  }

  const act = async (action: 'start' | 'check' | 'claim') => {
    if (busy) return
    setBusy(true)
    setNote(null)
    try {
      await apiPost(`/api/me/tag/${action}`, {})
      if (action === 'claim') {
        hapticNotify('success')
        setNote({ ok: true, text: `+${q.reward} ★ на звёздный баланс` })
      } else if (action === 'check') {
        setNote({ ok: true, text: 'Всё на месте — держите дальше' })
      }
    } catch (e) {
      setNote({ ok: false, text: e instanceof ApiError ? e.message : 'Не получилось, попробуйте ещё раз' })
    } finally {
      await hydrateFromServer()
      setBusy(false)
    }
  }

  const steps = [
    { n: 1, title: `Добавьте ${q.tag} в имя или описание`, hint: 'В имя/фамилию или в «О себе» (bio) вашего профиля Telegram' },
    { n: 2, title: 'Держите 24 часа', hint: 'Ник должен оставаться в профиле — проверим перед наградой' },
    { n: 3, title: 'Заберите награду', hint: `${q.reward} ★ в день. После 24 часов есть 10 часов на сбор` },
  ]

  return (
    <section className={styles.card} aria-label="Задание: ник бота в профиле">
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>Поставь {q.tag} в профиль</h2>
          <p className={styles.sub}>3 этапа · звёзды на баланс</p>
        </div>
        <span className={styles.reward}>
          до {q.reward} <StarIcon className={styles.star} aria-hidden />/день
        </span>
      </header>

      <ol className={styles.steps}>
        {steps.map((s) => (
          <li key={s.n} className={`${styles.step} ${s.n === stage ? styles.cur : ''} ${s.n < stage ? styles.done : ''}`}>
            <span className={styles.num}>{s.n < stage ? '✓' : s.n}</span>
            <span className={styles.stepText}>
              <b>{s.title}</b>
              <small>{s.hint}</small>
            </span>
          </li>
        ))}
      </ol>

      {stage === 1 && (
        <div className={styles.copyRow}>
          <button type="button" className={styles.btnGhost} onClick={() => void copyTag()}>
            {copied ? '✓ Скопировано' : `Скопировать ${q.tag}`}
          </button>
          <p className={styles.copyHint}>
            Telegram не даёт приложениям менять профиль сам. Скопируйте ник, откройте Настройки → Изменить профиль и
            вставьте его в имя или в «О себе», затем вернитесь и нажмите «Готово».
          </p>
        </div>
      )}
      {stage === 1 && (
        <button type="button" className={styles.btn} disabled={busy} onClick={() => void act('start')}>
          {busy ? 'Проверяем…' : 'Готово'}
        </button>
      )}
      {stage === 2 && q.ready_at !== null && (
        <>
          <div className={styles.timer} aria-label="Осталось держать">
            {hms(q.ready_at - now)}
          </div>
          <button type="button" className={styles.btnGhost} disabled={busy} onClick={() => void act('check')}>
            Проверить
          </button>
        </>
      )}
      {stage === 3 && q.expires_at !== null && (
        <>
          <div className={styles.timerSm}>Забрать в течение {hms(q.expires_at - now)}</div>
          <button type="button" className={styles.btn} disabled={busy} onClick={() => void act('claim')}>
            {busy ? 'Проверяем…' : `Забрать ${q.reward} ★`}
          </button>
        </>
      )}
      {note && (
        <p className={note.ok ? styles.ok : styles.err} role="status">
          {note.text}
        </p>
      )}
    </section>
  )
}
