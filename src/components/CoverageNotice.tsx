import type { SiteTotals } from '../types'
import type { Totals } from '../lib/metrics'
import { formatCtr, formatNumber, formatPosition } from '../lib/metrics'

interface Props {
  /** آمار کل پراپرتی (بدون بُعد) — همان عددی که UI سرچ کنسول نشان می‌دهد */
  site: SiteTotals | undefined
  /** جمع سطرهای همین جدول (بُعد page + query) */
  table: Totals
}

const percentFa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 })

function share(part: number, whole: number): string {
  if (whole <= 0) return '—'
  return `${percentFa.format((part / whole) * 100)}٪`
}

/**
 * چرا این کامپوننت وجود دارد؟
 *
 * پرتکرارترین سؤالِ کاربر این است: «چرا عدد این ابزار با سرچ کنسول فرق دارد؟»
 * جواب — کوئری‌های ناشناس — وقتی به شکل یک جمله‌ی کلی نوشته شود کسی باور نمی‌کند.
 * پس هر دو عدد را کنار هم و با درصد نشان می‌دهیم تا کاربر خودش ببیند چه مقدار
 * از داده‌اش اصلاً گزارش نشده است.
 */
export function CoverageNotice({ site, table }: Props) {
  if (!site || site.impressions <= 0) {
    // آمار کل را نگرفتیم؛ دست‌کم محدودیت را توضیح بده
    return (
      <div className="alert alert-info">
        <p className="alert-body">
          نکته: بخش بزرگی از کلیک‌های سرچ کنسول از کوئری‌های ناشناس می‌آید که گوگل در بُعد
          Query گزارش نمی‌کند. بنابراین جمع کلیک این جدول با آمار کل سایت نمی‌خواند و
          تحلیل‌های صفحه‌محور قابل‌اعتمادترند.
        </p>
      </div>
    )
  }

  const hiddenClicks = Math.max(site.clicks - table.clicks, 0)

  return (
    <div className="alert alert-info coverage">
      <div className="alert-title">چرا این اعداد با خود سرچ کنسول فرق دارد؟</div>

      <table className="coverage-table">
        <thead>
          <tr>
            <th />
            <th>کل سایت</th>
            <th>در این جدول</th>
            <th>پوشش</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>کلیک</th>
            <td className="nums">{formatNumber(site.clicks)}</td>
            <td className="nums">{formatNumber(table.clicks)}</td>
            <td className="nums">{share(table.clicks, site.clicks)}</td>
          </tr>
          <tr>
            <th>نمایش</th>
            <td className="nums">{formatNumber(site.impressions)}</td>
            <td className="nums">{formatNumber(table.impressions)}</td>
            <td className="nums">{share(table.impressions, site.impressions)}</td>
          </tr>
          <tr>
            <th>CTR</th>
            <td className="nums">{formatCtr(site.ctr)}</td>
            <td className="nums">{formatCtr(table.ctr)}</td>
            <td className="nums">—</td>
          </tr>
          <tr>
            <th>میانگین موقعیت</th>
            <td className="nums">{formatPosition(site.position)}</td>
            <td className="nums">{formatPosition(table.position)}</td>
            <td className="nums">—</td>
          </tr>
        </tbody>
      </table>

      <p className="alert-body">
        ستون «کل سایت» همان چیزی است که صفحه‌ی Performance سرچ کنسول نشان می‌دهد.
        {hiddenClicks > 0 && (
          <>
            {' '}
            <strong>
              {formatNumber(hiddenClicks)} کلیک ({share(hiddenClicks, site.clicks)}) از
              کوئری‌هایی آمده که گوگل اسمشان را فاش نمی‌کند
            </strong>{' '}
            — عبارت‌هایی که آن‌قدر کم‌تکرارند که ممکن است کاربر را لو بدهند. آن کلیک‌ها در آمار
            کل هستند ولی در هیچ گزارش کوئری‌محوری (نه اینجا، نه هیچ ابزار دیگری) دیده نمی‌شوند.
          </>
        )}
      </p>
      <p className="alert-body">
        یعنی این جدول برای پیدا کردن <strong>فرصت‌های کوئری</strong> خوب است، نه برای اندازه‌گیری
        ترافیک. میانگین موقعیت این جدول هم به همین دلیل بدتر از کل سایت است: کوئری‌های خوب‌رتبه
        بیشترشان جزو همان ناشناس‌ها هستند.
      </p>
    </div>
  )
}
