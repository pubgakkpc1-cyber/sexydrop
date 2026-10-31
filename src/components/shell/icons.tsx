import type { SVGProps } from 'react'

interface IconProps extends SVGProps<SVGSVGElement> {
  className?: string
}

function base(props: IconProps): SVGProps<SVGSVGElement> {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    ...props,
  }
}

/**
 * 1. Главная (Apple SF Symbols 3D Glass Home)
 * Объёмная крыша, дымоход, арочный стеклянный портал с рассеянным светом.
 */
export function HomeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      {/* Стены дома с полупрозрачной заливкой */}
      <rect x="5" y="10" width="14" height="10.5" rx="2.5" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="1.6" />
      {/* Скатная крыша */}
      <path d="M3 11 L11.1 4.2 C11.6 3.8 12.4 3.8 12.9 4.2 L21 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* Дымоход */}
      <path d="M17 7.5 V4.5 H19.5 V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Арочный стеклянный вход */}
      <path d="M9.5 20.5 V15 C9.5 13.6 10.6 12.5 12 12.5 C13.4 12.5 14.5 13.6 14.5 15 V20.5" fill="currentColor" fillOpacity="0.45" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

/**
 * 2. Инвентарь (Apple 3D Isometric Crystal Cube)
 * Изометрический многогранный стеклянный куб со скошенными гранями.
 */
export function CubeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      {/* Верхняя грань (светоотражающая) */}
      <polygon points="12,3.2 20.2,7.6 12,12 3.8,7.6" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      {/* Левая грань (затенённая) */}
      <polygon points="3.8,7.6 12,12 12,20.8 3.8,16.4" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      {/* Правая грань (средний тон) */}
      <polygon points="20.2,7.6 12,12 12,20.8 20.2,16.4" fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      {/* Внутреннее ребро жёсткости */}
      <line x1="12" y1="12" x2="12" y2="20.8" stroke="currentColor" strokeWidth="1.6" />
      {/* Точка отражения света */}
      <circle cx="12" cy="7.6" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

/**
 * 3. Пригласить (Apple SF Contacts / Two Users from reference video)
 * Два силуэта пользователей, как в референсе @epic_gift_bot.
 */
export function UserPlusIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24">
      {/* Основной пользователь */}
      <circle cx="9" cy="8.5" r="3.5" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M2.5 19 C2.8 15 5.5 13.5 9 13.5 C12.5 13.5 15.2 15 15.5 19" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* Второй пользователь сзади */}
      <path d="M14.5 5.5 C15.4 6.2 16 7.3 16 8.5 C16 9.7 15.4 10.8 14.5 11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17.5 14.5 C19.5 15.5 20.8 17 21 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/**
 * 4. Рейтинг (Apple SF 3D Trophy Cup)
 * Кубок с объёмной чашей, рельефными ручками, звездой почёта и постаментом.
 */
export function TrophyIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      {/* Чаша кубка */}
      <path d="M6.5 4 H17.5 V10.5 C17.5 14 15 16.5 12 16.5 C9 16.5 6.5 14 6.5 10.5 Z" fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      {/* Ручки */}
      <path d="M6.5 5.5 H4 C2.8 5.5 2 8 3.5 10.5 C4.5 12 6.5 12 6.5 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17.5 5.5 H20 C21.2 5.5 22 8 20.5 10.5 C19.5 12 17.5 12 17.5 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {/* Ножка и база */}
      <path d="M12 16.5 V19 M8.5 20.5 H15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* Звезда на чаше */}
      <polygon points="12,7 12.8,8.8 14.8,8.8 13.2,10 13.8,11.8 12,10.6 10.2,11.8 10.8,10 9.2,8.8 11.2,8.8" fill="currentColor" stroke="none" />
    </svg>
  )
}

/**
 * 5. Награды (Two Overlapping Coins from reference video @epic_gift_bot)
 * Две золотые монеты с рельефным ободком.
 */
export function CoinsRewardIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24">
      {/* Задняя монета */}
      <circle cx="15.5" cy="8.5" r="5.5" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.5 6 V11 M14 7.5 H17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {/* Передняя монета */}
      <circle cx="9.5" cy="14.5" r="5.8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9.5" cy="14.5" r="3.6" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9.5 12.8 V16.2 M8.2 13.8 H10.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

/**
 * 5b. Подарок (Apple 3D Frosted Gift Box)
 */
