import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isChunkLoadError, reloadForNewVersion } from '../../lib/chunkReload'
import styles from './AppErrorBoundary.module.css'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Последний рубеж: любая ошибка отрисовки экрана показывает понятное сообщение с кнопками
 * «Обновить» и «На главную» вместо пустого серого экрана.
 */
export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[app] экран упал', error, info.componentStack)
    // устаревшая версия после деплоя — сразу за новой
    if (isChunkLoadError(error)) reloadForNewVersion()
  }

  private goHome = () => {
    this.setState({ error: null })
    window.location.hash = '#/'
  }

  override render() {
    if (!this.state.error) return this.props.children
    return (
      <div className={styles.screen} role="alert">
        <h2 className={styles.title}>Экран не загрузился</h2>
        <p className={styles.text}>
          Скорее всего, приложение обновилось, пока было открыто. Нажмите «Обновить» — загрузится
          свежая версия.
        </p>
        <button type="button" className={styles.primary} onClick={() => reloadForNewVersion(true)}>
          Обновить
        </button>
        <button type="button" className={styles.secondary} onClick={this.goHome}>
          На главную
        </button>
        <p className={styles.details}>{String(this.state.error.message || this.state.error).slice(0, 200)}</p>
      </div>
    )
  }
}
