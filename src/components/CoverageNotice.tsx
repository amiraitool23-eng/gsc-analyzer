import type { SiteTotals } from '../types'
import type { Totals } from '../lib/metrics'
import { formatCtr, formatNumber, formatPosition } from '../lib/metrics'

interface Props {
  /** آمار کل پراپرتی (بدون بُعد) — همان عددی که UI سرچ کنسول نشان می‌دهد */
  site: SiteTotals | undefined
  /** جمع سطرهای همین جدول */
  table: Totals
  variant: 'page' | 'query'
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
export function CoverageNotice({ site, table, variant }: Props) {
  const isPage = variant === 'page'

  if (!site || site.impressions <= 0) {
    // آمار کل را نگرفتیم؛ دست‌کم محدودیت را توضیح بده
    return (
      <div className="alert alert-info">
        <p className="alert-body">
          {isPage
            ? 'این نما فقط بُعد «صفحه» را می‌گیرد، پس کلیک‌های کوئری‌های ناشناس هم در آن هستند و اعدادش به آمار واقعی سایت نزدیک است.'
            : 'نکته: بخش بزرگی از کلیک‌های سرچ کنسول از کوئری‌های ناشناس می‌آید که گوگل در بُعد Query گزارش نمی‌کند. بنابراین جمع کلیک این جدول با آمار کل سایت نمی‌خواند و تحلیل‌های صفحه‌محور قابل‌اعتمادترند.'}
        </p>
      </div>
    )
  }

  const hiddenClicks = Math.max(site.clicks - table.clicks, 0)
  const clickCoverage = site.clicks > 0 ? table.clicks / site.clicks : 0

  return (
    <div className={`alert coverage ${isPage ? 'alert-ok' : 'alert-info'}`}>
      <div className="alert-title">
        {isPage
          ? 'این اعداد با خود سرچ کنسول می‌خواند'
          : 'چرا این اعداد با خود سرچ کنسول فرق دارد؟'}
      </div>

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

      {isPage ? (
        <>
          <p className="alert-body">
            ستون «کل سایت» همان چیزی است که صفحه‌ی Performance سرچ کنسول نشان می‌دهد. چون این
            نما فقط بُعد «صفحه» را می‌گیرد، کلیک‌های کوئری‌های ناشناس هم به صفحه‌شان نسبت داده
            شده‌اند و چیزی از قلم نیفتاده — پوشش کلیک{' '}
            <strong>{share(table.clicks, site.clicks)}</strong> است.
          </p>
          <p className="alert-body">
            {clickCoverage < 0.95
              ? 'اختلاف باقی‌مانده معمولاً از کلیک‌هایی است که به صفحه‌ی مشخصی نسبت داده نشده‌اند یا در روزهای مرزی بازه افتاده‌اند.'
              : 'یعنی برای پاسخ به «کدام صفحه چقدر ترافیک گرفته؟» می‌توانید مستقیم به همین اعداد اتکا کنید.'}{' '}
            برای دیدن اینکه هر صفحه با <strong>چه عبارت‌هایی</strong> دیده شده، به نمای
            کوئری‌محور بروید — ولی آنجا اعداد کامل نیستند.
          </p>
        </>
      ) : (
        <>
          <p className="alert-body">
            ستون «کل سایت» همان چیزی است که صفحه‌ی Performance سرچ کنسول نشان می‌دهد.
            {hiddenClicks > 0 && (
              <>
                {' '}
                <strong>
                  {formatNumber(hiddenClicks)} کلیک ({share(hiddenClicks, site.clicks)}) از
                  کوئری‌هایی آمده که گوگل اسمشان را فاش نمی‌کند
                </strong>{' '}
                — عبارت‌هایی که آن‌قدر کم‌تکرارند که ممکن است کاربر را لو بدهند. آن کلیک‌ها در
                آمار کل هستند ولی در هیچ گزارش کوئری‌محوری (نه اینجا، نه هیچ ابزار دیگری) دیده
                نمی‌شوند.
              </>
            )}
          </p>
          <p className="alert-body">
            یعنی این جدول برای پیدا کردن <strong>فرصت‌های کوئری</strong> خوب است، نه برای
            اندازه‌گیری ترافیک. میانگین موقعیت این جدول هم به همین دلیل بدتر از کل سایت است:
            کوئری‌های خوب‌رتبه بیشترشان جزو همان ناشناس‌ها هستند. برای اعداد واقعی هر صفحه، به
            نمای صفحه‌محور بروید.
          </p>
        </>
      )}
    </div>
  )
}
