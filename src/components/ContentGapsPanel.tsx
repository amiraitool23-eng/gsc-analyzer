import { useMemo, useState } from 'react'
import type { GscRow } from '../types'
import type { CrawlPage } from '../lib/crawlCsv'
import type { ContentGap } from '../lib/contentGaps'
import { GAP_TARGET_POSITION, findContentGaps } from '../lib/contentGaps'
import { formatCtr, formatNumber, formatPosition } from '../lib/metrics'
import { useSiteCurve } from '../hooks/useSiteCurve'
import { PageLink } from './PageLink'

/**
 * «عبارت‌هایی که تقاضا دارند ولی صفحه‌ی اختصاصی ندارند».
 *
 * قاعده‌ی این پنل: **شاهد را نشان بده، حکم نده.** ابزار نمی‌داند کدام عبارت به
 * کسب‌وکار کاربر مربوط است؛ آن قضاوت آدم است. پس کنار هر عبارت، نزدیک‌ترین صفحه‌ی
 * موجود و درصد پوششش نوشته می‌شود تا کاربر خودش ببیند ابزار بر چه اساسی گفته
 * «صفحه‌ای نداریم».
 */

const percentFa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 })
const PAGE_STEP = 25

interface Props {
  siteUrl: string
  queryRows: GscRow[]
  /** صفحه‌های کراول، از قبل به محدوده‌ی پراپرتی محدود شده */
  crawlPages: readonly CrawlPage[]
}

