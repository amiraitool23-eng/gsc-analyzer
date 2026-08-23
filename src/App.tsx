import { useCallback, useMemo, useState } from 'react'
import { ConnectPanel } from './components/ConnectPanel'
import { DataTable } from './components/DataTable'
import { ErrorAlert } from './components/ErrorAlert'
import { PropertyPicker } from './components/PropertyPicker'
import { useAuth } from './hooks/useAuth'
import { useReport } from './hooks/useReport'
import { useSites } from './hooks/useSites'
import { clearCache } from './lib/cache'
import { GSC_DATA_LAG_DAYS, defaultDateRange, formatDateFa, formatRelativeFa } from './lib/dates'
import { displaySiteName } from './lib/gscApi'
import { formatNumber } from './lib/metrics'

export default function App() {
  const auth = useAuth()
  const [selectedSite, setSelectedSite] = useState<string | null>(null)

  // بازه ثابت مایل‌استون ۱: سه ماه منتهی به (امروز − ۳ روز)
  const range = useMemo(() => defaultDateRange(), [])

  const onAuthExpired = useCallback(() => auth.markExpired(), [auth])

  const token = auth.status === 'signedIn' ? auth.token?.token ?? null : null
  const sitesState = useSites(token, onAuthExpired)
  const report = useReport({ siteUrl: selectedSite, range, token, onAuthExpired })

  const signedIn = auth.status === 'signedIn'

  const handleSignOut = useCallback(async () => {
    setSelectedSite(null)
    await auth.signOut()
  }, [auth])

  // پاک کردن کش یعنی «داده‌ی من روی این دستگاه بماند نه». پس بعد از پاک کردن،
  // عمداً دوباره دانلود نمی‌کنیم و به صفحه‌ی انتخاب پراپرتی برمی‌گردیم.
  const handleClearCache = useCallback(async () => {
    await clearCache()
    setSelectedSite(null)
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="brand">
            <span className="brand-name">GSC Analyzer</span>
            <span className="brand-tag">تحلیل سرچ کنسول، تماماً در مرورگر شما</span>
          </div>
          {signedIn && (
            <>
              {selectedSite && (
                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedSite(null)}>
                  تغییر پراپرتی
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
                خروج
              </button>
            </>
          )}
        </div>
      </header>

      <main className="app-main">
        <div className="privacy-note">
          🔒 داده‌های سرچ کنسول شما فقط در همین مرورگر پردازش و ذخیره می‌شود. این ابزار هیچ
          بک‌اندی ندارد و چیزی به هیچ سروری (به‌جز خود گوگل) فرستاده نمی‌شود.
        </div>

        {/* هنوز پراپرتی‌ای انتخاب نشده: صفحه‌ی کامل ورود */}
        {!signedIn && !selectedSite && (
          <ConnectPanel
            status={auth.status === 'signedIn' ? 'signedOut' : auth.status}
            error={auth.error}
            clientIdMissing={auth.clientIdMissing}
            onSignIn={() => void auth.signIn()}
          />
        )}

        {/* توکن وسط کار منقضی شده: به‌جای پرت کردن کاربر به صفحه‌ی ورود،
            داده‌ی کش‌شده را نگه می‌داریم و فقط دکمه‌ی ورود مجدد می‌دهیم. */}
        {!signedIn && selectedSite && (
          <div className="alert alert-warn" role="alert">
            <div className="alert-title">نشست شما تمام شد</div>
            <p className="alert-body">
              توکن دسترسی گوگل حدوداً یک ساعت اعتبار دارد و مهلتش تمام شده است. داده‌ی زیر از کش
              همین مرورگر نمایش داده می‌شود؛ برای گرفتن داده‌ی تازه دوباره وارد شوید.
              {auth.error ? `\n${auth.error}` : ''}
            </p>
            <div className="alert-actions">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => void auth.signIn()}
                disabled={auth.status === 'connecting'}
              >
                {auth.status === 'connecting' ? 'در حال اتصال…' : 'ورود مجدد به گوگل'}
              </button>
            </div>
          </div>
        )}

        {signedIn && sitesState.error && (
          <ErrorAlert
            error={sitesState.error}
            onRetry={sitesState.reload}
            onSignIn={() => void auth.signIn('consent')}
          />
        )}

        {signedIn && !selectedSite && (
          <>
            {sitesState.loading && (
              <div className="card">
                <div className="progress">
                  <div className="progress-text">در حال گرفتن فهرست پراپرتی‌ها…</div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill progress-bar-indeterminate" />
                  </div>
                </div>
              </div>
            )}
            {!sitesState.loading && !sitesState.error && (
              <PropertyPicker
                sites={sitesState.sites}
                selected={selectedSite}
                onSelect={setSelectedSite}
              />
            )}
          </>
        )}

        {selectedSite && (
          <>
            <div className="card">
              <div className="toolbar">
                <div>
                  <div className="card-title ltr">{displaySiteName(selectedSite)}</div>
                  <div className="faint">
                    بازه: {formatDateFa(range.startDate)} تا {formatDateFa(range.endDate)} — داده‌ی
                    سرچ کنسول {formatNumber(GSC_DATA_LAG_DAYS)} روز تأخیر دارد، برای همین بازه تا
                    امروز نیست.
                  </div>
                </div>
                <div className="toolbar-spacer" />
                {report.report && (
                  <span className="faint">
                    {report.fromCache ? 'از کش محلی' : 'تازه از گوگل'} —{' '}
                    {formatRelativeFa(report.report.fetchedAt)}
                  </span>
                )}
                <button
                  className="btn btn-primary btn-sm"
                  onClick={report.refresh}
                  disabled={report.status === 'fetching' || !signedIn}
                >
                  به‌روزرسانی داده
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => void handleClearCache()}
                  disabled={report.status === 'fetching'}
                  title="حذف همه‌ی داده‌های ذخیره‌شده در این مرورگر و بازگشت به فهرست پراپرتی‌ها"
                >
                  پاک کردن داده‌های محلی
                </button>
              </div>
            </div>

            {report.error && (
              <ErrorAlert
                error={report.error}
                onRetry={report.refresh}
                onSignIn={() => void auth.signIn('consent')}
              />
            )}

            {(report.status === 'fetching' || report.status === 'loadingCache') && (
              <div className="card">
                <div className="progress">
                  <div className="progress-text">
                    {report.status === 'loadingCache'
                      ? 'در حال خواندن کش محلی…'
                      : report.progress
                        ? `در حال دریافت از گوگل… ${formatNumber(report.progress.rowsFetched)} سطر (درخواست ${formatNumber(report.progress.page)})`
                        : 'در حال دریافت از گوگل…'}
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar-fill progress-bar-indeterminate" />
                  </div>
                  <div className="faint">
                    داده در بسته‌های ۲۵٬۰۰۰ سطری گرفته می‌شود؛ برای سایت‌های بزرگ ممکن است چند
                    دقیقه طول بکشد.
                  </div>
                </div>
              </div>
            )}

            {report.status === 'ready' && report.report && (
              <>
                <div className="alert alert-info">
                  <p className="alert-body">
                    نکته: حدود ۹۳٪ کلیک‌های سرچ کنسول از کوئری‌های ناشناس می‌آید که در بُعد Query
                    گزارش نمی‌شوند. بنابراین جمع کلیک این جدول با آمار کل سایت نمی‌خواند و
                    تحلیل‌های صفحه‌محور قابل‌اعتمادترند.
                  </p>
                </div>
                {report.report.rows.length === 0 ? (
                  <div className="card">
                    <div className="empty-state">
                      برای این پراپرتی در این بازه داده‌ای برنگشت. شاید پراپرتی تازه تأیید شده یا
                      ترافیک ارگانیک نداشته است.
                    </div>
                  </div>
                ) : (
                  <DataTable rows={report.report.rows} />
                )}
              </>
            )}
          </>
        )}
      </main>

      <footer className="app-footer">
        GSC Analyzer — بدون بک‌اند، بدون ارسال داده. فونت Vazirmatn تحت لایسنس OFL.
      </footer>
    </div>
  )
}
