import { useCallback, useMemo, useState } from 'react'
import { ClientIdSetup } from './components/ClientIdSetup'
import { ConnectPanel } from './components/ConnectPanel'
import { DataTable } from './components/DataTable'
import { ErrorAlert } from './components/ErrorAlert'
import { PropertyPicker } from './components/PropertyPicker'
import { useAuth } from './hooks/useAuth'
import { useReport } from './hooks/useReport'
import { useSites } from './hooks/useSites'
import { clearCache } from './lib/cache'
import { getClientId, isClientIdFromEnv, saveClientId } from './lib/clientId'
import type { PeriodId } from './lib/dates'
import {
  DEFAULT_PERIOD,
  GSC_DATA_LAG_DAYS,
  PERIODS,
  formatDateFa,
  formatRelativeFa,
  previousRange,
  rangeForPeriod,
} from './lib/dates'
import { displaySiteName } from './lib/gscApi'
import { formatNumber } from './lib/metrics'

export default function App() {
  const auth = useAuth()
  const [selectedSite, setSelectedSite] = useState<string | null>(null)
  // Client ID در همین مرورگر ذخیره می‌شود تا نسخه‌ی تحت وب بدون فایل .env کار کند
  const [clientId, setClientId] = useState(getClientId())
  const [editingClientId, setEditingClientId] = useState(false)
  // پیش‌فرض صفحه‌محور: تنها نمایی که اعدادش با آمار واقعی سایت می‌خواند
  const [view, setView] = useState<'page' | 'query'>('page')
  const [comparing, setComparing] = useState(false)
  const [period, setPeriod] = useState<PeriodId>(DEFAULT_PERIOD)

  // بازه‌ی انتخابی، منتهی به (امروز − ۳ روز). کلید کش شامل بازه است، پس
  // برگشتن به بازه‌ای که قبلاً دیده شده دوباره دانلود نمی‌خواهد.
  const range = useMemo(() => rangeForPeriod(period), [period])

  const onAuthExpired = useCallback(() => auth.markExpired(), [auth])

  const token = auth.status === 'signedIn' ? auth.token?.token ?? null : null
  const sitesState = useSites(token, onAuthExpired)
  const report = useReport({ siteUrl: selectedSite, range, token, onAuthExpired })

  // دوره‌ی قبل با همان هوک گرفته می‌شود: کش، صفحه‌بندی و مدیریت خطا مشترک است.
  // تا وقتی مقایسه روشن نشده siteUrl را null می‌دهیم تا هیچ درخواستی نرود.
  const prevRange = useMemo(() => previousRange(range), [range])
  const prevReport = useReport({
    siteUrl: comparing ? selectedSite : null,
    range: prevRange,
    token,
    onAuthExpired,
  })

  const signedIn = auth.status === 'signedIn'

  const handleSignOut = useCallback(async () => {
    setSelectedSite(null)
    await auth.signOut()
  }, [auth])

  const handleSaveClientId = useCallback((value: string) => {
    saveClientId(value)
    setClientId(value)
    setEditingClientId(false)
  }, [])

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

        {/* هنوز Client ID نداریم (یا کاربر می‌خواهد عوضش کند): فرم تنظیم */}
        {!signedIn && !selectedSite && (clientId === '' || editingClientId) && (
          <ClientIdSetup
            current={clientId}
            onSave={handleSaveClientId}
            onCancel={clientId !== '' ? () => setEditingClientId(false) : undefined}
          />
        )}

        {/* Client ID داریم و هنوز پراپرتی‌ای انتخاب نشده: صفحه‌ی ورود */}
        {!signedIn && !selectedSite && clientId !== '' && !editingClientId && (
          <ConnectPanel
            status={auth.status === 'signedIn' ? 'signedOut' : auth.status}
            error={auth.error}
            clientId={clientId}
            clientIdFromEnv={isClientIdFromEnv()}
            onSignIn={() => void auth.signIn()}
            onChangeClientId={() => setEditingClientId(true)}
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
                  {comparing && (
                    <div className="faint">
                      مقایسه با دوره‌ی قبل: {formatDateFa(prevRange.startDate)} تا{' '}
                      {formatDateFa(prevRange.endDate)} (هم‌طول با بازه‌ی بالا)
                    </div>
                  )}
                </div>
                <div className="toolbar-spacer" />
                <div className="period-picker" role="group" aria-label="بازه‌ی زمانی">
                  {PERIODS.map((p) => (
                    <button
                      key={p.id}
                      className="period-btn"
                      aria-pressed={period === p.id}
                      onClick={() => setPeriod(p.id)}
                      disabled={report.status === 'fetching'}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {report.report && (
                  <span className="faint">
                    {report.fromCache ? 'از کش محلی' : 'تازه از گوگل'} —{' '}
                    {formatRelativeFa(report.report.fetchedAt)}
                  </span>
                )}
                <button
                  className={`btn btn-sm ${comparing ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setComparing((c) => !c)}
                  aria-pressed={comparing}
                  title={`مقایسه با ${formatDateFa(prevRange.startDate)} تا ${formatDateFa(prevRange.endDate)}`}
                >
                  {comparing ? 'بستن مقایسه' : 'مقایسه با دوره‌ی قبل'}
                </button>
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
                {report.report.rows.length === 0 &&
                (report.report.pageRows?.length ?? 0) === 0 ? (
                  <div className="card">
                    <div className="empty-state">
                      برای این پراپرتی در این بازه داده‌ای برنگشت. شاید پراپرتی تازه تأیید شده یا
                      ترافیک ارگانیک نداشته است.
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="tabs" role="tablist">
                      <button
                        role="tab"
                        aria-selected={view === 'page'}
                        className="tab"
                        onClick={() => setView('page')}
                      >
                        صفحه‌محور
                        <span className="tab-hint">ترافیک واقعی هر صفحه</span>
                      </button>
                      <button
                        role="tab"
                        aria-selected={view === 'query'}
                        className="tab"
                        onClick={() => setView('query')}
                      >
                        کوئری‌محور
                        <span className="tab-hint">عبارت‌های جست‌وجو</span>
                      </button>
                    </div>

                    {comparing &&
                      (prevReport.status === 'fetching' ||
                        prevReport.status === 'loadingCache') && (
                        <div className="alert alert-info">
                          <p className="alert-body">
                            در حال گرفتن داده‌ی دوره‌ی قبل… تا آماده شدنش، اعداد زیر فقط مربوط
                            به دوره‌ی فعلی است.
                          </p>
                        </div>
                      )}

                    {comparing && prevReport.error && (
                      <ErrorAlert
                        error={prevReport.error}
                        onRetry={prevReport.refresh}
                        onSignIn={() => void auth.signIn('consent')}
                      />
                    )}

                    {view === 'page' ? (
                      report.report.pageRows ? (
                        <DataTable
                          rows={report.report.pageRows}
                          siteTotals={report.report.siteTotals}
                          variant="page"
                          previousRows={
                            comparing ? prevReport.report?.pageRows : undefined
                          }
                        />
                      ) : (
                        <div className="card">
                          <div className="empty-state">
                            نمای صفحه‌محور برای این گزارش هنوز گرفته نشده. «به‌روزرسانی داده» را
                            بزنید.
                          </div>
                        </div>
                      )
                    ) : (
                      <DataTable
                        rows={report.report.rows}
                        siteTotals={report.report.siteTotals}
                        variant="query"
                        previousRows={comparing ? prevReport.report?.rows : undefined}
                      />
                    )}
                  </>
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
