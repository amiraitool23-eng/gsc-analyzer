import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import type { GscPageRow, SiteTotals } from '../types'
import type { ComparedRow } from '../lib/compare'
import { mergeForCompare, totalsDelta } from '../lib/compare'
import { computeTotals, formatCtr, formatNumber, formatPosition } from '../lib/metrics'
import { DeltaCount, DeltaPosition } from './Delta'
import { CoverageNotice } from './CoverageNotice'
import { SummaryCards } from './SummaryCards'

/** سطری که هر دو نما را پوشش می‌دهد؛ در نمای صفحه‌محور `query` وجود ندارد. */
export type TableRow = GscPageRow & { query?: string }

export type SortKey =
  | 'page'
  | 'query'
  | 'clicks'
  | 'impressions'
  | 'ctr'
  | 'position'
  | 'deltaClicks'
  | 'deltaPosition'
type SortDir = 'asc' | 'desc'

interface Column {
  key: SortKey
  label: string
  numeric: boolean
  /** ستون آدرس صفحه محتوای LTR دارد؛ عنوانش هم باید هم‌راستای همان محتوا باشد */
  ltr?: boolean
  /** جهت پیش‌فرض هنگام اولین کلیک روی این ستون */
  defaultDir: SortDir
  title?: string
}

const COLUMNS: Column[] = [
  { key: 'page', label: 'صفحه', numeric: false, defaultDir: 'asc', ltr: true },
  { key: 'query', label: 'کوئری', numeric: false, defaultDir: 'asc' },
  { key: 'clicks', label: 'کلیک', numeric: true, defaultDir: 'desc' },
  { key: 'impressions', label: 'نمایش', numeric: true, defaultDir: 'desc' },
  {
    key: 'ctr',
    label: 'CTR',
    numeric: true,
    defaultDir: 'desc',
    title: 'نرخ کلیک: کلیک ÷ نمایش',
  },
  {
    key: 'position',
    label: 'موقعیت',
    numeric: true,
    defaultDir: 'asc',
    title: 'میانگین موقعیت — عدد کوچک‌تر بهتر است',
  },
]

/** ستون‌هایی که فقط در حالت مقایسه اضافه می‌شوند */
const COMPARE_COLUMNS: Column[] = [
  {
    key: 'deltaClicks',
    label: 'تغییر کلیک',
    numeric: true,
    defaultDir: 'desc',
    title: 'نسبت به دوره‌ی قبل — برای دیدن بیشترین افت، صعودی مرتب کنید',
  },
  {
    key: 'deltaPosition',
    label: 'تغییر موقعیت',
    numeric: true,
    defaultDir: 'desc',
    title: 'نسبت به دوره‌ی قبل — مثبت یعنی رتبه بهتر شده',
  },
]

const PAGE_SIZES = [25, 50, 100, 250]

/**
 * سطری که در دوره‌ی قبل بوده ولی در دوره‌ی فعلی هیچ نمایشی نگرفته.
 * موقعیتش بی‌معنی است (آخرین مقدار شناخته‌شده را نگه داشته‌ایم) و نباید
 * به‌عنوان رتبه‌ی فعلی نشان داده شود.
 */
const vanished = (row: ComparedRow) => Boolean(row.prev) && row.impressions === 0

interface Props {
  rows: TableRow[]
  /** آمار کل پراپرتی، برای مقایسه با جمع سطرهای جدول */
  siteTotals: SiteTotals | undefined
  /** کدام نما؛ ستون کوئری و متن توضیح پوشش به این بستگی دارد */
  variant: 'page' | 'query'
  /** سطرهای دوره‌ی قبل؛ بودنش یعنی حالت مقایسه روشن است */
  previousRows?: TableRow[]
}

