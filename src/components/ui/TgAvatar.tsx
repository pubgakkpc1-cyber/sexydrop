import { cx } from '../../lib/cx'

/** Градиенты «как у Telegram» для аватарок без фото. */
const TG_GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ['#ff885e', '#ff516a'], // красный
  ['#ffcd6a', '#ffa85c'], // оранжевый
  ['#82b1ff', '#665fff'], // фиолетовый
  ['#a0de7e', '#54cb68'], // зелёный
  ['#53edd6', '#28c9b7'], // бирюзовый
  ['#72d5fd', '#2a9ef1'], // голубой
  ['#e0a2f3', '#d669ed'], // розовый
]

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** «Al_Sheikh» → «AS», «kamronbek» → «K»: как инициалы в Telegram. */
export function tgInitials(name: string): string {
  const parts = name.split(/[\s_.-]+/).filter(Boolean)
  const first = parts[0]?.[0] ?? '?'
  const second = parts.length > 1 ? (parts[1]?.[0] ?? '') : ''
  return (first + second).toUpperCase()
}

interface TgAvatarProps {
  name: string
  size?: number
  className?: string
}

/** Круглая аватарка в стиле Telegram: градиент + инициалы. Цвет стабильно выбирается по имени. */
export function TgAvatar({ name, size = 44, className }: TgAvatarProps) {
  const [a, b] = TG_GRADIENTS[hash(name) % TG_GRADIENTS.length]!
  return (
    <span
      className={cx(className)}
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: '50%',
        background: `linear-gradient(160deg, ${a}, ${b})`,
        color: '#fff',
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: Math.round(size * 0.38),
        letterSpacing: 0.5,
        textShadow: '0 1px 2px rgba(0,0,0,0.25)',
      }}
    >
      {tgInitials(name)}
    </span>
  )
}
