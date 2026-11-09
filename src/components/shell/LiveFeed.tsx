import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiGet } from '../../lib/api'
import { giftById, paidCases } from '../../data/catalog'
import { formatMinor } from '../../lib/money'
import { cx } from '../../lib/cx'
import styles from './LiveFeed.module.css'

interface ApiDrop {
  id: string
  gift_id: string
  case_id: string
  ts: number
}

/**
 * Лента «Live» под шапкой: НАСТОЯЩИЕ последние дропы NFT из платных кейсов (с сервера, у всех одинаковые).
 * Если дропов ещё не было — показываем пустую ленту, ничего не выдумываем. Новый дроп выезжает слева.
 */
export function LiveFeed() {
  const [drops, setDrops] = useState<ApiDrop[]>([])
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)

  useEffect(() => {
    let dead = false
    const load = () =>
      apiGet<{ drops: ApiDrop[] }>('/api/live')
        .then((r) => {
          if (dead) return
          if (seen.current && r.drops[0] && !seen.current.has(r.drops[0].id)) setFresh(r.drops[0].id)
          seen.current = new Set(r.drops.map((d) => d.id))
          setDrops(r.drops)
        })
        .catch(() => undefined)
    void load()
    const timer = window.setInterval(load, 5000)
    return () => {
      dead = true
      window.clearInterval(timer)
    }
  }, [])

  const items = drops
    .map((d) => ({ d, gift: giftById.get(d.gift_id), gameCase: paidCases.find((c) => c.id === d.case_id) }))
    .filter((x) => x.gift && /-\d$/.test(x.gift.id)) // только NFT (обычные подарки в ленте не показываем)

  return (
    <section className={styles.bar} aria-label="Live: последние дропы">
      <span className={styles.label}>
        <span className={styles.dot} aria-hidden />
        <span className={styles.labelText}>Live</span>
      </span>
      <div className={styles.track}>
        <Link to="/games/clicker" className={styles.promo} aria-label="Новая игра: Кликалка. Тапай и борись за NFT и TON">
          <span className={styles.promoRun}>
            <span>НОВОЕ · КЛИКАЛКА · тапай, копи клики, топ 30 дней · NFT и TON за места · </span>
            <span aria-hidden>НОВОЕ · КЛИКАЛКА · тапай, копи клики, топ 30 дней · NFT и TON за места · </span>
          </span>
        </Link>
        <Link to="/rewards" className={`${styles.promo} ${styles.promoTag}`} aria-label="Поставь @sexydropbot в ник и получай 10 звёзд каждый день">
          <span className={styles.promoRun} style={{ animationDuration: '16s' }}>
            <span>★ ПОСТАВЬ @sexydropbot В НИК — 10 ЗВЁЗД КАЖДЫЙ ДЕНЬ · </span>
            <span aria-hidden>★ ПОСТАВЬ @sexydropbot В НИК — 10 ЗВЁЗД КАЖДЫЙ ДЕНЬ · </span>
          </span>
        </Link>
        {items.map(({ d, gift, gameCase }) => (
          <div
            key={d.id}
            role="img"
            className={cx(styles.item, d.id === fresh && styles.fresh)}
            aria-label={`${gift!.name}${gameCase ? ` из кейса ${gameCase.name}` : ''} — ${formatMinor(gift!.priceMinor)} TON`}
          >
            <img
              src={gift!.image}
              alt=""
              className={styles.imgFull}
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </section>
  )
}
