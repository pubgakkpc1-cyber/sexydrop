import { useState, useMemo } from 'react'
import { getTelegramUser } from '../../lib/telegram'
import styles from './UserAvatar.module.css'

interface UserAvatarProps {
  size?: number
  className?: string
}

export function UserAvatar({ size = 36, className }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false)
  const tgUser = useMemo(() => getTelegramUser(), [])

  const initial = useMemo(() => {
    const name = tgUser?.first_name?.trim() || tgUser?.username?.trim() || 'G'
    return name[0]?.toUpperCase() || 'G'
  }, [tgUser])

  const photoUrl = tgUser?.photo_url

  return (
    <div
      className={`${styles.avatar} ${className || ''}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        fontSize: `${Math.round(size * 0.44)}px`,
      }}
      aria-label="Аватар профиля"
    >
      {photoUrl && !imgError ? (
        <img
          src={photoUrl}
          alt="Аватар профиля"
          className={styles.avatarImg}
          onError={() => setImgError(true)}
        />
      ) : (
        <span className={styles.avatarInitial}>{initial}</span>
      )}
    </div>
  )
}
