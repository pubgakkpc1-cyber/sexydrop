import styles from './PlayLoop.module.css'

/** Реальные NFT из каталога — лента крутится, как рулетка кейса. */
const STRIP = [
  '/gifts/plush_pepe_1.png',
  '/gifts/heart_locket_1.png',
  '/gifts/mini_oscar_1.png',
  '/gifts/ion_gem_1.png',
  '/gifts/astral_shard_1.png',
  '/gifts/snoop_dogg_1.png',
] as const

/**
 * Сцена баннера Play Hub: бесконечная лента NFT-подарков едет под красным маркером,
 * как рулетка в кейсе; карточка под маркером «вспыхивает». Только transform/opacity.
 */
export function PlayLoop() {
  const cards = [...STRIP, ...STRIP]
  return (
    <div className={styles.wrap} aria-hidden>
      <div className={styles.beams} />
      <div className={styles.viewport}>
        <div className={styles.strip}>
          {cards.map((src, i) => (
            <img key={`${src}-${i}`} src={src} alt="" className={styles.card} />
          ))}
        </div>
        <span className={styles.markerTop} />
        <span className={styles.markerBottom} />
        <span className={styles.markerLine} />
        <span className={styles.flash} />
      </div>
    </div>
  )
}
