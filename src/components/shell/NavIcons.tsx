import type { ReactNode, SVGProps } from 'react'

/**
 * Иконки нижнего меню SEXY DROP: плотные залитые глифы (цвет — currentColor) с красной
 * деталью-«изюминкой» в фирменном стиле: каплей, искрой или звездой.
 */
export interface NavIconProps extends Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'fill'> {
  active?: boolean
}

const ACCENT = '#ff5a64'
const CUT = 'var(--nav-cut, #131212)'

function Svg({ active, children, ...rest }: NavIconProps & { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden data-active={active ? 'true' : 'false'} {...rest}>
      {children}
    </svg>
  )
}

/** Инвентарь — подарочная коробка с красной лентой и бантом. */
export function NavInventoryIcon({ active, ...rest }: NavIconProps) {
  return (
    <Svg active={active} {...rest}>
      <path d="M3.6 11.2h16.8v7.3a2.6 2.6 0 0 1-2.6 2.6H6.2a2.6 2.6 0 0 1-2.6-2.6z" />
      <rect x="2.4" y="7.4" width="19.2" height="4.4" rx="1.9" fillOpacity="0.88" />
      <rect className="nav-accent" x="10.5" y="7.4" width="3" height="13.7" fill={ACCENT} />
      <path
        className="nav-accent"
        d="M12 7.4C11.3 4 7.6 3.4 7.8 5.7c.15 1.7 2.7 1.7 4.2 1.7zM12 7.4c.7-3.4 4.4-4 4.2-1.7-.15 1.7-2.7 1.7-4.2 1.7z"
        fill={ACCENT}
      />
    </Svg>
  )
}

/** Пригласить — человек со значком «+». */
export function NavInviteIcon({ active, ...rest }: NavIconProps) {
  return (
    <Svg active={active} {...rest}>
      <circle cx="9.4" cy="8" r="4" />
      <path d="M2.4 20.4c0-4 3.1-6.6 7-6.6 1.3 0 2.5.3 3.5.8a5.6 5.6 0 0 0-1 7.2z" />
      <circle className="nav-accent" cx="18" cy="16.2" r="4.6" fill={ACCENT} />
      <path d="M18 13.9v4.6M15.7 16.2h4.6" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
    </Svg>
  )
}

/** Главная — дом с дверью-каплей бренда. */
export function NavHomeIcon({ active, ...rest }: NavIconProps) {
  return (
    <Svg active={active} {...rest}>
      <path d="M11.2 2.9a1.2 1.2 0 0 1 1.6 0l8.2 7.1a1 1 0 0 1-.65 1.75H19V19a2.3 2.3 0 0 1-2.3 2.3H7.3A2.3 2.3 0 0 1 5 19v-7.25H3.65A1 1 0 0 1 3 10z" />
      <path
        className="nav-accent"
        d="M12 11.6c2 2.3 3.1 3.8 3.1 5.2a3.1 3.1 0 0 1-6.2 0c0-1.4 1.1-2.9 3.1-5.2z"
        fill={ACCENT}
      />
    </Svg>
  )
}

/** Рейтинг — кубок со звездой. */
export function NavTrophyIcon({ active, ...rest }: NavIconProps) {
  return (
    <Svg active={active} {...rest}>
      <path d="M6.4 3.2h11.2v6a5.6 5.6 0 0 1-11.2 0z" />
      <path d="M6.4 5.2H3.6v1.7a3.8 3.8 0 0 0 3.5 3.8M17.6 5.2h2.8v1.7a3.8 3.8 0 0 1-3.5 3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="10.7" y="14.4" width="2.6" height="3.4" />
      <rect x="7.2" y="17.6" width="9.6" height="3.2" rx="1.6" />
      <path
        className="nav-accent"
        d="m12 4.9 1.1 2.25 2.5.36-1.8 1.76.43 2.48L12 10.55l-2.23 1.2.43-2.48-1.8-1.76 2.5-.36z"
        fill={ACCENT}
      />
    </Svg>
  )
}

/** Заработок — монета со звездой и искрой. */
export function NavEarnIcon({ active, ...rest }: NavIconProps) {
  return (
    <Svg active={active} {...rest}>
      <circle cx="11.6" cy="12.6" r="8.6" />
      <circle cx="11.6" cy="12.6" r="6.3" fill="none" style={{ stroke: CUT }} strokeWidth="1.2" strokeOpacity="0.55" />
      <path
        className="nav-accent"
        d="m11.6 8.7 1.2 2.45 2.7.4-1.95 1.9.46 2.7-2.4-1.27-2.4 1.27.46-2.7-1.95-1.9 2.7-.4z"
        fill={ACCENT}
      />
      <path d="M20.2 1.8v3.6M18.4 3.6H22" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  )
}
