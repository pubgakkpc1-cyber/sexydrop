import { useState } from 'react'
import { TgAvatar } from '../ui/TgAvatar'
import styles from './AdminPanel.module.css'

/** Аватарка игрока в админке: фото из Telegram, иначе инициалы на градиенте. */
export function PlayerAvatar({ name, photo, size = 40 }: { name: string; photo: string | null; size?: number }) {
  const [broken, setBroken] = useState(false)
  if (!photo || broken) return <TgAvatar name={name} size={size} />
  return (
    <img
      className={styles.pAvatar}
      src={photo}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  )
}
