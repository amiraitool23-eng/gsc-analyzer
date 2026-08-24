import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import type { GscRow, SiteTotals } from '../types'
import { computeTotals, formatCtr, formatNumber, formatPosition } from '../lib/metrics'
import { CoverageNotice } from './CoverageNotice'
import { SummaryCards } from './SummaryCards'

export type SortKey = keyof Pick<
  GscRow,
  'page' | 'query' | 'clicks' | 'impressions' | 'ctr' | 'position'
>
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

const PAGE_SIZES = [25, 50, 100, 250]

interface Props {
  rows: GscRow[]
  /** آمار کل پراپرتی، برای مقایسه با جمع سطرهای جدول */
  siteTotals: SiteTotals | undefined
}

export function DataTable({ rows, siteTotals }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('clicks')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [query, setQuery] = useState('')
  const [pageSize, setPageSize] = useState(50)
  const [pageIndex, setPageIndex] = useState(0)

  // فیلتر روی ده‌ها هزار سطر سنگین است؛ با useDeferredValue تایپ کردن کند نمی‌شود.
  const deferredQuery = useDeferredValue(query)

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(
      (row) =>
        row.query.toLowerCase().includes(needle) || row.page.toLowerCase().includes(needle),
    )
  }, [rows, deferredQuery])

  const sorted = useMemo(() => {
    const factor = sortDir === 'asc' ? 1 : -1
    const copy = filtered.slice()
    if (sortKey === 'page' || sortKey === 'query') {
      copy.sort((a, b) => factor * a[sortKey].localeCompare(b[sortKey], 'fa'))
    } else {
      copy.sort((a, b) => factor * (a[sortKey] - b[sortKey]))
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

  return (
    <div className="progress" style={{ gap: 16 }}>
      <CoverageNotice site={siteTotals} table={unfilteredTotals} />
      <SummaryCards totals={totals} filtered={deferredQuery.trim() !== ''} />

      <div className="toolbar">
        <input
          className="search-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجو در کوئری یا آدرس صفحه…"
          aria-label="جست‌وجو در سطرها"
        />
        <span className="faint">
          {formatNumber(sorted.length)} سطر از {formatNumber(rows.length)}
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
                {COLUMNS.map((column) => {
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
                <tr key={`${safePage}-${i}-${row.page}-${row.query}`}>
                  <td className="cell-page" title={row.page}>
                    {row.page}
                  </td>
                  <td className="cell-query">{row.query}</td>
                  <td className="cell-num">{formatNumber(row.clicks)}</td>
                  <td className="cell-num">{formatNumber(row.impressions)}</td>
                  <td className="cell-num">{formatCtr(row.ctr)}</td>
                  <td className="cell-num">{formatPosition(row.position)}</td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length}>
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
