import { Link } from 'react-router-dom'
import {
  FlameIcon,
  GamepadIcon,
  RocketIcon,
  SwordsIcon,
  ZapIcon,
} from '../shell/icons'
import { FEATURES } from '../../lib/features'
import { CrashLoop } from './CrashLoop'
import { PlayLoop } from './PlayLoop'
import styles from './Banners.module.css'

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
        <CrashLoop />
        <span className={styles.titleRow}>
          <RocketIcon className={styles.titleIcon} aria-hidden />
          <span className={styles.bannerTitle}>РАКЕТКА</span>
        </span>
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
        <PlayLoop />
      </Link>
    </section>
  )
}
