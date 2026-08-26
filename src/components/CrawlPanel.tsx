import { useMemo, useRef, useState } from 'react'
import type { GscPageRow } from '../types'
import type { CrawlPage } from '../lib/crawlCsv'
import { joinCrawl, pagesWithoutImpressions } from '../lib/crawlJoin'
import type { LoadedCrawl } from '../lib/crawlStore'
import type { CrawlStatus } from '../hooks/useCrawl'
import { formatNumber } from '../lib/metrics'
import { formatRelativeFa } from '../lib/dates'
import { PageLink } from './PageLink'

/**
 * وارد کردن خروجی کراول (Screaming Frog و هم‌خانواده‌ها).
 *
 * سرچ کنسول می‌گوید مردم دنبال چه بودند و شما کجا دیده شدید؛ کراول می‌گوید شما
 * **چه چیزی دارید**. تا وقتی نیمه‌ی دوم نبود، سؤال «برای این عبارت صفحه داریم؟»
 * فقط با حدس جواب داده می‌شد.
 *
 * فایل با `File.text()` در همان مرورگر خوانده می‌شود و هیچ‌جا فرستاده نمی‌شود؛
 * فایلی که کاربر خودش انتخاب می‌کند درخواست شبکه نیست، پس با قاعده‌ی
 * «بدون بک‌اند» تضادی ندارد.
 *
 * قاعده‌ی مهم این کامپوننت: **نرخ تطبیق همیشه دیده می‌شود.** اگر آدرس‌ها به هم
 * نچسبند، هر تحلیلی که رویش بنشیند بی‌صدا غلط می‌شود.
 */

const percentFa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 })

/** زیر این نرخ، نتیجه قابل اتکا نیست و باید هشدار داد */
const GOOD_MATCH_RATE = 0.9

interface Props {
  siteUrl: string
  pageRows: GscPageRow[] | undefined
  crawl: LoadedCrawl | null
  status: CrawlStatus
  onImport: (file: File) => void
  onRemove: () => void
}

