import { useCallback, useEffect, useRef, useState } from 'react'
import { adminFetch } from '../../lib/adminApi'
import styles from './AdminPanel.module.css'

interface Audience {
  id: string
  label: string
  count: number
}
interface Progress {
  state: 'idle' | 'running' | 'done'
  total?: number
  sent?: number
  failed?: number
  last_error?: string
}
interface Preset {
  id: string
  label: string
  button: string
  photo?: boolean
  text: string
}
interface Info {
  audiences: Audience[]
  status: Progress
  presets?: Preset[]
}

type ButtonKind = 'none' | 'app' | 'link'

const ALLOWED = ['b', 'i', 'u', 's', 'code']

/** Превью как в Telegram: всё экранируется, кроме простых тегов без атрибутов. */
export function previewHtml(text: string): string {
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  for (const tag of ALLOWED) html = html.replace(new RegExp(`&lt;(/?)${tag}&gt;`, 'g'), `<$1${tag}>`)
  return html
}

/** Рассылка от имени бота: выбрать аудиторию, написать текст, проверить на себе, отправить. */
export function AdminBroadcastTab() {
  const [info, setInfo] = useState<Info | null>(null)
  const [audience, setAudience] = useState('all')
  const [text, setText] = useState('')
  const [kind, setKind] = useState<ButtonKind>('app')
  const [btnText, setBtnText] = useState('Играть')
  const [btnUrl, setBtnUrl] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [preset, setPreset] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const area = useRef<HTMLTextAreaElement>(null)

  const refresh = useCallback(async () => {
    const r = await adminFetch<Info>('/api/admin/broadcast')
    if (r.ok) setInfo(r.data)
    else setMsg({ ok: false, text: r.error })
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const running = info?.status.state === 'running'
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => void refresh(), 2000)
    return () => clearInterval(t)
  }, [running, refresh])

  const presetHasPhoto = Boolean(info?.presets?.find((p) => p.id === preset)?.photo)
  const count = info?.audiences.find((a) => a.id === audience)?.count ?? 0
  const wrap = (tag: string) => {
    const el = area.current
    if (!el) return
    const { selectionStart: a, selectionEnd: b } = el
    setText(`${text.slice(0, a)}<${tag}>${text.slice(a, b)}</${tag}>${text.slice(b)}`)
  }

  const send = async (test: boolean) => {
    setBusy(true)
    setMsg(null)
    const r = await adminFetch<{ total?: number }>('/api/admin/broadcast', {
      method: 'POST',
      body: {
        text,
        audience,
        test,
        preset,
        open_app: kind === 'app',
        button_text: kind === 'none' ? null : btnText.trim() || null,
        button_url: kind === 'link' ? btnUrl.trim() || null : null,
      },
    })
    setBusy(false)
    setConfirm(false)
    if (!r.ok) return setMsg({ ok: false, text: r.error })
    setMsg({ ok: true, text: test ? 'Тест отправлен вам в Telegram' : `Рассылка запущена: ${r.data.total ?? 0} получателей` })
    if (!test) void refresh()
  }

  const st = info?.status
  const canSend = text.trim().length > 0 && !busy && !running

  return (
    <div className={styles.tab}>
      {(info?.presets ?? []).length > 0 && (
        <>
          <h3 className={styles.h3}>Готовые посты</h3>
          <div className={styles.chips}>
            {(info?.presets ?? []).map((p) => (
              <button
                key={p.id}
                type="button"
                className={`${styles.chip} ${preset === p.id ? styles.chipOn : ''}`}
                onClick={() => {
                  setPreset(p.id)
                  setText(p.text)
                  setKind(p.button ? 'app' : 'none')
                  setBtnText(p.button || 'Играть')
                  setConfirm(false)
                }}
              >
                {p.label}
              </button>
            ))}
            {preset && (
              <button type="button" className={styles.chip} onClick={() => setPreset(null)}>
                Убрать картинку
              </button>
            )}
          </div>
          {preset && <p className={styles.note}>{presetHasPhoto ? 'К сообщению прикрепится картинка. ' : ''}Если не менять текст, он уйдёт с премиум-эмодзи.</p>}
        </>
      )}

      <h3 className={styles.h3}>1. Кому</h3>
      <div className={styles.chips} role="radiogroup" aria-label="Аудитория">
        {(info?.audiences ?? []).map((a) => (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={audience === a.id}
            className={`${styles.chip} ${audience === a.id ? styles.chipOn : ''}`}
            onClick={() => {
              setAudience(a.id)
              setConfirm(false)
            }}
          >
            {a.label} · {a.count}
          </button>
        ))}
      </div>

      <h3 className={styles.h3}>2. Текст</h3>
      <div className={styles.fmtRow}>
        <button type="button" className={styles.fmtBtn} onClick={() => wrap('b')} aria-label="Жирный"><b>Ж</b></button>
        <button type="button" className={styles.fmtBtn} onClick={() => wrap('i')} aria-label="Курсив"><i>К</i></button>
        <button type="button" className={styles.fmtBtn} onClick={() => wrap('code')} aria-label="Моноширинный">{'</>'}</button>
      </div>
      <textarea
        ref={area}
        className={styles.textarea}
        rows={6}
        maxLength={presetHasPhoto ? 1024 : 3500}
        placeholder="Текст сообщения. Можно &lt;b&gt;жирный&lt;/b&gt;, &lt;i&gt;курсив&lt;/i&gt;"
        aria-label="Текст рассылки"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setConfirm(false)
        }}
      />

      <h3 className={styles.h3}>3. Кнопка под сообщением</h3>
      <div className={styles.chips}>
        {(
          [
            ['app', 'Открыть приложение'],
            ['link', 'Своя ссылка'],
            ['none', 'Без кнопки'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" className={`${styles.chip} ${kind === k ? styles.chipOn : ''}`} onClick={() => setKind(k)}>
            {label}
          </button>
        ))}
      </div>
      {kind !== 'none' && (
        <input className={styles.search} aria-label="Текст кнопки" maxLength={40} value={btnText} onChange={(e) => setBtnText(e.target.value)} placeholder="Текст кнопки" />
      )}
      {kind === 'link' && (
        <input className={styles.search} aria-label="Ссылка кнопки" value={btnUrl} onChange={(e) => setBtnUrl(e.target.value)} placeholder="https://t.me/SexyDrop_official" />
      )}

      {text.trim() && (
        <>
          <h3 className={styles.h3}>Так увидит игрок</h3>
          <div className={styles.bubble}>
            {presetHasPhoto && <img src="/brand/ref/clicker-photo.jpg" alt="" style={{ width: '100%', borderRadius: 10, marginBottom: 8 }} />}
            {/* previewHtml экранирует всё, кроме b/i/u/s/code без атрибутов */}
            <div dangerouslySetInnerHTML={{ __html: previewHtml(text) }} />
            {kind !== 'none' && btnText.trim() && <div className={styles.bubbleBtn}>{btnText}</div>}
          </div>
        </>
      )}

      {msg && <p className={`${styles.note} ${msg.ok ? styles.good : styles.bad}`}>{msg.text}</p>}

      {st && st.state !== 'idle' && (
        <div className={styles.sysRow}>
          <span>{st.state === 'running' ? 'Идёт рассылка…' : 'Последняя рассылка'}</span>
          <span>
            {st.sent ?? 0} из {st.total ?? 0}
            {(st.failed ?? 0) > 0 ? ` · не доставлено ${st.failed}` : ''}
          </span>
        </div>
      )}
      {st?.last_error && <p className={styles.note}>Последняя ошибка Telegram: {st.last_error}</p>}

      <div className={styles.actions}>
        <button type="button" className={styles.refresh} disabled={!canSend} onClick={() => void send(true)}>
          Отправить тест мне
        </button>
        {!confirm ? (
          <button type="button" className={`${styles.refresh} ${styles.danger}`} disabled={!canSend || count === 0} onClick={() => setConfirm(true)}>
            Отправить всем ({count})
          </button>
        ) : (
          <>
            <button type="button" className={`${styles.refresh} ${styles.danger}`} disabled={busy} onClick={() => void send(false)}>
              Точно отправить {count} игрокам
            </button>
            <button type="button" className={styles.refresh} onClick={() => setConfirm(false)}>
              Отмена
            </button>
          </>
        )}
      </div>
      <p className={styles.note}>Получатели — игроки, которые уже открывали приложение. Кто заблокировал бота, попадёт в «не доставлено».</p>
    </div>
  )
}
