import { useState } from 'react'
import { checkSubscriptions, type SubChannel } from '../../lib/subscriptions'
import { getWebApp } from '../../lib/telegram'
import styles from './SubscribeModal.module.css'

interface SubscribeModalProps {
  channels: SubChannel[]
  /** Все подписки подтверждены — можно крутить. */
  onPassed: () => void
  onClose: () => void
}

function openLink(url: string) {
  const webApp = getWebApp()
  if (webApp?.openTelegramLink) webApp.openTelegramLink(url)
  else window.open(url, '_blank', 'noopener')
}

/** Окно обязательных подписок перед бесплатным кейсом: ссылки на каналы и кнопка «Проверить». */
export function SubscribeModal({ channels: initial, onPassed, onClose }: SubscribeModalProps) {
  const [channels, setChannels] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const recheck = async () => {
    setBusy(true)
    setFailed(false)
    const res = await checkSubscriptions(true)
    setBusy(false)
    if (res.ok) {
      onPassed()
      return
    }
    setChannels(res.channels)
    setFailed(true)
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Обязательные подписки">
      <div className={styles.modal}>
        <h2 className={styles.title}>Подпишитесь, чтобы крутить</h2>
        <p className={styles.sub}>
          Бесплатный кейс открывается после подписки на наши каналы. Подпишитесь и нажмите «Проверить».
        </p>

        <ul className={styles.list}>
          {channels.map((c) => (
            <li key={c.key} className={styles.row}>
              <span className={styles.name}>
                {c.title}
                {c.subscribed === true && <span className={styles.done}> ✓ подписаны</span>}
              </span>
              {c.subscribed !== true && (
                <button type="button" className={styles.subBtn} onClick={() => openLink(c.url)}>
                  Подписаться
                </button>
              )}
            </li>
          ))}
        </ul>

        {failed && (
          <p className={styles.error} role="alert">
            Подписка пока не найдена. Подпишитесь на все каналы и проверьте снова.
          </p>
        )}

        <button type="button" className={styles.primary} disabled={busy} onClick={() => void recheck()}>
          {busy ? 'Проверяем…' : 'Проверить подписку'}
        </button>
        <button type="button" className={styles.close} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  )
}
