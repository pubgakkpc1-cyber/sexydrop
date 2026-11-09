import type { CSSProperties } from 'react'
import styles from './KeyCap.module.css'

export interface KeyLevel {
  name: string
  face: string
  rimHi: string
  rimLo: string
  wallHi: string
  wallLo: string
  ink: string
  inkHi: string
  accent: string
  ring?: string
}

/** Вид клавиши по лигам (индекс = индекс лиги): форма и надпись те же, меняются корпус и цвет. */
export const KEY_LEVELS: KeyLevel[] = [
  { name: 'Сталь', face: '#6a7388', rimHi: '#8791a8', rimLo: '#4d5568', wallHi: '#3d4454', wallLo: '#222631', ink: '#f4c24a', inkHi: 'rgba(10,12,20,.55)', accent: '#8791a8' },
  { name: 'Бронза', face: '#a8683a', rimHi: '#c58650', rimLo: '#855027', wallHi: '#6a3f1d', wallLo: '#3e2310', ink: '#fbe2c4', inkHi: 'rgba(50,24,6,.55)', accent: '#c58650' },
  { name: 'Серебро', face: '#a9aeb8', rimHi: '#c6cad2', rimLo: '#868b96', wallHi: '#686d78', wallLo: '#3b3e46', ink: '#2f3542', inkHi: 'rgba(255,255,255,.6)', accent: '#c6cad2' },
  { name: 'Золото', face: '#c79a3a', rimHi: '#dcb35a', rimLo: '#9a7226', wallHi: '#80601c', wallLo: '#523b0f', ink: '#4a3208', inkHi: 'rgba(255,236,170,.5)', accent: '#e0a830' },
  { name: 'Платина', face: '#8fa3b8', rimHi: '#b0c2d4', rimLo: '#6a7f96', wallHi: '#4f6277', wallLo: '#2a3643', ink: '#ffffff', inkHi: 'rgba(15,30,50,.5)', accent: '#b0c2d4' },
  { name: 'Алмаз', face: '#5fb4d6', rimHi: '#8ad0ea', rimLo: '#3a8aae', wallHi: '#2a6f8f', wallLo: '#143c50', ink: '#ffffff', inkHi: 'rgba(8,40,60,.5)', accent: '#8ad0ea' },
  { name: 'Легенда', face: '#26262b', rimHi: '#3c3c44', rimLo: '#17171b', wallHi: '#101013', wallLo: '#060608', ink: '#f2c542', inkHi: 'rgba(0,0,0,.7)', accent: '#f2c542', ring: '#b8892a' },
]

/** Матовая клавиша «как на клавиатуре»: стенка стоит на месте, крышка опускается при нажатии. */
export function KeyCap({ level, pressed = false, scale = 1 }: { level: number; pressed?: boolean; scale?: number }) {
  const k = KEY_LEVELS[Math.max(0, Math.min(level, KEY_LEVELS.length - 1))]!
  const vars = {
    '--face': k.face,
    '--rim-hi': k.rimHi,
    '--rim-lo': k.rimLo,
    '--wall-hi': k.wallHi,
    '--wall-lo': k.wallLo,
    '--ink': k.ink,
    '--ink-hi': k.inkHi,
    '--ring': k.ring ?? 'transparent',
  } as CSSProperties
  return (
    <span className={styles.box} style={{ width: 196 * scale, height: 194 * scale }} aria-hidden>
      <span className={`${styles.key} ${pressed ? styles.down : ''}`} style={{ ...vars, transform: `scale(${scale})` }}>
        <span className={styles.side} />
        <span className={styles.cap}>
          <span className={styles.face}>
            <span className={styles.legend}>
              <svg viewBox="0 0 24 24" className={styles.bolt}>
                <path d="M13 2L4 14h6l-1 8 9-12h-6z" />
              </svg>
              <span className={styles.tap}>TAP</span>
            </span>
          </span>
        </span>
      </span>
    </span>
  )
}

const SLICES = 26

/**
 * Настоящая объёмная клавиша: стенка собрана из слоёв по высоте, поэтому видна со всех сторон,
 * когда кнопка наклоняется к касанию. Нажатие опускает крышку и «прячет» верхние слои.
 */
export function KeyCap3D({ level, pressed = false }: { level: number; pressed?: boolean }) {
  const k = KEY_LEVELS[Math.max(0, Math.min(level, KEY_LEVELS.length - 1))]!
  const vars = {
    '--face': k.face,
    '--rim-hi': k.rimHi,
    '--rim-lo': k.rimLo,
    '--wall-hi': k.wallHi,
    '--wall-lo': k.wallLo,
    '--ink': k.ink,
    '--ink-hi': k.inkHi,
    '--ring': k.ring ?? 'transparent',
    '--press': pressed ? '5px' : `${SLICES}px`,
  } as CSSProperties
  return (
    <span className={`${styles.k3} ${pressed ? styles.k3down : ''}`} style={vars} aria-hidden>
      <span className={styles.k3shadow} />
      {Array.from({ length: SLICES }, (_, i) => (
        <span key={i} className={styles.slice} style={{ '--i': i, '--t': i / SLICES } as CSSProperties} />
      ))}
      <span className={styles.k3top}>
        <span className={styles.k3face}>
          <span className={styles.legend}>
            <svg viewBox="0 0 24 24" className={styles.bolt}>
              <path d="M13 2L4 14h6l-1 8 9-12h-6z" />
            </svg>
            <span className={styles.tap}>TAP</span>
          </span>
        </span>
      </span>
    </span>
  )
}
