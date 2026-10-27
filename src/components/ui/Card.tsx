import type { HTMLAttributes } from 'react'
import { cx } from '../../lib/cx'
import styles from './Card.module.css'

export type CardPadding = 'none' | 'sm' | 'md' | 'lg'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Отступ содержимого. По умолчанию md. */
  padding?: CardPadding
  /** Карточка-кнопка: hover/active-эффекты. */
  interactive?: boolean
}

export function Card({
  padding = 'md',
  interactive = false,
  className,
  ...rest
}: CardProps) {
  return (
    <div
      className={cx(styles.card, styles[padding], interactive && styles.interactive, className)}
      {...rest}
    />
  )
}
