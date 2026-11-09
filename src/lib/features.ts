/**
 * Временные переключатели разделов. `false` — раздел скрыт с главной и из Play Hub,
 * а прямой переход по его адресу ведёт на главную (см. маршруты в App.tsx). Код и тесты разделов остаются,
 * чтобы вернуть раздел достаточно поменять одно значение.
 */
export const FEATURES = {
  pvp: false,
  dice: false,
  craft: false,
  spins: false,
  plinko: false,
} as const

/** Кейс FREE с NFT (за приглашения) временно на переработке: открыть нельзя. `false` — вернуть в работу. */
export const FREE_NFT_CASE_MAINTENANCE = true
