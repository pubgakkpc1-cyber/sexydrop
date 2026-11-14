import { useSpinSpeedStore } from '../../store/spinSpeed'
import { hapticImpact } from '../../lib/telegram'
import styles from './TurboToggle.module.css'

/** Переключатель «Быстрый прокрут»: запоминается на устройстве, действует в кейсах и апгрейде. */
export function TurboToggle({ disabled = false }: { disabled?: boolean }) {
  const turbo = useSpinSpeedStore((s) => s.turbo)
  const setTurbo = useSpinSpeedStore((s) => s.setTurbo)
  return (
    <button
      type="button"
      className={`${styles.toggle} ${turbo ? styles.on : ''}`}
      aria-pressed={turbo}
      disabled={disabled}
      onClick={() => {
        hapticImpact('light')
        setTurbo(!turbo)
      }}
    >
      <span className={styles.bolt} aria-hidden>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M13 2L4 14h6l-1 8 9-12h-6z" />
        </svg>
      </span>
      Быстрый прокрут
      <span className={styles.state}>{turbo ? 'вкл' : 'выкл'}</span>
    </button>
  )
}