export function GiftIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      {/* Коробка */}
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.6" />
      {/* Крышка коробки */}
      <rect x="3.2" y="6.8" width="17.6" height="4.2" rx="1.5" fill="currentColor" fillOpacity="0.35" stroke="currentColor" strokeWidth="1.6" />
      {/* Вертикальная лента */}
      <rect x="10.4" y="6.8" width="3.2" height="13.7" fill="currentColor" fillOpacity="0.45" stroke="none" />
      {/* Шелковый бант */}
      <path d="M12 6.8 C10 3.8 6.5 4 7.5 6 C8.5 7.5 12 6.8 12 6.8 C12 6.8 15.5 7.5 16.5 6 C17.5 4 14 3.8 12 6.8 Z" fill="currentColor" fillOpacity="0.6" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * 6. Алмаз / Валюта GRAM (Apple 3D Cyan Diamond Crystal)
 * Многогранный бриллиант со стеклянной площадкой и радужным сиянием.
 */
export function DiamondIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      {/* Верхняя площадка */}
      <polygon points="7,4.5 17,4.5 21.2,9.8 12,20.5 2.8,9.8" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      {/* Горизонтальный пояс рундиста */}
      <line x1="2.8" y1="9.8" x2="21.2" y2="9.8" stroke="currentColor" strokeWidth="1.5" />
      {/* Треугольники короны */}
      <polygon points="7,4.5 10.5,9.8 12,4.5" fill="currentColor" fillOpacity="0.4" stroke="none" />
      <polygon points="17,4.5 13.5,9.8 12,4.5" fill="currentColor" fillOpacity="0.3" stroke="none" />
      {/* Фасеты павильона к шипу */}
      <polygon points="10.5,9.8 12,20.5 13.5,9.8" fill="currentColor" fillOpacity="0.45" stroke="none" />
      <polygon points="2.8,9.8 12,20.5 10.5,9.8" fill="currentColor" fillOpacity="0.15" stroke="none" />
      <polygon points="21.2,9.8 12,20.5 13.5,9.8" fill="currentColor" fillOpacity="0.2" stroke="none" />
    </svg>
  )
}

/**
 * 7. Кошелёк (Apple Wallet Glass Icon)
 */
export function WalletIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      {/* Корпус кошелька */}
      <rect x="3.5" y="6.5" width="17" height="12.5" rx="3" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="1.7" />
      {/* Выдвинутая карточка сверху */}
      <path d="M6.5 6.5 V5 C6.5 4.2 7.2 3.5 8 3.5 H16 C16.8 3.5 17.5 4.2 17.5 5 V6.5" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1.6" />
      {/* Клапан замка */}
      <path d="M14.5 10.5 H19.5 C20.1 10.5 20.5 11 20.5 11.5 V14 C20.5 14.5 20.1 15 19.5 15 H14.5 C13.4 15 12.5 14.1 12.5 13 C12.5 11.9 13.4 10.5 14.5 10.5 Z" fill="currentColor" fillOpacity="0.5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="15.8" cy="12.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

/**
 * 8. Ракетка (Ракетка Crash Game Icon)
 */
export function RocketIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      {/* Корпус ракеты */}
      <path d="M12 2.8 C15.5 5.5 17.5 9.5 17.5 14.5 H6.5 C6.5 9.5 8.5 5.5 12 2.8 Z" fill="currentColor" fillOpacity="0.28" stroke="currentColor" strokeWidth="1.7" />
      {/* Иллюминатор */}
      <circle cx="12" cy="9.8" r="2.4" fill="currentColor" fillOpacity="0.6" stroke="currentColor" strokeWidth="1.5" />
      {/* Крылья */}
      <path d="M6.5 12.5 L3.5 17 L7.5 16 M17.5 12.5 L20.5 17 L16.5 16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      {/* Пламя */}
      <path d="M9.5 16.5 C9.5 19 12 21.5 12 21.5 C12 21.5 14.5 19 14.5 16.5 Z" fill="currentColor" fillOpacity="0.75" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

/**
 * 9. Мечи / PVP (Apple Swords Duel Icon)
 */
export function SwordsIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 19.5 L15.5 8.5 M15.5 8.5 L19 5 L20.5 6.5 L17 10 L15.5 8.5 Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.5 19.5 L8.5 8.5 M8.5 8.5 L5 5 L3.5 6.5 L7 10 L8.5 8.5 Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 6.5 L18.5 12 M11 6.5 L5.5 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/**
 * 10. Геймпад / Игры (Apple Arcade Glass Gamepad)
 */
