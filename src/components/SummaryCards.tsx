import type { TotalsDelta } from '../lib/compare'
import type { Totals } from '../lib/metrics'
import { formatCtr, formatNumber, formatPosition } from '../lib/metrics'
import { DeltaCount, DeltaCtr, DeltaPosition } from './Delta'

interface Props {
  totals: Totals
  /** وقتی فیلتری فعال است، اعداد فقط برای سطرهای فیلترشده محاسبه شده‌اند */
  filtered: boolean
  variant: 'page' | 'query'
  /** خلاصه‌ی دوره‌ی قبل، وقتی مقایسه روشن است */
  previous?: Totals
  /** تفاوت دو دوره؛ همراه previous می‌آید */
  delta?: TotalsDelta
}

/**
 * کارت‌های خلاصه.
 * دقت: «میانگین موقعیت» اینجا وزنی با Impression است، نه میانگین ساده.
 * و CTR کل از تقسیم مجموع کلیک بر مجموع نمایش می‌آید، نه میانگین CTR سطرها.
 */
export function SummaryCards({ totals, filtered, variant, previous, delta }: Props) {
  const suffix = filtered ? ' (فیلترشده)' : ''
  const isPage = variant === 'page'
  return (
    <div className="summary-grid">
      <div className="stat">
        <div className="stat-label">{isPage ? 'تعداد صفحه' : 'تعداد سطر'}{suffix}</div>
        <div className="stat-value">{formatNumber(totals.rows)}</div>
        <div className="stat-hint">
          {isPage ? 'صفحه‌هایی که در نتایج دیده شده‌اند' : 'هر سطر = یک ترکیب صفحه و کوئری'}
        </div>
      </div>
      <div className="stat">
        <div className="stat-label">کلیک{suffix}</div>
        <div className="stat-value">{formatNumber(totals.clicks)}</div>
        {delta && previous ? (
          <DeltaCount delta={delta.clicks} previous={previous.clicks} />
        ) : (
          <div className="stat-hint">
            {isPage
              ? 'تقریباً همه‌ی کلیک‌ها، شامل کوئری‌های ناشناس'
              : 'فقط کلیک‌های منتسب به کوئری‌های نمایش‌داده‌شده'}
          </div>
        )}
      </div>
      <div className="stat">
        <div className="stat-label">نمایش{suffix}</div>
        <div className="stat-value">{formatNumber(totals.impressions)}</div>
        {delta && previous ? (
          <DeltaCount delta={delta.impressions} previous={previous.impressions} />
        ) : (
          <div className="stat-hint">Impressions</div>
        )}
      </div>
      <div className="stat">
        <div className="stat-label">CTR{suffix}</div>
        <div className="stat-value">{formatCtr(totals.ctr)}</div>
        {delta ? (
          <DeltaCtr points={delta.ctrPoints} />
        ) : (
          <div className="stat-hint">مجموع کلیک ÷ مجموع نمایش</div>
        )}
      </div>
      <div className="stat">
        <div className="stat-label">میانگین موقعیت{suffix}</div>
        <div className="stat-value">{formatPosition(totals.position)}</div>
        {delta ? (
          <DeltaPosition delta={delta.position} />
        ) : (
          <div className="stat-hint">میانگین وزنی با Impression</div>
        )}
      </div>
    </div>
  )
}
