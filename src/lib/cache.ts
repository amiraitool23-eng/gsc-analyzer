/**
 * کش گزارش‌های سرچ کنسول در IndexedDB — همه چیز روی همین مرورگر می‌ماند و جایی
 * ارسال نمی‌شود. هدف: بعد از رفرش صفحه لازم نباشد دوباره چند ده هزار سطر از
 * گوگل گرفته شود. کلید هر رکورد: پراپرتی + بازه‌ی تاریخ.
 */
import type { DailyRow, DateRange, GscPageRow, GscRow, ReportData, SiteTotals } from '../types'
import { STORE_REPORTS, clearAllStores, runTx } from './idb'

export function cacheKey(siteUrl: string, range: DateRange): string {
  return `${siteUrl}|${range.startDate}|${range.endDate}`
}

interface StoredReport {
  key: string
  siteUrl: string
  startDate: string
  endDate: string
  rows: GscRow[]
  /** در رکوردهای ذخیره‌شده‌ی قدیمی وجود ندارند */
  pageRows?: GscPageRow[]
  dailyRows?: DailyRow[]
  siteTotals?: SiteTotals
  fetchedAt: number
}

/** خواندن گزارش کش‌شده؛ اگر نبود یا IndexedDB در دسترس نبود، null */
export async function readReport(
  siteUrl: string,
  range: DateRange,
): Promise<ReportData | null> {
  const stored = await runTx<StoredReport>(STORE_REPORTS, 'readonly', (store) =>
    store.get(cacheKey(siteUrl, range)) as IDBRequest<StoredReport>,
  )
  if (!stored) return null
  return {
    siteUrl: stored.siteUrl,
    range: { startDate: stored.startDate, endDate: stored.endDate },
    rows: stored.rows,
    pageRows: stored.pageRows,
    dailyRows: stored.dailyRows,
    siteTotals: stored.siteTotals,
    fetchedAt: stored.fetchedAt,
  }
}

/** ذخیره‌ی گزارش در کش (خطای فضای پر شدن، اپ را از کار نمی‌اندازد) */
export async function writeReport(report: ReportData): Promise<void> {
  const stored: StoredReport = {
    key: cacheKey(report.siteUrl, report.range),
    siteUrl: report.siteUrl,
    startDate: report.range.startDate,
    endDate: report.range.endDate,
    rows: report.rows,
    pageRows: report.pageRows,
    dailyRows: report.dailyRows,
    siteTotals: report.siteTotals,
    fetchedAt: report.fetchedAt,
  }
  await runTx(STORE_REPORTS, 'readwrite', (store) => store.put(stored) as IDBRequest<IDBValidKey>)
}

/** پاک کردن همه‌ی داده‌های محلی: هم گزارش‌ها و هم کراول وارد شده */
export async function clearCache(): Promise<void> {
  await clearAllStores()
}