export function ContentGapsPanel({ siteUrl, queryRows, crawlPages }: Props) {
  const { curve, isBrand, confirmed } = useSiteCurve(siteUrl, queryRows)
  const [visible, setVisible] = useState(PAGE_STEP)
  const [expanded, setExpanded] = useState<string | null>(null)

  const gaps = useMemo(
    () => findContentGaps({ queryRows, crawlPages, curve, isBrand }),
    [queryRows, crawlPages, curve, isBrand],
  )

  /** صفحه‌هایی که همین حالا برای هر عبارت دیده می‌شوند */
  const pagesByQuery = useMemo(() => {
    const map = new Map<string, GscRow[]>()
    for (const row of queryRows) {
      const list = map.get(row.query)
      if (list) list.push(row)
      else map.set(row.query, [row])
    }
    for (const list of map.values()) list.sort((a, b) => b.impressions - a.impressions)
    return map
  }, [queryRows])

  const totalMissed = useMemo(
    () => gaps.reduce((sum, g) => sum + g.missedClicks, 0),
    [gaps],
  )

  if (queryRows.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          برای این تحلیل داده‌ی کوئری‌محور لازم است. «به‌روزرسانی داده» را بزنید.
        </div>
      </div>
    )
  }

  if (!curve.available) {
    return (
      <div className="card opp-card">
        <div className="card-title">عبارت‌هایی که صفحه‌ی اختصاصی ندارند</div>
        <div className="alert alert-warn">
          <div className="alert-title">منحنی CTR ساخته نشد</div>
          <p className="alert-body">
            برای تخمین «چقدر کلیک ممکن است» به منحنی CTR سایت نیاز است و داده‌ی این
            بازه برای ساختنش کافی نیست. بازه‌ی بلندتری انتخاب کنید.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card opp-card">
      <div className="card-title">عبارت‌هایی که صفحه‌ی اختصاصی ندارند</div>
      <p className="card-desc">
        این‌ها عبارت‌هایی هستند که سایت شما برایشان دیده می‌شود، ولی{' '}
        <strong>هیچ صفحه‌ای عنوانش درباره‌ی آن‌ها نیست</strong> — یعنی روی صفحه‌ای رتبه
        گرفته‌اند که جای درستشان نیست. کاندید نوشتن محتوای تازه. مقایسه با{' '}
        <strong>همه‌ی</strong> صفحه‌های کراول انجام می‌شود، حتی آن‌هایی که هیچ نمایشی
        نگرفته‌اند؛ وگرنه ابزار می‌گفت «ندارید» و شما دوباره همان را می‌نوشتید.
      </p>

      {!confirmed && (
        <div className="alert alert-warn">
          <div className="alert-title">کلمات برند هنوز تأیید نشده‌اند</div>
          <p className="alert-body">
            فعلاً از حدس خودکار استفاده شده. برای اینکه عبارت‌های برند از این فهرست
            کنار بروند، یک بار در تب «فرصت‌ها» کلمات برند را کامل و تأیید کنید.
          </p>
        </div>
      )}

      {gaps.length === 0 ? (
        <div className="empty-state">
          هر عبارتی که برایش دیده می‌شوید، صفحه‌ای با عنوان مرتبط دارد. برای رشد باید
          سراغ بهبود همان صفحه‌ها بروید، نه نوشتن صفحه‌ی تازه.
        </div>
      ) : (
        <>
          <div className="opp-summary">
            <div className="stat">
              <div className="stat-label">عبارت بدون صفحه</div>
              <div className="stat-value">{formatNumber(gaps.length)}</div>
              <div className="stat-hint">کاندید محتوای تازه</div>
            </div>
            <div className="stat">
              <div className="stat-label">کلیک ممکن</div>
              <div className="stat-value">{formatNumber(Math.round(totalMissed))}</div>
              <div className="stat-hint">
                اگر همه‌شان صفحه‌ی اختصاصی داشتند و به رتبه‌ی{' '}
                {formatNumber(GAP_TARGET_POSITION)} می‌رسیدند
              </div>
            </div>
          </div>

          <div className="table-scroll">
            <table className="data-table opp-table">
              <thead>
                <tr>
                  <th>
                    <span className="th-plain">عبارت</span>
                  </th>
                  <th className="th-numeric">
                    <span className="th-plain">نمایش</span>
                  </th>
                  <th className="th-numeric">
                    <span className="th-plain">کلیک</span>
                  </th>
                  <th className="th-numeric">
                    <span className="th-plain">CTR</span>
                  </th>
                  <th className="th-numeric">
                    <span className="th-plain">موقعیت</span>
                  </th>
                  <th title="نزدیک‌ترین صفحه‌ای که در سایت دارید و چقدر از کلمات این عبارت را پوشش می‌دهد">
                    <span className="th-plain">نزدیک‌ترین صفحه</span>
                  </th>
                  <th
                    className="th-numeric"
                    title={`نمایش × (CTR انتظاری در رتبه‌ی ${GAP_TARGET_POSITION} − CTR فعلی)`}
                  >
                    <span className="th-plain">کلیک ممکن</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {gaps.slice(0, visible).map((gap: ContentGap) => {
                  const open = expanded === gap.query
                  const ranking = pagesByQuery.get(gap.query) ?? []
                  return [
                    <tr key={gap.query} className={open ? 'opp-row-open' : undefined}>
                      <td className="cell-query">
                        <div className="opp-page-cell gap-query-cell">
                          <button
                            className="opp-caret"
                            onClick={() => setExpanded(open ? null : gap.query)}
                            aria-expanded={open}
                            title="دیدن صفحه‌هایی که الان برای این عبارت دیده می‌شوند"
                            aria-label="صفحه‌های فعلی این عبارت"
                          >
                            {open ? '▾' : '◂'}
                          </button>
                          <span>{gap.query}</span>
                        </div>
                      </td>
                      <td className="cell-num">{formatNumber(gap.impressions)}</td>
                      <td className="cell-num">{formatNumber(gap.clicks)}</td>
                      <td className="cell-num">{formatCtr(gap.ctr)}</td>
                      <td className="cell-num">{formatPosition(gap.position)}</td>
                      <td className="cell-page">
                        {gap.nearestPage ? (
                          <>
                            <span className="gap-coverage">
                              {percentFa.format(gap.nearestCoverage * 100)}٪
                            </span>
                            <span className="gap-near-title">{gap.nearestPage.title}</span>
                          </>
                        ) : (
                          <span className="faint">هیچ صفحه‌ی نزدیکی نیست</span>
                        )}
                      </td>
                      <td className="cell-num opp-missed">
                        {formatNumber(Math.round(gap.missedClicks))}
                      </td>
                    </tr>,
                    open && (
                      <tr key={`${gap.query}::detail`} className="opp-detail-row">
                        <td colSpan={7}>
                          <div className="opp-detail">
                            <div className="field-label">
                              الان با کدام صفحه‌ها برای این عبارت دیده می‌شوید
                            </div>
                            <div className="table-scroll" style={{ maxHeight: 240 }}>
                              <table className="data-table opp-query-table">
                                <thead>
                                  <tr>
                                    <th className="th-ltr">
                                      <span className="th-plain">صفحه</span>
                                    </th>
                                    <th className="th-numeric">
                                      <span className="th-plain">نمایش</span>
                                    </th>
                                    <th className="th-numeric">
                                      <span className="th-plain">کلیک</span>
                                    </th>
                                    <th className="th-numeric">
                                      <span className="th-plain">موقعیت</span>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ranking.map((row) => (
                                    <tr key={row.page}>
                                      <td className="cell-page">
                                        <PageLink url={row.page} />
                                      </td>
                                      <td className="cell-num">
                                        {formatNumber(row.impressions)}
                                      </td>
                                      <td className="cell-num">{formatNumber(row.clicks)}</td>
                                      <td className="cell-num">
                                        {formatPosition(row.position)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {gap.nearestPage && (
                              <p className="filter-hint">
                                نزدیک‌ترین صفحه‌ی موجود از نظر عنوان:{' '}
                                <PageLink url={gap.nearestPage.url} /> —{' '}
                                {percentFa.format(gap.nearestCoverage * 100)}٪ از کلمات این
                                عبارت در عنوانش هست. اگر به نظرتان همان صفحه باید جواب این
                                عبارت را بدهد، به‌جای نوشتن صفحه‌ی تازه همان را کامل کنید.
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    ),
                  ]
                })}
              </tbody>
            </table>
          </div>

          {visible < gaps.length && (
            <div className="pagination">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setVisible((v) => v + PAGE_STEP)}
              >
                نمایش بیشتر
              </button>
              <span className="faint">
                {formatNumber(visible)} از {formatNumber(gaps.length)}
              </span>
            </div>
          )}

          <p className="filter-hint opp-caveat">
            سه چیز را قبل از نوشتن در نظر بگیرید. <strong>یک:</strong> ابزار نمی‌داند چه
            چیزی به کسب‌وکار شما مربوط است — عبارتی که اتفاقی رویتان افتاده لزوماً ارزش
            محتوا ندارد. <strong>دو:</strong> ستون «نزدیک‌ترین صفحه» را ببینید؛ گاهی صفحه
            هست و فقط عنوانش این کلمات را ندارد، که آن وقت کاملش کنید بهتر از نوشتن
            صفحه‌ی تازه است (و از کانیبالیزیشن جلوگیری می‌کند). <strong>سه:</strong> گوگل
            بخش بزرگی از عبارت‌ها را اصلاً گزارش نمی‌کند، پس این فهرست کامل نیست و
            عبارت‌های کم‌حجم‌تر در آن نیستند.
          </p>
        </>
      )}
    </div>
  )
}
