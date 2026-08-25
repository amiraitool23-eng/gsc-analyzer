import { useEffect, useMemo, useState } from 'react'
import type { GscPageRow, GscRow } from '../types'
import { guessBrandTerms, makeBrandMatcher, normalizeForMatch } from '../lib/brand'
import {
  loadBrandTerms,
  loadConfirmedTerms,
  sameTerms,
  saveBrandTerms,
  saveConfirmedTerms,
} from '../lib/brandStore'
import { buildCtrCurve } from '../lib/ctrCurve'
import type { Confidence, Opportunity } from '../lib/opportunities'
import { findOpportunities } from '../lib/opportunities'
import { formatCtr, formatNumber, formatPosition } from '../lib/metrics'
import { PageLink } from './PageLink'

/**
 * «فرصت‌های بهبود CTR» — مرحله‌ی ۱ تا ۳ بهینه‌سازی محتوا.
 *
 * قاعده‌ی رایج «نمایش > ۱۰۰۰ و CTR < ۳٪» عمداً پیاده نشده، چون هر دو عدد به
 * اندازه‌ی سایت وابسته‌اند و CTR بدون موقعیت بی‌معنی است. به‌جایش:
 *   ۱) منحنی CTR بر حسب موقعیت از دادهٔ خود همین سایت ساخته می‌شود
 *   ۲) رتبه‌بندی با «کلیک از دست رفته» انجام می‌شود، نه با فیلتر آستانه‌ای
 *   ۳) برای هر صفحه گفته می‌شود این کم‌آوردن چقدر آماری معنادار است
 */

const gapFa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 })

const CONFIDENCE: Record<Confidence, { label: string; cls: string; title: string }> = {
  high: {
    label: 'بالا',
    cls: 'conf-high',
    title: 'اختلاف کلیک واقعی با انتظار آن‌قدر بزرگ است که به تصادف نمی‌خورد',
  },
  medium: {
    label: 'متوسط',
    cls: 'conf-medium',
    title: 'سیگنال معنادار است ولی حجم داده زیاد نیست؛ ارزش بررسی دارد',
  },
  low: {
    label: 'کم',
    cls: 'conf-low',
    title: 'داده‌ی این صفحه کم است و همین اختلاف می‌تواند نوسان تصادفی باشد',
  },
}

const PAGE_STEP = 25

interface Props {
  siteUrl: string
  /** نمای صفحه‌محور — فرصت‌ها روی این سطرها حساب می‌شوند */
  pageRows: GscPageRow[] | undefined
  /** نمای کوئری‌محور — منحنی CTR و کوئری‌های هر صفحه از این می‌آید */
  queryRows: GscRow[]
}