export function DataTable({ rows, siteTotals, variant, previousRows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('clicks')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [query, setQuery] = useState('')
  const [pageSize, setPageSize] = useState(50)
  const [pageIndex, setPageIndex] = useState(0)

  // فیلتر روی ده‌ها هزار سطر سنگین است؛ با useDeferredValue تایپ کردن کند نمی‌شود.
  const deferredQuery = useDeferredValue(query)

  const comparing = previousRows !== undefined

  // در حالت مقایسه، سطرهای ناپدیدشده‌ی دوره‌ی قبل هم اضافه می‌شوند
  const allRows: ComparedRow[] = useMemo(
    () =>
      previousRows
        ? mergeForCompare(rows, previousRows)
        : (rows as ComparedRow[]),
    [rows, previousRows],
  )

  const columns = useMemo(() => {
    const base = variant === 'query' ? COLUMNS : COLUMNS.filter((c) => c.key !== 'query')
    return comparing ? [...base, ...COMPARE_COLUMNS] : base
  }, [variant, comparing])

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase()
    if (!needle) return allRows
    return allRows.filter(
      (row) =>
        (row.query ?? '').toLowerCase().includes(needle) ||
        row.page.toLowerCase().includes(needle),
    )
  }, [allRows, deferredQuery])

  const sorted = useMemo(() => {
    const factor = sortDir === 'asc' ? 1 : -1
    const copy = filtered.slice()
    if (sortKey === 'page' || sortKey === 'query') {
      copy.sort(
        (a, b) => factor * (a[sortKey] ?? '').localeCompare(b[sortKey] ?? '', 'fa'),
      )
    } else {
      copy.sort((a, b) => factor * ((a[sortKey] ?? 0) - (b[sortKey] ?? 0)))
    }
    return copy
  }, [filtered, sortKey, sortDir])

  const totals = useMemo(() => computeTotals(filtered), [filtered])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(pageIndex, pageCount - 1)
  const visible = useMemo(
    () => sorted.slice(safePage * pageSize, safePage * pageSize + pageSize),
    [sorted, safePage, pageSize],
  )

  // با تغییر فیلتر/مرتب‌سازی/اندازه‌ی صفحه به صفحه‌ی اول برگرد
  useEffect(() => {
    setPageIndex(0)
  }, [deferredQuery, sortKey, sortDir, pageSize])

  const toggleSort = (column: Column) => {
    if (column.key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(column.key)
      setSortDir(column.defaultDir)
    }
  }

  // مقایسه‌ی پوشش همیشه با جمع کل سطرها معنی دارد، نه با نتیجه‌ی فیلتر
  const unfilteredTotals = useMemo(() => computeTotals(rows), [rows])
  const previousTotals = useMemo(
    () => (previousRows ? computeTotals(previousRows) : undefined),
    [previousRows],
  )
  const delta = useMemo(
    () => (previousTotals ? totalsDelta(totals, previousTotals) : undefined),
    [totals, previousTotals],
  )

  return (
    <div className="progress" style={{ gap: 16 }}>
      <CoverageNotice site={siteTotals} table={unfilteredTotals} variant={variant} />
      <SummaryCards
        totals={totals}
        filtered={deferredQuery.trim() !== ''}
        variant={variant}
        previous={previousTotals}
        delta={delta}
      />

      <div className="toolbar">
        <input
          className="search-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            variant === 'query' ? 'جست‌وجو در کوئری یا آدرس صفحه…' : 'جست‌وجو در آدرس صفحه…'
          }
          aria-label="جست‌وجو در سطرها"
        />
        <span className="faint">
          {formatNumber(sorted.length)} سطر از {formatNumber(allRows.length)}
        </span>
        <div className="toolbar-spacer" />
        <label className="faint">
          تعداد در صفحه:{' '}
          <select
            className="select"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {formatNumber(size)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((column) => {
                  const active = column.key === sortKey
                  return (
                    <th
                      key={column.key}
                      className={
                        [column.numeric ? 'th-numeric' : '', column.ltr ? 'th-ltr' : '']
                          .filter(Boolean)
                          .join(' ') || undefined
                      }
                      aria-sort={
                        active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
                      }
                      title={column.title}
                    >
                      <button className="th-button" onClick={() => toggleSort(column)}>
                        <span>{column.label}</span>
                        <span className={`sort-arrow${active ? '' : ' sort-arrow-idle'}`}>
                          {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      </button>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((row, i) => (
                <tr key={`${safePage}-${i}-${row.page}-${row.query ?? ''}`}>
                  <td className="cell-page" title={row.page}>
                    {row.page}
                  </td>
                  {variant === 'query' && <td className="cell-query">{row.query}</td>}
                  <td className="cell-num">{formatNumber(row.clicks)}</td>
                  <td className="cell-num">{formatNumber(row.impressions)}</td>
                  <td className="cell-num">{formatCtr(row.ctr)}</td>
                  <td className="cell-num">
                    {/* سطری که در دوره‌ی فعلی اصلاً نمایش نگرفته، موقعیت ندارد */}
                    {vanished(row) ? '—' : formatPosition(row.position)}
                  </td>
                  {comparing && (
                    <>
                      <td className="cell-num">
                        <DeltaCount
                          delta={row.deltaClicks}
                          previous={row.prev?.clicks}
                          isNew={!row.prev}
                        />
                      </td>
                      <td className="cell-num">
                        {vanished(row) ? (
                          <span className="delta delta-down">دیده نشد</span>
                        ) : (
                          <DeltaPosition delta={row.deltaPosition} isNew={!row.prev} />
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={columns.length}>
                    <div className="empty-state">سطری با این جست‌وجو پیدا نشد.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPageIndex(0)}
            disabled={safePage === 0}
          >
            ابتدا
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
          >
            قبلی
          </button>
          <span className="nums">
            صفحه‌ی {formatNumber(safePage + 1)} از {formatNumber(pageCount)}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPageIndex((p) => Math.min(pageCount - 1, p + 1))}
            disabled={safePage >= pageCount - 1}
          >
            بعدی
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setPageIndex(pageCount - 1)}
            disabled={safePage >= pageCount - 1}
          >
            انتها
          </button>
        </div>
      </div>
    </div>
  )
}
