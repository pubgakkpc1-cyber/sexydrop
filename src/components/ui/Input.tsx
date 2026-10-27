import type { InputHTMLAttributes, ReactNode } from 'react'
import { useId } from 'react'
import { cx } from '../../lib/cx'
import styles from './Input.module.css'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Подпись над полем. */
  label?: string
  /** Текст ошибки. Показывается вместо hint, поле подсвечивается. */
  error?: string
  /** Подсказка под полем (когда нет ошибки). */
  hint?: string
  /** Статичный элемент справа в поле (например, валюта). */
  suffix?: ReactNode
}

export function Input({
  label,
  error,
  hint,
  suffix,
  className,
  id,
  ...rest
}: InputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const messageId = `${inputId}-msg`

  return (
    <div className={cx(styles.wrapper, className)}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      )}
      <div className={styles.fieldRow}>
        <input
          id={inputId}
          className={cx(
            styles.input,
            Boolean(suffix) && styles.hasSuffix,
            error && styles.invalid,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? messageId : undefined}
          {...rest}
        />
        {suffix && <span className={styles.suffix}>{suffix}</span>}
      </div>
      {(error || hint) && (
        <span id={messageId} className={cx(styles.message, error ? styles.error : styles.hint)}>
          {error ?? hint}
        </span>
      )}
    </div>
  )
}
