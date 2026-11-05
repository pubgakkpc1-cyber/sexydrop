import { useEffect, useRef, useState } from 'react'
import { GRAPHICS_LABELS, useGraphicsStore } from '../../store/graphics'
import { hapticImpact } from '../../lib/telegram'
import { cx } from '../../lib/cx'
import styles from './GameTopBar.module.css'

function GearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}

interface GraphicsMenuProps {
  /** С какой стороны раскрывать список: в шапке меню шестерёнка справа — список влево. */
  align?: 'left' | 'right'
}

/** Шестерёнка «Настройки графики» и список «Высокая / Средняя / Минимальная» (меню и игры). */
export function GraphicsMenu({ align = 'left' }: GraphicsMenuProps) {
  const quality = useGraphicsStore((s) => s.quality)
  const setQuality = useGraphicsStore((s) => s.setQuality)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  return (
    <div className={styles.gfxWrap} ref={ref}>
      <button
        type="button"
        className={styles.gear}
        aria-label="Настройки графики"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          hapticImpact('light')
          setOpen((v) => !v)
        }}
      >
        <GearIcon className={styles.gearIcon} />
      </button>

      {open && (
        <div className={cx(styles.menu, align === 'right' && styles.menuRight)} role="menu" aria-label="Графика">
          <span className={styles.menuTitle}>ГРАФИКА</span>
          {GRAPHICS_LABELS.map((q) => (
            <button
              key={q.id}
              type="button"
              role="menuitemradio"
              aria-checked={quality === q.id}
              className={cx(styles.menuItem, quality === q.id && styles.menuItemActive)}
              onClick={() => {
                hapticImpact('light')
                setQuality(q.id)
                setOpen(false)
              }}
            >
              <span>{q.label}</span>
              {quality === q.id && <span className={styles.check} aria-hidden>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
