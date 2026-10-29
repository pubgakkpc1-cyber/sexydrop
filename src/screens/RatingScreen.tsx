import { useProfileStore } from '../store/profile'
import { formatMinor } from '../lib/money'
import { giftById } from '../data/catalog'
import { CrownIcon, TonIcon } from '../components/shell/icons'
import { cx } from '../lib/cx'
import styles from './RatingScreen.module.css'

interface LeaderboardBot {
  id: string
  name: string
  avatar: string
  rounds: number
  wageredGram: number
  profitGram: number
  topGiftId?: string
}

const TOP_BOTS: LeaderboardBot[] = [
  {
    id: 'b1',
    name: 'kamronbek',
    avatar: '/avatars/user_9.png',
    rounds: 142,
    wageredGram: 840,
    profitGram: 384.2,
    topGiftId: 'astral-crown',
  },
  {
    id: 'b2',
    name: 'V5B',
    avatar: '/avatars/user_2.png',
    rounds: 98,
    wageredGram: 620,
    profitGram: 241.5,
    topGiftId: 'diamond-ring',
  },
  {
    id: 'b3',
    name: 'Saullmurder',
    avatar: '/avatars/user_3.png',
    rounds: 74,
    wageredGram: 490,
    profitGram: 189.7,
    topGiftId: 'plush-pepe',
  },
  {
    id: 'b4',
    name: 'abdoo',
    avatar: '/avatars/user_10.png',
    rounds: 61,
    wageredGram: 410,
    profitGram: 142.3,
    topGiftId: 'cyber-helmet',
  },
  {
    id: 'b5',
    name: 'DIYORBEK',
    avatar: '/avatars/user_11.png',
    rounds: 53,
    wageredGram: 350,
    profitGram: 118.0,
    topGiftId: 'heart-locket',
  },
  {
    id: 'b6',
    name: 'Module_II',
    avatar: '/avatars/user_4.png',
    rounds: 47,
    wageredGram: 290,
    profitGram: 94.6,
    topGiftId: 'magic-potion',
  },
  {
    id: 'b7',
    name: 'cryptowhale',
    avatar: '/avatars/user_1.png',
    rounds: 39,
    wageredGram: 240,
    profitGram: 72.4,
    topGiftId: 'scared-cat',
  },
  {
    id: 'b8',
    name: 'Al_Sheikh',
    avatar: '/avatars/user_5.png',
    rounds: 33,
    wageredGram: 210,
    profitGram: 58.1,
    topGiftId: 'chill-flame',
  },
  {
    id: 'b9',
    name: 'Pavel_D',
    avatar: '/avatars/user_6.png',
    rounds: 28,
    wageredGram: 180,
    profitGram: 45.0,
    topGiftId: 'instant-ramen',
  },
  {
    id: 'b10',
    name: 'Artem_TON',
    avatar: '/avatars/user_8.png',
    rounds: 22,
    wageredGram: 140,
    profitGram: 32.8,
    topGiftId: 'fresh-socks',
  },
]

