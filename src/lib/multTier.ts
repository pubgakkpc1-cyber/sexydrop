/**
 * Цвет множителя по «качеству» иксa — чтобы с первого взгляда было видно хороший и плохой.
 * Не красный (красный в палитре — акцент интерфейса): серый → жёлтый → зелёный → голубой → фиолетовый.
 */
export type MultTier = 'bad' | 'amber' | 'green' | 'cyan' | 'violet'

export function multTier(value: number): MultTier {
  if (value >= 10) return 'violet'
  if (value >= 5) return 'cyan'
  if (value >= 2) return 'green'
  if (value >= 1.2) return 'amber'
  return 'bad'
}

export const MULT_TIER_STYLE: Readonly<Record<MultTier, { color: string; glow: string }>> = {
  bad: { color: '#a3a7b0', glow: '0 0 14px rgba(163, 167, 176, 0.35), 0 2px 10px rgba(0, 0, 0, 0.8)' },
  amber: { color: '#f0b43c', glow: '0 0 18px rgba(240, 180, 60, 0.55), 0 2px 10px rgba(0, 0, 0, 0.8)' },
  green: { color: '#4fd18b', glow: '0 0 20px rgba(79, 209, 139, 0.6), 0 2px 10px rgba(0, 0, 0, 0.8)' },
  cyan: { color: '#47c6e8', glow: '0 0 22px rgba(71, 198, 232, 0.65), 0 2px 10px rgba(0, 0, 0, 0.8)' },
  violet: { color: '#b27dff', glow: '0 0 24px rgba(178, 125, 255, 0.7), 0 2px 10px rgba(0, 0, 0, 0.8)' },
}
