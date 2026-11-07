import { Component, type ErrorInfo, type ReactNode } from 'react'
import styles from './AdminPanel.module.css'

interface Props {
  /** Смена ключа (другой раздел) сбрасывает ошибку. */
  resetKey: string
  onBack: () => void
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Если раздел админки упал при отрисовке, вместо серого экрана показываем, что сломалось,
 * и кнопку «Назад» — остальная админка продолжает работать.
 */
export class AdminErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[admin] раздел упал', error, info.componentStack)
  }

  override render() {
    if (!this.state.error) return this.props.children
    return (
      <div className={styles.tab} role="alert">
        <p className={`${styles.note} ${styles.bad}`}>
          Раздел не открылся из-за ошибки. Пришлите этот текст разработчику:
        </p>
        <pre className={styles.errorText}>{String(this.state.error.message || this.state.error)}</pre>
        <div className={styles.chips}>
          <button type="button" className={styles.refresh} onClick={() => this.setState({ error: null })}>
            Попробовать снова
          </button>
          <button type="button" className={styles.refresh} onClick={this.props.onBack}>
            ‹ Назад к разделам
          </button>
        </div>
      </div>
    )
  }
}