export function RatingScreen() {
  const { rounds, wageredMinor, netMinor, pvpMatches } = useProfileStore()
  const noData = rounds === 0

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <h1 className={styles.title}>Рейтинг</h1>
        <p className={styles.lead}>Лучшие игроки недели</p>
      </div>

      {/* Подиум топ-3 игроков в стиле Apple Liquid Glass */}
      <div className={styles.podium}>
        {/* 2 место */}
        {TOP_BOTS[1] && (
          <div className={cx(styles.podiumCard, styles.podiumSecond)}>
            <div className={styles.podiumRank}>2 место</div>
            <img
              src={TOP_BOTS[1].avatar}
              alt={TOP_BOTS[1].name}
              className={styles.podiumAvatar}
            />
            <strong className={styles.podiumName}>{TOP_BOTS[1].name}</strong>
            <span className={styles.podiumProfit}>
              <TonIcon style={{ width: '12px', height: '12px', display: 'inline', verticalAlign: '-1px', marginRight: '3px' }} />
              +{TOP_BOTS[1].profitGram} TON
            </span>
          </div>
        )}

        {/* 1 место (возвышенное с короной) */}
        {TOP_BOTS[0] && (
          <div className={cx(styles.podiumCard, styles.podiumFirst)}>
            <CrownIcon className={styles.crown} style={{ width: '22px', height: '22px', color: '#f59e0b' }} />
            <div className={styles.podiumRank}>1 место</div>
            <img
              src={TOP_BOTS[0].avatar}
              alt={TOP_BOTS[0].name}
              className={cx(styles.podiumAvatar, styles.podiumAvatarFirst)}
            />
            <strong className={styles.podiumName}>{TOP_BOTS[0].name}</strong>
            <span className={styles.podiumProfitFirst}>
              <TonIcon style={{ width: '13px', height: '13px', display: 'inline', verticalAlign: '-1px', marginRight: '3px' }} />
              +{TOP_BOTS[0].profitGram} TON
            </span>
          </div>
        )}

        {/* 3 место */}
        {TOP_BOTS[2] && (
          <div className={cx(styles.podiumCard, styles.podiumThird)}>
            <div className={styles.podiumRank}>3 место</div>
            <img
              src={TOP_BOTS[2].avatar}
              alt={TOP_BOTS[2].name}
              className={styles.podiumAvatar}
            />
            <strong className={styles.podiumName}>{TOP_BOTS[2].name}</strong>
            <span className={styles.podiumProfit}>
              <TonIcon style={{ width: '12px', height: '12px', display: 'inline', verticalAlign: '-1px', marginRight: '3px' }} />
              +{TOP_BOTS[2].profitGram} TON
            </span>
          </div>
        )}
      </div>

      {/* Статус пользователя: если ещё не играл — блок подсказки */}
      {noData && (
        <div className={styles.empty}>
          <strong>Данных пока нет</strong>
          <span>
            Сыграйте раунд в PLAY — таблица покажет вашу реальную статистику.
          </span>
        </div>
      )}

      {/* Таблица рейтинга игроков */}
      <div className={styles.tableCard}>
        <table className={styles.table} aria-label="Рейтинг игроков">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Игрок</th>
              <th scope="col">Раунды</th>
              <th scope="col">Оборот</th>
              <th scope="col">Профит</th>
            </tr>
          </thead>
          <tbody>
            {/* Строка текущего пользователя (только когда есть реальные раунды) */}
            {!noData && (
              <tr className={styles.userRow}>
                <td>
                  <span className={styles.rankPill}>1</span>
                </td>
                <td>
                  <div className={styles.playerCell}>
                    <span className={styles.playerName}>Вы</span>
                    <span className={styles.realTag}>реальные данные</span>
                  </div>
                </td>
                <td className={styles.num}>{rounds}</td>
                <td className={styles.num}>
                  <TonIcon style={{ width: '11px', height: '11px', display: 'inline', verticalAlign: '-1px', marginRight: '2px' }} />
                  <span>{formatMinor(wageredMinor)} TON</span>
                </td>
                <td className={styles.num}>
                  <span className={netMinor >= 0 ? styles.netWon : styles.netLost}>
                    <TonIcon style={{ width: '11px', height: '11px', display: 'inline', verticalAlign: '-1px', marginRight: '2px' }} />
                    <span>{`${netMinor >= 0 ? '+' : '−'}${formatMinor(Math.abs(netMinor))} TON`}</span>
                  </span>
                </td>
              </tr>
            )}

            {/* Рейтинг ботов, стилизованных под реальных пользователей Telegram */}
            {TOP_BOTS.map((bot, idx) => {
              const rank = !noData ? idx + 2 : idx + 1
              const gift = bot.topGiftId ? giftById.get(bot.topGiftId) : undefined

              return (
                <tr key={bot.id} className={styles.botRow}>
                  <td>
                    <span
                      className={cx(
                        styles.rankPill,
                        rank === 1 && styles.rankFirst,
                        rank === 2 && styles.rankSecond,
                        rank === 3 && styles.rankThird,
                      )}
                    >
                      {rank}
                    </span>
                  </td>
                  <td>
                    <div className={styles.playerCell}>
                      <img
                        src={bot.avatar}
                        alt={bot.name}
                        className={styles.botAvatar}
                      />
                      <span className={styles.playerName}>{bot.name}</span>
                      {gift && (
                        <img
                          src={gift.image}
                          alt={gift.name}
                          title={`Любимый трофей: ${gift.name}`}
                          className={styles.botGift}
                        />
                      )}
                    </div>
                  </td>
                  <td className={styles.num}>{bot.rounds}</td>
                  <td className={styles.num}>
                    <TonIcon style={{ width: '11px', height: '11px', display: 'inline', verticalAlign: '-1px', marginRight: '2px' }} />
                    {bot.wageredGram} TON
                  </td>
                  <td className={styles.num}>
                    <span className={styles.netWon}>
                      +<TonIcon style={{ width: '11px', height: '11px', display: 'inline', verticalAlign: '-1px', marginRight: '2px' }} />
                      {bot.profitGram} TON
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className={styles.note}>
        PVP-матчей: {pvpMatches}. Оборот — суммарный объём ставок в TON.
        Таблица лидеров обновляется по результатам раундов.
      </p>
    </div>
  )
}
