import { useNavigate } from 'react-router-dom'
import { giftById } from '../data/catalog'
import { formatMultiplier, plinkoMaxMultiplier } from '../lib/plinkoMath'
import { GameHistory } from '../components/games/GameHistory'
import { DiceIcon, FlameIcon, RocketArtIcon, ZapIcon } from '../components/shell/icons'
import styles from './GamesScreen.module.css'

const SPINS_ART_IDS = [
  'plush-pepe',
  'heart-locket',
  'neon-dream',
  'holiday-gift',
  'magic-potion',
  'crystal-ball',
  'xmas-stocking',
  'chill-flame',
  'astral-shard',
] as const

const CRAFT_ART_IDS = ['crystal-ball', 'magic-potion', 'heart-locket'] as const

/**
 * PLAY HUB — хаб игр по кадру frame_126 референса: зелёный баннер «Улучшение»
 * (ХИТ + кольцо), плитки Ракетка/Плинко/Мины/Спины/Дайс — реальные игры,
 * красный баннер «Крафт». Ниже — общая история ставок (4.3).
 */
export function GamesScreen() {
  const navigate = useNavigate()
  const maxPlinko = plinkoMaxMultiplier(16)

  return (
    <div className={styles.screen}>
      {/* Улучшение → /games/upgrade */}
      <button
        type="button"
        className={styles.bannerUpgrade}
        onClick={() => navigate('/games/upgrade')}
        aria-label="Улучшение — выбери подарок мечты"
      >
        <span className={styles.hitChip} aria-hidden>
          <FlameIcon style={{ width: '12px', height: '12px', display: 'inline', verticalAlign: '-1px', marginRight: '3px' }} />
          <span>ХИТ</span>
        </span>
        <span className={styles.bannerInfo}>
          <span className={styles.bannerTitle}>Улучшение</span>
          <span className={styles.bannerSubtitle}>Выбери подарок мечты</span>
        </span>
        <span className={styles.bannerRing} aria-hidden>
          <svg className={styles.bannerRingSvg} viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="#ffffff"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${0.24 * 2 * Math.PI * 50} ${2 * Math.PI * 50}`}
            />
          </svg>
          <img className={styles.bannerRingArt} src={giftById.get('cyber-helmet')?.image} alt="" />
          <span className={styles.bannerRingPill}>24%</span>
        </span>
      </button>

      {/* Ракетка и Плинко — реальные игры */}
      <div className={styles.grid}>
        <button
          type="button"
          className={`${styles.tile} ${styles.tileRocket}`}
          onClick={() => navigate('/games/crash')}
          aria-label="Ракетка — забери до краша"
        >
          <span className={styles.tileArt} aria-hidden>
            <RocketArtIcon />
          </span>
          <span className={styles.bannerInfo}>
            <span className={styles.tileName}>Ракетка</span>
            <span className={styles.tileSubtitle}>Забери до краша</span>
          </span>
        </button>

        <button
          type="button"
          className={`${styles.tile} ${styles.tilePlinko}`}
          onClick={() => navigate('/games/plinko')}
          aria-label="Плинко — шарик по пирамиде"
        >
          <span className={styles.miniPiramid} aria-hidden>
            {[1, 2, 3, 4].map((count) => (
              <span key={count} className={styles.miniRow}>
                {Array.from({ length: count }, (_, i) => (
                  <span key={i} className={styles.miniDot} />
                ))}
              </span>
            ))}
            <span className={styles.miniChips}>
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className={styles.miniChip} />
              ))}
            </span>
          </span>
          <span className={styles.bannerInfo}>
            <span className={styles.tileName}>Плинко</span>
            <span className={styles.tileSubtitle}>
              Выигрывай до {formatMultiplier(maxPlinko)}
            </span>
          </span>
        </button>

        {/* Мины → /games/mines (4.8) */}
        <button
          type="button"
          className={`${styles.tile} ${styles.tileMuted}`}
          onClick={() => navigate('/games/mines')}
          aria-label="Мины — обойди мины"
        >
          <span className={styles.squaresGrid} aria-hidden>
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className={styles.square} />
            ))}
          </span>
          <span className={styles.bannerInfo}>
            <span className={styles.tileName}>Мины</span>
            <span className={styles.tileSubtitle}>Обходи мины</span>
          </span>
        </button>

        {/* Спины → /games/spins (4.9) */}
        <button
          type="button"
          className={`${styles.tile} ${styles.tileMagenta}`}
          onClick={() => navigate('/games/spins')}
          aria-label="Спины — крути колесо подарков"
        >
          <span className={styles.giftsGrid} aria-hidden>
            {SPINS_ART_IDS.map((id) => (
              <span key={id} className={styles.giftDot}>
                <img src={giftById.get(id)?.image} alt="" />
              </span>
            ))}
          </span>
          <span className={styles.bannerInfo}>
            <span className={styles.tileName}>
              Спины{' '}
              <span className={styles.newChip}>
                <ZapIcon style={{ width: '11px', height: '11px', display: 'inline', verticalAlign: '-1px', marginRight: '2px' }} />
                <span>NEW</span>
              </span>
            </span>
            <span className={styles.tileSubtitle}>Крути колесо подарков</span>
          </span>
        </button>

        {/* Дайс → /games/dice (4.7), во всю ширину */}
        <button
          type="button"
          className={`${styles.tile} ${styles.tileDice}`}
          onClick={() => navigate('/games/dice')}
          aria-label="Дайс — угадай ролл 0–9999"
        >
          <span className={styles.dieArt} aria-hidden>
            <DiceIcon style={{ width: '36px', height: '36px', color: '#38bdf8' }} />
          </span>
          <span className={styles.bannerInfo}>
            <span className={styles.tileName}>Дайс</span>
            <span className={styles.tileSubtitle}>Больше или меньше X · до x98</span>
          </span>
        </button>
      </div>

      {/* Крафт → /games/craft */}
      <button
        type="button"
        className={styles.bannerCraft}
        onClick={() => navigate('/games/craft')}
        aria-label="Крафт — собери новый подарок"
      >
        <span className={styles.craftArts} aria-hidden>
          {CRAFT_ART_IDS.map((id) => (
            <img key={id} src={giftById.get(id)?.image} alt="" />
          ))}
        </span>
        <span className={styles.bannerInfo}>
          <span className={styles.bannerTitle}>Крафт</span>
          <span className={styles.bannerSubtitle}>Собери новый подарок</span>
        </span>
      </button>

      <GameHistory />

      <p className={styles.footerNote}>
        Все мини-игры работают с честной отдачей (RTP 0.98) и мгновенными выплатами.
      </p>
    </div>
  )
}
