import { useSpinSpeedStore } from '../../store/spinSpeed'
import { hapticImpact } from '../../lib/telegram'
import styles from './TurboToggle.module.css'

/** Значок «быстрый прокрут» (молния) для угла рулетки/кольца: нажали — горит красным, ещё раз — выключен. */
export function TurboToggle({ disabled = false, className = '' }: { disabled?: boolean; className?: string }) {
  const turbo = useSpinSpeedStore((s) => s.turbo)
  const setTurbo = useSpinSpeedStore((s) => s.setTurbo)
  return (
    <button
      type="button"
      className={`${styles.toggle} ${turbo ? styles.on : ''} ${className}`}
      aria-pressed={turbo}
      aria-label={turbo ? 'Быстрый прокрут включён' : 'Быстрый прокрут выключен'}
      title="Быстрый прокрут"
      disabled={disabled}
      onClick={() => {
        hapticImpact('light')
        setTurbo(!turbo)
      }}
    >
      <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden>
        <path d="M13 2L4 14h6l-1 8 9-12h-6z" />
      </svg>
    </button>
  )
}
