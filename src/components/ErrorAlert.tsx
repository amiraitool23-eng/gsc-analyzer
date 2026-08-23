import type { GscError } from '../lib/errors'

interface Props {
  error: GscError
  onRetry?: () => void
  onSignIn?: () => void
  onDismiss?: () => void
}

/** نمایش خطاهای دسته‌بندی‌شده با راهنمای فارسی و دکمه‌ی اقدام مناسب همان خطا. */
export function ErrorAlert({ error, onRetry, onSignIn, onDismiss }: Props) {
  const tone = error.kind === 'rateLimit' ? 'alert-warn' : 'alert-error'
  const showSignIn = error.kind === 'auth' && onSignIn
  const showRetry = error.kind !== 'auth' && onRetry

  return (
    <div className={`alert ${tone}`} role="alert">
      <div className="alert-title">{error.title}</div>
      <p className="alert-body">{error.hint}</p>
      {error.raw && error.kind !== 'auth' && (
        <details>
          <summary className="faint" style={{ cursor: 'pointer' }}>
            جزئیات فنی
          </summary>
          <p className="alert-body ltr" style={{ fontSize: 13 }}>
            {error.raw}
          </p>
        </details>
      )}
      <div className="alert-actions">
        {showSignIn && (
          <button className="btn btn-primary btn-sm" onClick={onSignIn}>
            ورود مجدد به گوگل
          </button>
        )}
        {showRetry && (
          <button className="btn btn-secondary btn-sm" onClick={onRetry}>
            تلاش دوباره
          </button>
        )}
        {onDismiss && (
          <button className="btn btn-ghost btn-sm" onClick={onDismiss}>
            بستن
          </button>
        )}
      </div>
    </div>
  )
}
