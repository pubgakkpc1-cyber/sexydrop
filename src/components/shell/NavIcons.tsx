import type { ReactNode, SVGProps } from 'react'

/**
 * Иконки нижнего меню SEXY DROP: двухтонные «пухлые» глифы.
 * Основная форма — currentColor, вторая деталь (.nav-tone) — тот же цвет с пониженной
 * прозрачностью, поэтому иконка читается объёмной и в покое, и на красной капсуле.
 */
export interface NavIconProps extends Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'fill'> {
  active?: boolean
}

function Svg({ active, children, ...rest }: NavIconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden data-active={active ? 'true' : 'false'} {...rest}>
      {children}
    </svg>
  )
}

/** Инвентарь — подарок: крышка, корпус, лента. */
export function NavInventoryIcon({ active, ...rest }: NavIconProps) {
  return (
    <Svg active={active} {...rest}>
      <path className="nav-tone" d="M4 11h16v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" />
      <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v2A1.5 1.5 0 0 1 19.5 11h-15A1.5 1.5 0 0 1 3 9.5z" />
      <path d="M10.5 6h3v15h-3z" fillOpacity="0.55" />
      <path d="M12 6C10.6 2.6 7 2.2 7.2 4.4 7.35 6 10 6 12 6zm0 0c1.4-3.4 5-3.8 4.8-1.6C16.65 6 14 6 12 6z" />
    </Svg>
  )
}

/** Пригласить — два силуэта и плюс. */
export function NavInviteIcon({ active, ...rest }: NavIconProps) {
  return (
    <Svg active={active} {...rest}>
      <circle className="nav-tone" cx="16.5" cy="8.2" r="3" />
      <path className="nav-tone" d="M14.3 13.6c3.8-.7 7.4 1.2 7.7 5.4h-5.4a6.6 6.6 0 0 0-2.3-5.4z" />
      <circle cx="9" cy="8.5" r="3.9" />
      <path d="M1.8 20.4c.2-3.9 3.1-6.2 7.2-6.2s7 2.3 7.2 6.2a.9.9 0 0 1-.9.9H2.7a.9.9 0 0 1-.9-.9z" />
    </Svg>
  )
}

/** Главная — дом. */
export function NavHomeIcon({ active, ...rest }: NavIconProps) {
  return (
    <Svg active={active} {...rest}>
      <path d="M10.9 2.7a1.7 1.7 0 0 1 2.2 0l7.6 6.4c.5.4.8 1 .8 1.7V19a2.4 2.4 0 0 1-2.4 2.4H4.9A2.4 2.4 0 0 1 2.5 19v-8.2c0-.7.3-1.3.8-1.7z" />
      <path className="nav-tone" d="M9.5 21.4v-5.2a2.5 2.5 0 0 1 5 0v5.2z" style={{ fill: 'var(--nav-cut, #1b1819)', fillOpacity: 0.55 }} />
    </Svg>
  )
}

/** Рейтинг — пьедестал из трёх ступеней. */
export function NavTrophyIcon({ active, ...rest }: NavIconProps) {
  return (
    <Svg active={active} {...rest}>
      <path className="nav-tone" d="M2.5 13.5A1.5 1.5 0 0 1 4 12h4.5v9H4a1.5 1.5 0 0 1-1.5-1.5z" />
      <path className="nav-tone" d="M15.5 15H20a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 20 21h-4.5z" />
      <path d="M9.5 4.5A1.5 1.5 0 0 1 11 3h2a1.5 1.5 0 0 1 1.5 1.5V21h-5z" />
      <path d="m12 5.3.6 1.3 1.4.2-1 1 .25 1.4L12 8.5l-1.25.7L11 7.8l-1-1 1.4-.2z" style={{ fill: 'var(--nav-cut, #1b1819)', fillOpacity: 0.6 }} />
    </Svg>
  )
}

/** Заработок — огранённый кристалл. */
export function NavEarnIcon({ active, ...rest }: NavIconProps) {
  return (
    <Svg active={active} {...rest}>
      <path className="nav-tone" d="M2.6 9.4 6.3 4h11.4l3.7 5.4z" />
      <path d="M2.6 9.4h18.8l-8.4 11.2a1.2 1.2 0 0 1-1.9 0z" />
      <path d="M8.6 9.4 12 20.6l3.4-11.2z" style={{ fill: 'var(--nav-cut, #1b1819)', fillOpacity: 0.28 }} />
    </Svg>
  )
}