export function CrawlPanel({ siteUrl, pageRows, crawl, status, onImport, onRemove }: Props) {
  const [visible, setVisible] = useState(50)
  const fileInput = useRef<HTMLInputElement>(null)

  const report = useMemo(
    () => (crawl && pageRows ? joinCrawl(pageRows, crawl, siteUrl) : null),
    [crawl, pageRows, siteUrl],
  )

  const orphans: CrawlPage[] = useMemo(
    () => (crawl && pageRows ? pagesWithoutImpressions(pageRows, crawl, siteUrl) : []),
    [crawl, pageRows, siteUrl],
  )

  const picker = (
    <>
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        className="visually-hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onImport(file)
        }}
      />
      <button
        className="btn btn-primary"
        onClick={() => fileInput.current?.click()}
        disabled={status.kind === 'reading'}
      >
        {status.kind === 'reading'
          ? 'در حال خواندن…'
          : crawl
            ? 'جایگزینی با فایل تازه'
            : 'انتخاب فایل CSV'}
      </button>
    </>
  )

  return (
    <div className="card opp-card">
      <div className="card-title">محتوای سایت (از کراول)</div>
      <p className="card-desc">
        سرچ کنسول می‌گوید مردم دنبال چه بودند و شما کجا دیده شدید. کراول می‌گوید{' '}
        <strong>شما چه چیزی دارید</strong> — عنوان، H1 و تعداد کلمه‌ی هر صفحه، و مهم‌تر
        از همه فهرست کامل صفحه‌ها، حتی آن‌هایی که هیچ نمایشی نگرفته‌اند و در هیچ گزارش
        سرچ کنسولی نیستند. فایل در همین مرورگر خوانده می‌شود و جایی فرستاده نمی‌شود.
      </p>

      {status.kind === 'error' && (
        <div className="alert alert-error" role="alert">
          <div className="alert-title">فایل خوانده نشد</div>
          <p className="alert-body">{status.message}</p>
        </div>
      )}

      {!crawl && (
        <div className="crawl-empty">
          <details className="opp-curve" open>
            <summary>چطور این فایل را بسازم؟</summary>
            <ol className="tip-list">
              <li>در Screaming Frog کل سایت را کراول کنید و صبر کنید ۱۰۰٪ تمام شود.</li>
              <li>
                تب <strong>Internal</strong> را باز کنید و فیلتر بالای جدول را روی{' '}
                <strong>HTML</strong> بگذارید.
              </li>
              <li>
                دکمه‌ی <strong>Export</strong> همان جدول را بزنید و فرمت{' '}
                <strong>CSV</strong> را انتخاب کنید.
              </li>
              <li>
                فایل را با اکسل باز و ذخیره نکنید — متن فارسی خراب می‌شود. همان فایل خام
                را اینجا بدهید.
              </li>
            </ol>
            <p className="filter-hint">
              نام ستون‌ها اگر فارسی هم باشد («عنوان ۱») شناسایی می‌شود. متن کامل صفحه‌ها
              لازم نیست؛ عنوان و H1 برای این تحلیل‌ها کافی است.
            </p>
          </details>
          <div className="opp-brand-add">{picker}</div>
        </div>
      )}

      {crawl && (
        <>
          <div className="filters-bar opp-controls">
            <span className="faint">
              {crawl.fileName} — {formatNumber(crawl.pages.length)} صفحه،{' '}
              {formatRelativeFa(crawl.importedAt)}
            </span>
            <div className="toolbar-spacer" />
            {picker}
            <button className="btn btn-ghost btn-sm" onClick={() => {
                onRemove()
                if (fileInput.current) fileInput.current.value = ''
              }}>
              حذف کراول
            </button>
          </div>

          {!pageRows && (
            <div className="empty-state">
              برای تطبیق، گزارش صفحه‌محور لازم است. «به‌روزرسانی داده» را بزنید.
            </div>
          )}

          {report && (
            <>
              <div
                className={`alert ${report.matchRate >= GOOD_MATCH_RATE ? 'alert-ok' : 'alert-warn'}`}
              >
                <div className="alert-title">
                  {formatNumber(report.matched)} صفحه از {formatNumber(report.gscPages)} صفحه‌ی
                  سرچ کنسول در کراول پیدا شد ({percentFa.format(report.matchRate * 100)}٪)
                </div>
                <p className="alert-body">
                  {report.matchRate >= GOOD_MATCH_RATE
                    ? 'آدرس‌های دو منبع به هم می‌خورند، پس تحلیل‌های ترکیبی قابل اتکا هستند.'
                    : 'نرخ تطبیق پایین است. یعنی بخشی از صفحه‌ها به هم وصل نشده‌اند و هر تحلیلی که به محتوا نیاز دارد ناقص خواهد بود. معمولاً یعنی کراول همه‌ی سایت را نگرفته، یا با پراپرتی دیگری انجام شده.'}
                </p>
                <ul className="tip-list">
                  <li>
                    صفحه‌های کراول‌شده در محدوده‌ی این پراپرتی:{' '}
                    <strong>{formatNumber(report.crawlPages)}</strong>
                  </li>
                  {report.outOfScope > 0 && (
                    <li>
                      بیرون از این پراپرتی و کنار گذاشته شد:{' '}
                      <strong>{formatNumber(report.outOfScope)}</strong> — کراول شما میزبان
                      دیگری هم داشته که این پراپرتی پوششش نمی‌دهد.
                    </li>
                  )}
                  {report.paramMismatches > 0 && (
                    <li>
                      <strong>{formatNumber(report.paramMismatches)}</strong> آدرس فقط
                      به‌خاطر پارامترهای انتهای آدرس مچ نشد (مثل{' '}
                      <span className="ltr">?page=2</span>). این‌ها عمداً یکی شمرده
                      نمی‌شوند چون صفحه‌ی متفاوتی‌اند.
                    </li>
                  )}
                </ul>
                {report.unmatchedSample.length > 0 && (
                  <details className="opp-curve">
                    <summary>نمونه‌ی آدرس‌هایی که در کراول پیدا نشدند</summary>
                    <ul className="crawl-sample">
                      {report.unmatchedSample.map((url) => (
                        <li key={url}>
                          <PageLink url={url} />
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>

              <div className="opp-summary">
                <div className="stat">
                  <div className="stat-label">صفحه‌های کراول‌شده</div>
                  <div className="stat-value">{formatNumber(report.crawlPages)}</div>
                  <div className="stat-hint">در محدوده‌ی این پراپرتی</div>
                </div>
                <div className="stat">
                  <div className="stat-label">بدون هیچ نمایشی</div>
                  <div className="stat-value">{formatNumber(orphans.length)}</div>
                  <div className="stat-hint">در این بازه حتی یک بار هم دیده نشده‌اند</div>
                </div>
              </div>

              {orphans.length > 0 && (
                <>
                  <p className="card-desc">
                    این صفحه‌ها وجود دارند ولی در بازه‌ی انتخابی <strong>هیچ نمایشی</strong>{' '}
                    نگرفته‌اند — یعنی گوگل عملاً هیچ‌وقت نشانشان نداده. این دسته با سرچ
                    کنسول تنها اصلاً قابل دیدن نبود، چون چیزی که نمایش ندارد در هیچ
                    گزارشی نیست. قبل از قضاوت، بازه‌ی زمانی را هم در نظر بگیرید: صفحه‌ی
                    تازه‌منتشرشده طبیعتاً هنوز چیزی نگرفته.
                  </p>
                  <div className="table-scroll">
                    <table className="data-table opp-table">
                      <thead>
                        <tr>
                          <th className="th-ltr">
                            <span className="th-plain">صفحه</span>
                          </th>
                          <th>
                            <span className="th-plain">عنوان</span>
                          </th>
                          <th className="th-numeric">
                            <span className="th-plain">کلمه</span>
                          </th>
                          <th>
                            <span className="th-plain">وضعیت اندکس</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {orphans.slice(0, visible).map((page) => (
                          <tr key={page.key}>
                            <td className="cell-page">
                              <PageLink url={page.url} />
                            </td>
                            <td className="cell-query">{page.title || '—'}</td>
                            <td className="cell-num">
                              {page.wordCount === null ? '—' : formatNumber(page.wordCount)}
                            </td>
                            <td>
                              {/non-index/i.test(page.indexability) ? (
                                <span className="opp-conf conf-low">{page.indexability}</span>
                              ) : (
                                <span className="faint">{page.indexability || '—'}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {visible < orphans.length && (
                    <div className="pagination">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setVisible((v) => v + 50)}
                      >
                        نمایش بیشتر
                      </button>
                      <span className="faint">
                        {formatNumber(visible)} از {formatNumber(orphans.length)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
