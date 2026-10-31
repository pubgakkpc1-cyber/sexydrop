import type { SVGProps } from 'react'

/**
 * Иконки нижнего меню SEXY DROP. Каждая — линейная в покое и «залитая» (дуотон) в активном
 * состоянии; у каждой есть красная деталь-«изюминка» в форме капли/искры бренда.
 */
export interface NavIconProps extends Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'fill'> {
  active?: boolean
}

const ACCENT = '#ff5a64'

function Svg({ active, children, ...rest }: NavIconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      data-active={active ? 'true' : 'false'}
      {...rest}
    >
      {children}
    </svg>
  )
}

const fillOf = (active?: boolean) => ({ fill: active ? 'currentColor' : 'none', fillOpacity: active ? 0.2 : 0 })

/** Инвентарь — подарочная коробка с каплей-искрой. */
export function NavInventoryIcon({ active, ...rest }: NavIconProps) {
  return (
    <Svg active={active} {...rest}>
      <rect x="4" y="10.5" width="16" height="9.5" rx="2.2" {...fillOf(active)} />
      <rect x="3" y="7" width="18" height="4.2" rx="1.6" {...fillOf(active)} />
      <path d="M12 7v13" />
      <path d="M12 7C11 3.6 7.4 3.2 7.6 5.4 7.8 7 10.4 7 12 7zM12 7c1-3.4 4.6-3.8 4.4-1.6C16.2 7 13.6 7 12 7z" />
      <path className="nav-accent" d="M19.2 2.6c1 1.2 1.6 2 1.6 2.7a1.6 1.6 0 0 1-3.2 0c0-.7.6-1.5 1.6-2.7z" fill={ACCENT} stroke="none" />
    </Svg>
  )
}

/** Пригласить — человек с плюсом. */
export function NavInviteIcon({ active, ...rest }: NavIconProps) {
  return (
    <Svg active={active} {...rest}>
      <circle cx="9.5" cy="8.2" r="3.4" {...fillOf(active)} />
      <path d="M3.4 19.6c.5-3.4 3-5.4 6.1-5.4s5.6 2 6.1 5.4" {...fillOf(active)} />
      <path className="nav-accent" d="M18.4 7.4v6M15.4 10.4h6" stroke={ACCENT} strokeWidth="2" />
    </Svg>
  )
}

/** Главная — дом, у которого дверь-капля. */
export function NavHomeIcon({ active, ...rest }: NavIconProps) {
  return (
    <Svg active={active} {...rest}>
      <path d="M3.4 11.3 12 4l8.6 7.3V19a1.6 1.6 0 0 1-1.6 1.6H5A1.6 1.6 0 0 1 3.4 19z" {...fillOf(active)} />
      <path className="nav-accent" d="M12 12.4c1.8 2.1 2.8 3.4 2.8 4.6a2.8 2.8 0 0 1-5.6 0c0-1.2 1-2.5 2.8-4.6z" fill={ACCENT} stroke="none" />
    </Svg>
  )
}

/** Рейтинг — кубок со звездой. */
export function NavTrophyIcon({ active, ...rest }: NavIconProps) {
  return (
    <Svg active={active} {...rest}>
      <path d="M7 3.8h10v5.2a5 5 0 0 1-10 0z" {...fillOf(active)} />
      <path d="M7 5.6H4.4v1.6A3.2 3.2 0 0 0 7.6 10.4M17 5.6h2.6v1.6a3.2 3.2 0 0 1-3.2 3.2" />
      <path d="M12 14v3.6M8.6 20.2h6.8M9.6 17.6h4.8" />
      <path className="nav-accent" d="m12 6 .9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 8.1l2-.3z" fill={ACCENT} stroke="none" />
    </Svg>
  )
}

/** Заработок — монета со звездой и искрой. */
export function NavEarnIcon({ active, ...rest }: NavIconProps) {
  return (
    <Svg active={active} {...rest}>
      <circle cx="12" cy="12.4" r="8" {...fillOf(active)} />
      <circle cx="12" cy="12.4" r="5.2" strokeOpacity="0.55" />
      <path className="nav-accent" d="m12 8.9 1.05 2.15 2.35.35-1.7 1.65.4 2.35L12 14.3l-2.1 1.1.4-2.35-1.7-1.65 2.35-.35z" fill={ACCENT} stroke="none" />
      <path d="M19.4 2.8v3M17.9 4.3h3" strokeWidth="1.5" />
    </Svg>
  )
}
