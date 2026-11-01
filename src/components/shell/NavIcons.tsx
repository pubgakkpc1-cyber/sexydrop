import type { ReactNode, SVGProps } from 'react'

/**
 * Иконки нижнего меню SEXY DROP: тонкие контурные глифы (stroke = currentColor).
 * У активной вкладки контур «прорисовывается» заново (.nav-draw), а детали `.nav-fill`
 * заливаются цветом — стили в BottomNav.module.css.
 */
export interface NavIconProps extends Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'fill'> {
  active?: boolean
}

function Svg({ active, children, ...rest }: NavIconProps & { children: ReactNode }) {
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

/** Инвентарь — подарочная коробка с лентой и бантом. */
export function NavInventoryIcon({ active, ...rest }: NavIconProps) {
  return (
    <Svg active={active} {...rest}>
      <rect className="nav-draw nav-fill" pathLength={1} x="3.5" y="10" width="17" height="10.5" rx="2.4" />
      <rect className="nav-draw" pathLength={1} x="2.5" y="6.8" width="19" height="3.2" rx="1.4" />
      <path className="nav-draw" pathLength={1} d="M12 6.8v13.7" />
      <path
        className="nav-draw"
        pathLength={1}
        d="M12 6.8C10.2 3 6.6 3.2 7.3 5.3c.5 1.5 3 1.5 4.7 1.5zM12 6.8c1.8-3.8 5.4-3.6 4.7-1.5-.5 1.5-3 1.5-4.7 1.5z"
      />
    </Svg>
  )
}

/** Пригласить — человек со значком «+». */
export function NavInviteIcon({ active, ...rest }: NavIconProps) {
  return (
    <Svg active={active} {...rest}>
      <circle className="nav-draw nav-fill" pathLength={1} cx="9.5" cy="8" r="3.8" />
      <path className="nav-draw" pathLength={1} d="M2.8 20c.4-3.6 3.2-5.8 6.7-5.8 1.2 0 2.3.3 3.2.7" />
      <path className="nav-draw" pathLength={1} d="M18 13.4v5.6M15.2 16.2h5.6" />
    </Svg>
  )
}

/** Главная — дом с дверью. */
export function NavHomeIcon({ active, ...rest }: NavIconProps) {
  return (
    <Svg active={active} {...rest}>
      <path
        className="nav-draw nav-fill"
        pathLength={1}
        d="M3.5 10.6 12 3.4l8.5 7.2V19a1.9 1.9 0 0 1-1.9 1.9H5.4A1.9 1.9 0 0 1 3.5 19z"
      />
      <path className="nav-draw" pathLength={1} d="M9.6 20.9v-5.4a2.4 2.4 0 0 1 4.8 0v5.4" />
    </Svg>
  )
}

/** Рейтинг — кубок. */
export function NavTrophyIcon({ active, ...rest }: NavIconProps) {
  return (
    <Svg active={active} {...rest}>
      <path className="nav-draw nav-fill" pathLength={1} d="M7 3.5h10v5.6a5 5 0 0 1-10 0z" />
      <path
        className="nav-draw"
        pathLength={1}
        d="M7 5.5H4.2v1.4a3.4 3.4 0 0 0 3.2 3.4M17 5.5h2.8v1.4a3.4 3.4 0 0 1-3.2 3.4"
      />
      <path className="nav-draw" pathLength={1} d="M12 14.1v3.4M8.2 20.5h7.6M9.2 17.5h5.6v3H9.2z" />
    </Svg>
  )
}

/** Заработок — монета с молнией-искрой. */
export function NavEarnIcon({ active, ...rest }: NavIconProps) {
  return (
    <Svg active={active} {...rest}>
      <circle className="nav-draw nav-fill" pathLength={1} cx="12" cy="12" r="8.8" />
      <path className="nav-draw" pathLength={1} d="m12.9 6.8-3.6 5.4h3.4l-1.6 5 4.2-6.1h-3.4z" />
    </Svg>
  )
}
