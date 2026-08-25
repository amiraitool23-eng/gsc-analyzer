import { useMemo } from 'react'
import type { DailyRow } from '../types'
import { detectDrop } from '../lib/trend'
import { formatDateFa } from '../lib/dates'
import { formatCtr, formatNumber, formatPosition } from '../lib/metrics'
import { TrendChart } from './TrendChart'

interface Props {
  rows: readonly DailyRow[] | undefined
  previous?: readonly DailyRow[]
}

const avgFa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 })
const pctFa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 })

export function TrendPanel({ rows, previous }: Props) {
  const drop = useMemo(() => (rows ? detectDrop(rows, 'clicks') : null), [rows])

  if (!rows) {
    return (
      <div className="card">
        <div className="empty-state">
          سری زمانی برای این گزارش هنوز گرفته نشده. «به‌روزرسانی داده» را بزنید.
        </div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">در این بازه هیچ روزی داده نداشت.</div>
      </div>
    )
  }

  return (
    <div className="card trend-card">
      {drop ? (
        <div className="alert alert-warn trend-finding" role="status">
          <div className="alert-title">
            افت از حدود {formatDateFa(drop.date)} شروع شده
          </div>
          <p className="alert-body">
            میانگین کلیک روزانه در {formatNumber(drop.window)} روز قبل از آن{' '}
            <strong>{avgFa.format(drop.beforeAvg)}</strong> بوده و در{' '}
            {formatNumber(drop.window)} روز بعدش{' '}
            <strong>{avgFa.format(drop.afterAvg)}</strong> — یعنی{' '}
            <strong>{pctFa.format(drop.dropRatio * 100)}٪ کمتر</strong>.
          </p>
          <p className="alert-body faint">
            این یک نشانه است نه اثبات: الگوریتم فقط بزرگ‌ترین اختلاف دو پنجره‌ی
            {' '}{formatNumber(drop.window)} روزه را پیدا می‌کند. تعطیلات، فصل، یا تغییر خود سایت هم
            می‌توانند همین شکل را بسازند. اعداد بالا را ببینید و خودتان قضاوت کنید.
          </p>
        </div>
      ) : (
        <p className="card-desc" style={{ marginBottom: 16 }}>
          افت پایدار و معناداری در کلیک‌های روزانه‌ی این بازه پیدا نشد.
        </p>
      )}

      <div className="chart-grid-2">
        <TrendChart
          title="کلیک روزانه"
          metric="clicks"
          rows={rows}
          previous={previous}
          markerDate={drop?.date}
        />
        <TrendChart
          title="نمایش روزانه"
          metric="impressions"
          rows={rows}
          previous={previous}
          markerDate={drop?.date}
        />
      </div>

      <details className="trend-table-toggle">
        <summary>دیدن اعداد به صورت جدول</summary>
        <div className="table-scroll" style={{ maxHeight: 320, marginTop: 12 }}>
          <table className="data-table trend-table">
            <thead>
              <tr>
                <th>
                  <span className="th-plain">روز</span>
                </th>
                <th className="th-numeric">
                  <span className="th-plain">کلیک</span>
                </th>
                <th className="th-numeric">
                  <span className="th-plain">نمایش</span>
                </th>
                <th className="th-numeric">
                  <span className="th-plain">CTR</span>
                </th>
                <th className="th-numeric">
                  <span className="th-plain">موقعیت</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((row) => (
                <tr key={row.date}>
                  <td>{formatDateFa(row.date)}</td>
                  <td className="cell-num">{formatNumber(row.clicks)}</td>
                  <td className="cell-num">{formatNumber(row.impressions)}</td>
                  <td className="cell-num">{formatCtr(row.ctr)}</td>
                  <td className="cell-num">{formatPosition(row.position)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
