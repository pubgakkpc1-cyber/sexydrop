import { Link } from 'react-router-dom'
import {
  FlameIcon,
  GamepadIcon,
  RocketArtIcon,
  RocketIcon,
  SparkleIcon,
  SwordsIcon,
  ZapIcon,
} from '../shell/icons'
import { FEATURES } from '../../lib/features'
import styles from './Banners.module.css'

const CRASH_MULTIPLIERS: ReadonlyArray<{ text: string; top?: string; right?: string; bottom?: string; rotate: string }> = [
  { text: 'x2.47', top: '10px', right: '46px', rotate: '-7deg' },
  { text: 'x1.40', top: '40px', right: '10px', rotate: '4deg' },
  { text: 'x1.00', bottom: '14px', right: '104px', rotate: '-3deg' },
  { text: 'x1.00', bottom: '8px', right: '40px', rotate: '6deg' },
]

const CRASH_SPARKLES: ReadonlyArray<{ top: string; left: string; size: string; opacity: string }> = [
  { top: '14%', left: '38%', size: '10px', opacity: '0.9' },
  { top: '58%', left: '52%', size: '8px', opacity: '0.75' },
  { top: '22%', left: '70%', size: '12px', opacity: '0.95' },
  { top: '70%', left: '80%', size: '9px', opacity: '0.7' },
  { top: '40%', left: '26%', size: '7px', opacity: '0.55' },
]

/**
 * Три главных баннера (7.2) в стиле референса Epic Gift: у каждого — бейдж
 * слева сверху, название с иконкой слева снизу и арт справа. Мини-карточки
 * PVP и плитки PLAY HUB — декоративные (aria-hidden), данные не изображают.
 */
export function Banners() {
  return (
    <section className={styles.section} aria-label="Баннеры">
      <Link to="/games/crash" className={`${styles.banner} ${styles.crash}`} aria-label="Ракетка — краш-игра">
        <span className={styles.badge}>
          <FlameIcon style={{ width: '12px', height: '12px', display: 'inline', verticalAlign: '-1px', marginRight: '3px' }} />
          <span>ХИТ</span>
        </span>
        {CRASH_SPARKLES.map((sparkle) => (
          <span
            key={`${sparkle.top}-${sparkle.left}`}
            className={styles.sparkle}
            style={{ top: sparkle.top, left: sparkle.left, width: sparkle.size, height: sparkle.size, opacity: sparkle.opacity, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            aria-hidden
          >
            <SparkleIcon style={{ width: '100%', height: '100%' }} />
          </span>
        ))}
        {CRASH_MULTIPLIERS.map((m) => (
          <span
            key={m.text + m.rotate}
            className={styles.multiplier}
            style={{ top: m.top, right: m.right, bottom: m.bottom, rotate: m.rotate }}
            aria-hidden
          >
            {m.text}
          </span>
        ))}
        <span className={styles.titleRow}>
          <RocketIcon className={styles.titleIcon} aria-hidden />
          <span className={styles.bannerTitle}>РАКЕТКА</span>
        </span>
        <RocketArtIcon className={styles.crashRocket} />
      </Link>

      {FEATURES.pvp && (
      <Link to="/pvp" className={`${styles.banner} ${styles.pvp}`} aria-label="PVP Hub — дуэли и джекпот">
        <span className={styles.badge}>
          <ZapIcon style={{ width: '12px', height: '12px', display: 'inline', verticalAlign: '-1px', marginRight: '3px' }} />
          <span>NEW</span>
        </span>
        <span className={styles.titleRow}>
          <SwordsIcon className={styles.titleIcon} aria-hidden />
          <span className={styles.bannerTitle}>PVP HUB</span>
        </span>
        <span className={styles.pvpArt} aria-hidden>
          <span className={styles.pvpCardSolo}>
            <span className={styles.pvpAvatar} />
            <span className={styles.pvpTagDark}>SOLO</span>
          </span>
          <span className={styles.pvpVs}>VS</span>
          <span className={styles.pvpCardTeam}>
            <span className={styles.pvpTagLight}>TEAM</span>
          </span>
        </span>
      </Link>
      )}

      <Link to="/games" className={`${styles.banner} ${styles.play}`} aria-label="Play Hub — мини-игры">
        <span className={styles.titleRow}>
          <GamepadIcon className={styles.titleIcon} aria-hidden />
          <span className={styles.bannerTitle}>PLAY HUB</span>
        </span>
        <span className={styles.playArt} aria-hidden>
          <span className={styles.playTileUpgrade}>
            <span className={styles.upgradeRing} />
            <span className={styles.upgradePct}>24%</span>
          </span>
          {FEATURES.plinko && (
          <span className={styles.playTilePlinko}>
            <i /><i /><i />
            <i /><i /><i />
          </span>
          )}
          <span className={styles.playTileMines}>
            <span className={styles.mineCube} />
            <span className={styles.mineCube} />
          </span>
        </span>
      </Link>
    </section>
  )
}
