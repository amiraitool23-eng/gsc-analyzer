import type { Totals } from '../lib/metrics'
import { formatCtr, formatNumber, formatPosition } from '../lib/metrics'

interface Props {
  totals: Totals
  /** وقتی فیلتری فعال است، اعداد فقط برای سطرهای فیلترشده محاسبه شده‌اند */
  filtered: boolean
}

/**
 * کارت‌های خلاصه.
 * دقت: «میانگین موقعیت» اینجا وزنی با Impression است، نه میانگین ساده.
 * و CTR کل از تقسیم مجموع کلیک بر مجموع نمایش می‌آید، نه میانگین CTR سطرها.
 */
export function SummaryCards({ totals, filtered }: Props) {
  const suffix = filtered ? ' (فیلترشده)' : ''
  return (
    <div className="summary-grid">
      <div className="stat">
        <div className="stat-label">تعداد سطر{suffix}</div>
        <div className="stat-value">{formatNumber(totals.rows)}</div>
        <div className="stat-hint">هر سطر = یک ترکیب صفحه و کوئری</div>
      </div>
      <div className="stat">
        <div className="stat-label">کلیک{suffix}</div>
        <div className="stat-value">{formatNumber(totals.clicks)}</div>
        <div className="stat-hint">فقط کلیک‌های منتسب به کوئری‌های نمایش‌داده‌شده</div>
      </div>
      <div className="stat">
        <div className="stat-label">نمایش{suffix}</div>
        <div className="stat-value">{formatNumber(totals.impressions)}</div>
        <div className="stat-hint">Impressions</div>
      </div>
      <div className="stat">
        <div className="stat-label">CTR{suffix}</div>
        <div className="stat-value">{formatCtr(totals.ctr)}</div>
        <div className="stat-hint">مجموع کلیک ÷ مجموع نمایش</div>
      </div>
      <div className="stat">
        <div className="stat-label">میانگین موقعیت{suffix}</div>
        <div className="stat-value">{formatPosition(totals.position)}</div>
        <div className="stat-hint">میانگین وزنی با Impression</div>
      </div>
    </div>
  )
}