export function GamepadIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6.5 8 H17.5 C20.5 8 22 10.5 21.5 13.8 L20.5 17.5 C19.8 19.8 17 20.2 15.2 18.2 L13.8 16.5 H10.2 L8.8 18.2 C7 20.2 4.2 19.8 3.5 17.5 L2.5 13.8 C2 10.5 3.5 8 6.5 8 Z" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      {/* D-Pad */}
      <path d="M7.8 10.5 V14.5 M5.8 12.5 H9.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {/* Кнопки действия */}
      <circle cx="16" cy="11.2" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="17.8" cy="13.2" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.2" cy="13.2" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="15.2" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

/**
 * 11. Стрелка назад (Apple Back Chevron)
 */
export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14.5 6 L8.5 12 L14.5 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * 12. Искра / Свечение (Apple Sparkle Star)
 */
export function SparkleIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M12 2.5 C12.8 7 15 9.2 19.5 10 C15 10.8 12.8 13 12 17.5 C11.2 13 9 10.8 4.5 10 C9 9.2 11.2 7 12 2.5 Z" />
      <path d="M18.5 15 C19 17.2 20 18.2 22 18.5 C20 18.8 19 19.8 18.5 22 C18 19.8 17 18.8 15 18.5 C17 18.2 18 17.2 18.5 15 Z" opacity="0.85" />
    </svg>
  )
}

/**
 * 13. Календарь (Apple Calendar)
 */
export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.8" y="5.5" width="16.4" height="15" rx="3.5" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.8 10 H20.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 3.5 V6.5 M16 3.5 V6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="8" cy="14" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="16" cy="14" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

/**
 * 14. Часы / Таймер (Apple Clock)
 */
export function ClockIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.5" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.5 V12 L15.5 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * 15. Обновление (Apple Refresh Arrow)
 */
export function RefreshIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.5 12 A7.5 7.5 0 0 1 17.8 7 L20 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="20 4.5 20 9 15.5 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.5 12 A7.5 7.5 0 0 1 6.2 17 L4 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="4 19.5 4 15 8.5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * 16. Поиск (Apple Search Glass)
 */
export function SearchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="6.8" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16 L20.5 20.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  )
}

/**
 * 17. Кубик / Дайс (Apple Dice)
 */
export function DiceIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor" fillOpacity="0.22" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="8.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  )
}

/**
 * 18. Декоративный 3D арт-ракета для баннера «РАКЕТКА» (Apple Liquid Glass Rocket)
 */
export function RocketArtIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 32 32" fill="none" stroke="none">
      <defs>
        <linearGradient id="art-rocket-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="35%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="art-rocket-wings" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
        <linearGradient id="art-rocket-flame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>
      {/* Пламя */}
      <path d="M12 23 C12 28 16 31 16 31 C16 31 20 28 20 23 Z" fill="url(#art-rocket-flame)" />
      <path d="M14 23 C14 26 16 28 16 28 C16 28 18 26 18 23 Z" fill="#ffffff" />
      {/* Боковые крылья */}
      <path d="M8 17 L3 23 L9 22 Z" fill="url(#art-rocket-wings)" />
      <path d="M24 17 L29 23 L23 22 Z" fill="url(#art-rocket-wings)" />
      {/* Корпус ракеты */}
      <path d="M16 2 C21 6 23.5 12 23.5 19 H8.5 C8.5 12 11 6 16 2 Z" fill="url(#art-rocket-body)" />
      {/* Носовой конус */}
      <path d="M16 2 C18 4.5 19.5 8 20 11 H12 C12.5 8 14 4.5 16 2 Z" fill="#f43f5e" />
      {/* Стеклянный иллюминатор с бликом */}
      <circle cx="16" cy="13" r="3.5" fill="#0284c7" stroke="#ffffff" strokeWidth="1.2" />
      <circle cx="16" cy="13" r="2.2" fill="#7dd3fc" />
      <circle cx="15.2" cy="12.2" r="0.8" fill="#ffffff" />
    </svg>
  )
}

/**
 * 19. Значок валюты TON: синий камень с белой искрой (контур векторизован с присланной картинки).
 * Цвет фиксирован (не зависит от currentColor), поэтому одинаково выглядит везде.
 */