export function OpportunitiesPanel({ siteUrl, pageRows, queryRows }: Props) {
  const [brandTerms, setBrandTerms] = useState<string[]>(() => loadBrandTerms(siteUrl))
  // کلماتی که فرصت‌های روی صفحه بر اساسشان حساب شده‌اند. null یعنی کاربر هنوز
  // تأیید نکرده و اصلاً نباید فهرستی نشان داده شود.
  const [appliedTerms, setAppliedTerms] = useState<string[] | null>(() =>
    loadConfirmedTerms(siteUrl),
  )
  const [draftTerm, setDraftTerm] = useState('')
  const [onlyMeaningful, setOnlyMeaningful] = useState(true)
  const [visible, setVisible] = useState(PAGE_STEP)
  const [expanded, setExpanded] = useState<string | null>(null)

  // عوض شدن پراپرتی یعنی فهرست برند دیگری؛ حالت قبلی نباید بماند
  useEffect(() => {
    setBrandTerms(loadBrandTerms(siteUrl))
    setAppliedTerms(loadConfirmedTerms(siteUrl))
    setExpanded(null)
    setVisible(PAGE_STEP)
  }, [siteUrl])

  // منحنی و فرصت‌ها از کلماتِ **تأییدشده** می‌آیند، نه از چیزی که در حال تایپ است
  const applied = appliedTerms ?? []
  const isBrand = useMemo(() => makeBrandMatcher(applied), [appliedTerms])
  const curve = useMemo(() => buildCtrCurve(queryRows, isBrand), [queryRows, isBrand])
  const all = useMemo(
    () => findOpportunities(pageRows ?? [], curve),
    [pageRows, curve],
  )

  const confirmed = appliedTerms !== null
  const stale = confirmed && !sameTerms(appliedTerms, brandTerms)

  const applyTerms = () => {
    saveConfirmedTerms(siteUrl, brandTerms)
    setAppliedTerms(brandTerms)
    setExpanded(null)
    setVisible(PAGE_STEP)
  }

  /**
   * پیشنهاد کلمه‌ی برند از دادهٔ خود کاربر.
   *
   * ابزار نام فارسی برند را از دامنه نمی‌تواند دربیاورد، ولی می‌تواند جایی را نشان
   * دهد که آن نام تقریباً حتماً آنجاست: کوئری‌هایی که در رتبه‌های صدر CTR غیرعادی
   * بالایی دارند. کلیک روی هرکدام، متن را در کادر ورودی می‌گذارد تا کاربر خودش
   * فقط بخشِ برند را نگه دارد — نه اینکه ابزار کل عبارت را کلمه‌ی برند فرض کند.
   */
  const brandCandidates = useMemo(() => {
    const matcher = makeBrandMatcher(brandTerms)
    const byQuery = new Map<string, { clicks: number; impressions: number; weightedPos: number }>()
    for (const row of queryRows) {
      if (row.impressions <= 0 || matcher(row.query)) continue
      const agg = byQuery.get(row.query) ?? { clicks: 0, impressions: 0, weightedPos: 0 }
      agg.clicks += row.clicks
      agg.impressions += row.impressions
      agg.weightedPos += row.position * row.impressions
      byQuery.set(row.query, agg)
    }
    return [...byQuery.entries()]
      .map(([query, a]) => ({
        query,
        ctr: a.clicks / a.impressions,
        impressions: a.impressions,
        position: a.weightedPos / a.impressions,
      }))
      .filter((c) => c.position <= 5 && c.impressions >= 20 && c.ctr >= 0.2)
      .sort((a, b) => b.ctr - a.ctr)
      .slice(0, 8)
  }, [queryRows, brandTerms])

  const shown: Opportunity[] = useMemo(
    () => (onlyMeaningful ? all.filter((o) => o.confidence !== 'low') : all),
    [all, onlyMeaningful],
  )
  const hiddenByConfidence = all.length - shown.length

  // کوئری‌های هر صفحه، برای بازکردن سطر
  const queriesByPage = useMemo(() => {
    const map = new Map<string, GscRow[]>()
    for (const row of queryRows) {
      const list = map.get(row.page)
      if (list) list.push(row)
      else map.set(row.page, [row])
    }
    for (const list of map.values()) list.sort((a, b) => b.impressions - a.impressions)
    return map
  }, [queryRows])

  const totalMissed = useMemo(
    () => shown.reduce((sum, o) => sum + o.missedClicks, 0),
    [shown],
  )

  const updateTerms = (next: string[]) => {
    setBrandTerms(next)
    saveBrandTerms(siteUrl, next)
  }

  const addTerm = () => {
    const value = draftTerm.trim()
    if (value === '') return
    // هم‌ارزی با همان معیار تطبیق سنجیده می‌شود: «کفش ایران» و «کفش‌ایران» یکی‌اند
    const key = normalizeForMatch(value)
    if (key === '' || brandTerms.some((t) => normalizeForMatch(t) === key)) {
      setDraftTerm('')
      return
    }
    updateTerms([...brandTerms, value])
    setDraftTerm('')
  }

  if (!pageRows) {
    return (
      <div className="card">
        <div className="empty-state">
          نمای صفحه‌محور برای این گزارش هنوز گرفته نشده. «به‌روزرسانی داده» را بزنید.
        </div>
      </div>
    )
  }

  return (
    <div className="card opp-card">
      <div className="card-title">فرصت‌های بهبود CTR</div>
      <p className="card-desc">
        این فهرست صفحه‌هایی را نشان می‌دهد که <strong>کمتر از موقعیتشان</strong> کلیک
        می‌گیرند. معیار، آستانه‌ی ثابت نیست: ابزار منحنی «CTR در برابر موقعیت» را از داده‌ی
        خود همین سایت می‌سازد و هر صفحه را با صفحه‌های هم‌رتبه‌ی خودتان می‌سنجد. ترتیب هم
        بر اساس <strong>کلیک از دست رفته</strong> است، تا صفحه‌ی پرنمایش با فاصله‌ی کم،
        بالاتر از صفحه‌ی کم‌نمایش با فاصله‌ی زیاد بیاید.
      </p>

      {/* ---------- کلمات برند ---------- */}
      <div className="opp-brand">
        <div className="field-label">کلمات برند (از منحنی کنار گذاشته می‌شوند)</div>
        <p className="filter-hint">
          کوئری برند CTR خیلی بالایی دارد چون کاربر از قبل دنبال شما بوده. اگر در منحنی
          بماند، سقف انتظار به‌شکل کاذب بالا می‌رود و بعد همه‌ی صفحه‌ها «ضعیف» به نظر
          می‌رسند. ابزار از روی دامنه حدس زده؛ نام فارسی برند را خودتان اضافه کنید.
        </p>
        <div className="filters-bar opp-chips">
          {brandTerms.length === 0 && (
            <span className="faint">هیچ کلمه‌ی برندی تعریف نشده — همه‌ی کوئری‌ها در منحنی می‌مانند.</span>
          )}
          {brandTerms.map((term) => (
            <span className="filter-chip" key={term}>
              <span className="ltr">{term}</span>
              <button
                className="filter-chip-x"
                onClick={() => updateTerms(brandTerms.filter((t) => t !== term))}
                aria-label={`حذف ${term}`}
                title={`حذف ${term}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="opp-brand-add">
          <input
            className="filter-input"
            value={draftTerm}
            onChange={(e) => setDraftTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTerm()
              }
            }}
            placeholder="مثلاً نام فارسی برندتان"
            aria-label="افزودن کلمه‌ی برند"
          />
          <button className="btn btn-secondary btn-sm" onClick={addTerm}>
            افزودن
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => updateTerms(guessBrandTerms(siteUrl))}
            title="برگرداندن فهرست به حدس خودکار ابزار"
          >
            بازگرداندن حدس خودکار
          </button>
        </div>

        {brandCandidates.length > 0 && (
          <div className="opp-suggest">
            <div className="field-label">شاید این‌ها برند شما باشند</div>
            <p className="filter-hint">
              این کوئری‌ها در رتبه‌های صدر CTR غیرعادی بالایی دارند — نشانه‌ی معمولِ
              جست‌وجوی برند. روی هرکدام بزنید تا در کادر بالا بیاید، بعد فقط
              <strong> بخشِ نام برند</strong> را نگه دارید و «افزودن» را بزنید.
            </p>
            <div className="filters-bar opp-chips">
              {brandCandidates.map((c) => (
                <button
                  key={c.query}
                  className="opp-suggest-chip"
                  onClick={() => setDraftTerm(c.query)}
                  title={`CTR ${formatCtr(c.ctr)} در موقعیت ${formatPosition(c.position)} با ${formatNumber(c.impressions)} نمایش`}
                >
                  {c.query}
                  <span className="opp-suggest-ctr">{formatCtr(c.ctr)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---------- دروازه‌ی تأیید ---------- */}
      {(!confirmed || stale) && (
        <div className={`alert ${stale ? 'alert-warn' : 'alert-info'}`} role="status">
          <div className="alert-title">
            {stale ? 'کلمات برند عوض شد' : 'قبل از دیدن فرصت‌ها، کلمات برند را کامل کنید'}
          </div>
          <p className="alert-body">
            {stale
              ? 'فهرست پایین هنوز بر اساس کلمات قبلی است. برای اعمال تغییر، دکمه را بزنید.'
              : 'ابزار فقط می‌تواند بخش لاتین برند را از دامنه حدس بزند؛ نام فارسی برند را از دامنه نمی‌شود درآورد. اگر کوئری‌های برند در محاسبه بمانند، سقف انتظار کاذب بالا می‌رود و نتیجه گمراه‌کننده می‌شود. کلمات بالا را کامل کنید و بعد این دکمه را بزنید.'}
          </p>
          <div className="alert-actions">
            <button className="btn btn-primary" onClick={applyTerms}>
              {stale ? 'به‌روزرسانی فرصت‌ها' : 'نمایش فرصت‌ها'}
            </button>
          </div>
        </div>
      )}

      {/* ---------- وضعیت منحنی ---------- */}
      {confirmed && (!curve.available ? (
        <div className="alert alert-warn" role="status">
          <div className="alert-title">منحنی CTR ساخته نشد</div>
          <p className="alert-body">
            برای ساختن منحنی، داده‌ی کوئری‌محور در دست‌کم دو بازه‌ی موقعیت (هرکدام ۵ کوئری
            یا بیشتر) لازم است و این گزارش آن را ندارد. بازه‌ی زمانی بلندتری انتخاب کنید یا
            اگر همه‌ی کوئری‌ها را برند علامت زده‌اید، فهرست برند را کوتاه‌تر کنید.
          </p>
        </div>
      ) : (
        <details className="opp-curve">
          <summary>
            منحنی از {formatNumber(curve.rowsUsed)} کوئری غیربرند ساخته شد
            {curve.brandRowsExcluded > 0
              ? ` (${formatNumber(curve.brandRowsExcluded)} کوئری برند کنار گذاشته شد)`
              : ''}
            {' '}— دیدن منحنی
          </summary>
          <div className="table-scroll" style={{ maxHeight: 300, marginTop: 12 }}>
            <table className="data-table opp-curve-table">
              <thead>
                <tr>
                  <th className="th-numeric">
                    <span className="th-plain">موقعیت</span>
                  </th>
                  <th className="th-numeric">
                    <span className="th-plain">CTR انتظاری</span>
                  </th>
                  <th className="th-numeric">
                    <span className="th-plain">نمایش</span>
                  </th>
                  <th className="th-numeric">
                    <span className="th-plain">تعداد کوئری</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {curve.points.map((p) => (
                  <tr key={p.position}>
                    <td className="cell-num">{formatPosition(p.position)}</td>
                    <td className="cell-num">
                      {formatCtr(p.ctr)}
                      {p.pooled && (
                        <span
                          className="opp-pooled"
                          title={`خام ${formatCtr(p.rawCtr)} — روی داده‌ی کم ایستاده بود و با بازه‌های مجاور ادغام شد`}
                        >
                          ٭
                        </span>
                      )}
                    </td>
                    <td className="cell-num">{formatNumber(p.impressions)}</td>
                    <td className="cell-num">{formatNumber(p.rows)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="filter-hint">
            هر سطر یک بازه‌ی رتبه است: CTR آن از تقسیم کل کلیک بر کل نمایشِ همان بازه
            می‌آید (نه میانگین ستون CTR). CTR انتظاری هر صفحه با درون‌یابی بین همین
            نقطه‌ها به دست می‌آید.
          </p>
          <p className="filter-hint">
            سطرهای علامت‌دار (٭) با بازه‌های مجاورشان ادغام شده‌اند. دلیلش این است که
            CTR با بدتر شدن رتبه نباید بالا برود؛ بازه‌ی کم‌نمایشی که روی چند کلیک
            ایستاده می‌تواند خلاف این را نشان دهد و آن نویز است، نه سیگنال. عدد خام هر
            سطر را با نگه‌داشتن ماوس روی ٭ می‌بینید.
          </p>
        </details>
      ))}

      {/* ---------- فهرست فرصت‌ها ---------- */}
      {confirmed && curve.available && all.length === 0 && (
        <div className="empty-state">
          هیچ صفحه‌ای کمتر از انتظارِ موقعیتش کلیک نگرفته. یعنی CTR صفحه‌های شما با رتبه‌شان
          هماهنگ است و برای رشد باید سراغ بهبود رتبه بروید، نه عنوان و توضیحات.
        </div>
      )}

      {confirmed && curve.available && all.length > 0 && (
        <>
          <div className="opp-summary">
            <div className="stat">
              <div className="stat-label">فرصت پیدا شده</div>
              <div className="stat-value">{formatNumber(shown.length)}</div>
              <div className="stat-hint">صفحه‌ای که زیر انتظار کلیک گرفته</div>
            </div>
            <div className="stat">
              <div className="stat-label">کلیک از دست رفته</div>
              <div className="stat-value">{formatNumber(Math.round(totalMissed))}</div>
              <div className="stat-hint">
                تخمین، اگر همه‌ی این صفحه‌ها به CTR انتظاری برسند
              </div>
            </div>
          </div>

          <div className="filters-bar opp-controls">
            <label className="opp-toggle">
              <input
                type="checkbox"
                checked={onlyMeaningful}
                onChange={(e) => {
                  setOnlyMeaningful(e.target.checked)
                  setVisible(PAGE_STEP)
                }}
              />
              فقط فرصت‌های آماری معنادار
            </label>
            {onlyMeaningful && hiddenByConfidence > 0 && (
              <span className="faint">
                {formatNumber(hiddenByConfidence)} صفحه‌ی کم‌داده پنهان شد
              </span>
            )}
          </div>

          <div className="table-scroll">
            <table className="data-table opp-table">
              <thead>
                <tr>
                  <th className="th-ltr">
                    <span className="th-plain">صفحه</span>
                  </th>
                  <th className="th-numeric">
                    <span className="th-plain">کلیک</span>
                  </th>
                  <th className="th-numeric">
                    <span className="th-plain">نمایش</span>
                  </th>
                  <th className="th-numeric">
                    <span className="th-plain">موقعیت</span>
                  </th>
                  <th className="th-numeric" title="CTR واقعی این صفحه در این بازه">
                    <span className="th-plain">CTR فعلی</span>
                  </th>
                  <th
                    className="th-numeric"
                    title="CTR صفحه‌های هم‌رتبه‌ی خودتان، از منحنی این سایت"
                  >
                    <span className="th-plain">CTR انتظاری</span>
                  </th>
                  <th
                    className="th-numeric"
                    title="نمایش × (CTR انتظاری − CTR فعلی) — معیار اولویت‌بندی"
                  >
                    <span className="th-plain">کلیک از دست رفته</span>
                  </th>
                  <th className="th-numeric" title="این کم‌آوردن چقدر آماری معنادار است">
                    <span className="th-plain">اطمینان</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.slice(0, visible).map((o) => {
                  const open = expanded === o.page
                  const pageQueries = queriesByPage.get(o.page) ?? []
                  return [
                    <tr key={o.page} className={open ? 'opp-row-open' : undefined}>
                      <td className="cell-page">
                        <div className="opp-page-cell">
                          <button
                            className="opp-caret"
                            onClick={() => setExpanded(open ? null : o.page)}
                            aria-expanded={open}
                            title={
                              open
                                ? 'بستن کوئری‌های این صفحه'
                                : 'دیدن کوئری‌هایی که این صفحه با آن‌ها دیده شده'
                            }
                            aria-label="کوئری‌های این صفحه"
                          >
                            {open ? '▾' : '▸'}
                          </button>
                          <PageLink url={o.page} />
                        </div>
                      </td>
                      <td className="cell-num">{formatNumber(o.clicks)}</td>
                      <td className="cell-num">{formatNumber(o.impressions)}</td>
                      <td className="cell-num">{formatPosition(o.position)}</td>
                      <td className="cell-num">{formatCtr(o.ctr)}</td>
                      <td className="cell-num">{formatCtr(o.expectedCtr)}</td>
                      <td className="cell-num opp-missed">
                        {formatNumber(Math.round(o.missedClicks))}
                        <span className="opp-gap">
                          {gapFa.format(o.gapPoints)} واحد کمتر
                        </span>
                      </td>
                      <td className="cell-num">
                        <span
                          className={`opp-conf ${CONFIDENCE[o.confidence].cls}`}
                          title={CONFIDENCE[o.confidence].title}
                        >
                          {CONFIDENCE[o.confidence].label}
                        </span>
                      </td>
                    </tr>,
                    open && (
                      <tr key={`${o.page}::detail`} className="opp-detail-row">
                        <td colSpan={8}>
                          <div className="opp-detail">
                            <div className="field-label">
                              عبارت‌هایی که این صفحه با آن‌ها دیده شده
                            </div>
                            {pageQueries.length === 0 ? (
                              <p className="filter-hint">
                                برای این صفحه هیچ کوئری‌ای گزارش نشده — یعنی همه‌ی
                                نمایش‌هایش از کوئری‌های ناشناس آمده است.
                              </p>
                            ) : (
                              <>
                                <div className="table-scroll" style={{ maxHeight: 260 }}>
                                  <table className="data-table opp-query-table">
                                    <thead>
                                      <tr>
                                        <th>
                                          <span className="th-plain">کوئری</span>
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
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {pageQueries.slice(0, 25).map((q) => (
                                        <tr key={q.query}>
                                          <td className="cell-query">
                                            {q.query}
                                            {isBrand(q.query) && (
                                              <span className="opp-brand-tag">برند</span>
                                            )}
                                          </td>
                                          <td className="cell-num">
                                            {formatNumber(q.impressions)}
                                          </td>
                                          <td className="cell-num">
                                            {formatNumber(q.clicks)}
                                          </td>
                                          <td className="cell-num">{formatCtr(q.ctr)}</td>
                                          <td className="cell-num">
                                            {formatPosition(q.position)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                <p className="filter-hint">
                                  پرنمایش‌ترین‌ها بالا هستند. این‌ها همان عبارت‌هایی‌اند که
                                  عنوان و توضیحات صفحه باید جوابشان را بدهد. توجه: بخش
                                  بزرگی از نمایش‌های صفحه در بُعد کوئری گزارش نمی‌شود، پس
                                  جمع این جدول با نمایش صفحه نمی‌خواند.
                                </p>
                              </>
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

          {visible < shown.length && (
            <div className="pagination">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setVisible((v) => v + PAGE_STEP)}
              >
                نمایش {formatNumber(Math.min(PAGE_STEP, shown.length - visible))} مورد بعدی
              </button>
              <span className="faint">
                {formatNumber(visible)} از {formatNumber(shown.length)}
              </span>
            </div>
          )}

          <p className="filter-hint opp-caveat">
            این فهرست یک <strong>اولویت‌بندی</strong> است نه حکم. CTR پایین‌تر از انتظار
            همیشه یعنی عنوان بد نیست: نتایج ویژه‌ی گوگل (فیچرد اسنیپت، باکس تصویر، تبلیغ)،
            کوئری‌های اطلاعاتی که کاربر جوابش را در خود SERP می‌گیرد، و صفحه‌های خیلی
            نامرتبط با کوئری هم همین شکل را می‌سازند. قبل از بازنویسی عنوان، کوئری‌های همان
            صفحه را باز کنید و ببینید واقعاً برای چه چیزی دیده می‌شود.
          </p>
        </>
      )}
    </div>
  )
}