export function TonIcon(props: IconProps) {
  const { style, ...rest } = props
  return (
    <svg {...base(rest)} viewBox="0 0 317 269" fill="none" stroke="none" style={style}>
      <path d="M46.3 26.3Q62.5 1.0 92.5 1.0L219.3 1.0Q249.3 1.0 265.2 26.4L308.6 95.5Q317.1 109.1 305.7 120.3L164.9 259.2Q154.9 269.0 145.1 259.0L6.0 118.1Q-5.2 106.7 3.4 93.2Z" fill="#2ea2f4" />
      <path d="M194.0 41.5Q199.4 90.1 248.0 95.5Q199.4 100.9 194.0 149.5Q188.6 100.9 140.0 95.5Q188.6 90.1 194.0 41.5Z" fill="#ffffff" stroke="#ffffff" strokeWidth="6" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * 20. Огонь / Пламя (Apple Flame Icon)
 */
export function FlameIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2.5 C12 2.5 15.5 6 15.5 10 C15.5 10.8 15.3 11.5 15 12.1 C16.2 11.2 17 9.8 17 8 C18.5 9.8 19.5 12.2 19.5 14.8 C19.5 18.8 16.1 22 12 22 C7.9 22 4.5 18.8 4.5 14.8 C4.5 11.2 6.5 8 9.5 5.5 C9.8 8.5 11 10.5 12.5 11.5 C12 9.5 11.8 7 12 2.5 Z"
        fill="currentColor"
        fillOpacity="0.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 14 C10.5 14 9.5 15.2 9.5 16.8 C9.5 18.5 10.6 20 12 20 C13.4 20 14.5 18.5 14.5 16.8 C14.5 15.2 13.5 14 12 14 Z"
        fill="currentColor"
        fillOpacity="0.6"
      />
    </svg>
  )
}

/**
 * 21. Звезда (Apple Star Icon)
 */
export function StarIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="none">
      <polygon
        points="12,2.5 14.9,8.4 21.4,9.3 16.7,13.9 17.8,20.4 12,17.3 6.2,20.4 7.3,13.9 2.6,9.3 9.1,8.4"
        fill="currentColor"
        fillOpacity="0.3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * 22. Корона / VIP (Apple Crown Icon)
 */
export function CrownIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="none">
      <path
        d="M3.5 18.5 H20.5 L19 9.5 L14.5 13.5 L12 5.5 L9.5 13.5 L5 9.5 Z"
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="4" r="1.5" fill="currentColor" />
      <circle cx="4.5" cy="8.5" r="1.3" fill="currentColor" />
      <circle cx="19.5" cy="8.5" r="1.3" fill="currentColor" />
      <line x1="4.5" y1="20.5" x2="19.5" y2="20.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/**
 * 23. Молния / Буст (Apple Lightning Icon)
 */
export function ZapIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="none">
      <polygon
        points="13,2.5 4.5,13.5 11.5,13.5 10.5,21.5 19.5,10.5 12.5,10.5"
        fill="currentColor"
        fillOpacity="0.35"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * 24. Звук (Volume Icon)
 */
export function VolumeIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="none">
      <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M15.5 8.5 C16.8 9.8 17.5 11 17.5 12 C17.5 13 16.8 14.2 15.5 15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18.5 5.5 C20.8 7.8 22 9.8 22 12 C22 14.2 20.8 16.2 18.5 18.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/**
 * 25. Без звука (Volume Mute Icon)
 */
export function VolumeMuteIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="none">
      <polygon points="11,5 6,9 2,9 2,15 6,15 11,19" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <line x1="21.5" y1="9" x2="16.5" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="16.5" y1="9" x2="21.5" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/**
 * 26. Слоты / Спины (Slot Machine Icon)
 */
export function SlotIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="3" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="5.5" y="7" width="13" height="7" rx="1.5" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.5" />
      <line x1="9.8" y1="7" x2="9.8" y2="14" stroke="currentColor" strokeWidth="1.5" />
      <line x1="14.2" y1="7" x2="14.2" y2="14" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7.6" cy="10.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="10.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="16.4" cy="10.5" r="1.3" fill="currentColor" stroke="none" />
      <line x1="6" y1="17" x2="18" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/**
 * 27. Бомба / Мины (Bomb Icon)
 */
export function BombIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="13" r="7.5" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 8 L18.5 5.5 M19 3 L20.5 4.5 M20 2 L22 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="13.5" y="6.5" width="3" height="2" transform="rotate(-45 15 7.5)" fill="currentColor" stroke="none" />
      <circle cx="9" cy="11" r="1.5" fill="#ffffff" stroke="none" opacity="0.6" />
    </svg>
  )
}

/**
 * Фирменная бомба SEXY DROP: тёмная «капля» с красным кантом, глянцем, фитилём и искрой.
 * Цвет кант/искры берётся из currentColor, поэтому подходит к палитре темы.
 */
export function DropBombIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 48 48" fill="none">
      <defs>
        <radialGradient id="dropbomb-body" cx="38%" cy="32%" r="80%">
          <stop offset="0%" stopColor="#6a6065" />
          <stop offset="55%" stopColor="#2a2527" />
          <stop offset="100%" stopColor="#141012" />
        </radialGradient>
      </defs>
      <path
        d="M24 14c6.6 6.4 11.4 12.1 11.4 18.2a11.4 11.4 0 0 1-22.8 0C12.6 26.1 17.4 20.4 24 14z"
        fill="url(#dropbomb-body)"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M17.5 28.5c.4-3 2.2-5.2 4.2-7" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M24 14c0-3.6 1.6-5.4 4.6-6.4" stroke="#d9b36a" strokeWidth="2.2" strokeLinecap="round" />
      <g className="dropbomb-spark">
        <path d="M30.6 3.2l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z" fill="#ffd25a" />
      </g>
      <path d="M24 38.6v-3.2M20.4 36.2l1.2 1.2M27.6 36.2l-1.2 1.2" stroke="currentColor" strokeOpacity="0.8" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/**
 * 28. Мишень / Плинко (Target Icon)
 */
export function TargetIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  )
}

/**
 * 29. Гаечный ключ / Крафт (Wrench Icon)
 */
export function WrenchIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="none">
      <path
        d="M14.7 6.3 A5.5 5.5 0 0 0 7.5 13.5 L3.5 17.5 C2.8 18.2 2.8 19.3 3.5 20 C4.2 20.7 5.3 20.7 6 20 L10 16 A5.5 5.5 0 0 0 17.2 8.8 L15 11 L13 9 Z"
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * 31. Галочка (Check Icon)
 */
export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="none">
      <polyline points="4,12.5 9,17.5 20,6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * 32. Кристалл льда (Ice Icon)
 */
export function IceIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="none">
      <path d="M12 2 V22 M2 12 H22 M4.9 4.9 L19.1 19.1 M19.1 4.9 L4.9 19.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <polygon points="12,7 14,10 10,10" fill="currentColor" stroke="none" />
      <polygon points="12,17 14,14 10,14" fill="currentColor" stroke="none" />
      <polygon points="7,12 10,14 10,10" fill="currentColor" stroke="none" />
      <polygon points="17,12 14,14 14,10" fill="currentColor" stroke="none" />
    </svg>
  )
}

/**
 * 33. Замок (Lock Icon)
 */
export function LockIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="none">
      <rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11V7C8 4.79 9.79 3 12 3C14.21 3 16 4.79 16 7V11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" />
    </svg>
  )
}

/**
 * 34. Открытый замок (Lock Open Icon)
 */
export function LockOpenIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="none">
      <rect x="5" y="11" width="14" height="10" rx="2.5" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11V7C8 4.79 9.79 3 12 3C14.21 3 16 4.79 16 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" />
    </svg>
  )
}

/**
 * 35. Группа пользователей / Друзья (Users Icon)
 */
export function UsersIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="none">
      <path d="M16 21V19C16 17.9 15.1 17 14 17H7C5.9 17 5 17.9 5 19V21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10.5" cy="9.5" r="3.5" stroke="currentColor" strokeWidth="1.8" fill="currentColor" fillOpacity="0.2" />
      <path d="M19 19V17C18.9 16.2 18.4 15.5 17.7 15.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15 6.2C15.8 6.5 16.3 7.3 16.3 8.2C16.3 9.1 15.8 9.9 15 10.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}


/** Поделиться (три точки, соединённые линиями) */
export function ShareIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="none">
      <circle cx="6" cy="12" r="2.6" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.5" cy="6" r="2.6" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.5" cy="18" r="2.6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.3 10.8 15.2 7.2M8.3 13.2l6.9 3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/** Копировать (два листа) */
export function CopyIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="none">
      <rect x="9" y="9" width="11" height="11" rx="2.6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 9V6.6A2.6 2.6 0 0 0 12.4 4H6.6A2.6 2.6 0 0 0 4 6.6v5.8A2.6 2.6 0 0 0 6.6 15H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/** Вопрос в круге */
export function HelpIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2.9-1.2 1.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.6" r="1" fill="currentColor" />
    </svg>
  )
}

/** Робот (Крипто Бот) */
export function BotIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="none">
      <rect x="4" y="8" width="16" height="11" rx="3.4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8V5M10.2 4h3.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="13.2" r="1.3" fill="currentColor" />
      <circle cx="15" cy="13.2" r="1.3" fill="currentColor" />
      <path d="M9.4 16.6h5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

/** Обмен: две встречные стрелки */
export function ConvertIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="none">
      <path d="M5 8h13M14.5 4.5 18 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 16H6M9.5 12.5 6 16l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Стрелка вниз-вверх для раскрывающихся блоков */
export function ChevronUpIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 24 24" fill="none">
      <path d="m6 15 6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
