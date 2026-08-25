/**
 * کش داده در IndexedDB — همه چیز روی همین مرورگر می‌ماند و جایی ارسال نمی‌شود.
 * هدف: بعد از رفرش صفحه لازم نباشد دوباره چند ده هزار سطر از گوگل گرفته شود.
 * کلید هر رکورد: پراپرتی + بازه‌ی تاریخ.
 */
import type { DailyRow, DateRange, GscPageRow, GscRow, ReportData, SiteTotals } from '../types'

const DB_NAME = 'gsc-analyzer'
const DB_VERSION = 1
const STORE = 'reports'

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

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      resolve(null)
      return
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    // در حالت ناشناس یا وقتی کاربر ذخیره‌سازی را بسته باشد، بدون کش ادامه می‌دهیم
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })

  return dbPromise
}

function runTx<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null)
          return
        }
        let request: IDBRequest<T>
        try {
          const tx = db.transaction(STORE, mode)
          request = action(tx.objectStore(STORE))
        } catch {
          resolve(null)
          return
        }
        request.onsuccess = () => resolve(request.result ?? null)
        request.onerror = () => resolve(null)
      }),
  )
}

/** خواندن گزارش کش‌شده؛ اگر نبود یا IndexedDB در دسترس نبود، null */
export async function readReport(
  siteUrl: string,
  range: DateRange,
): Promise<ReportData | null> {
  const stored = await runTx<StoredReport>('readonly', (store) =>
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
  await runTx('readwrite', (store) => store.put(stored) as IDBRequest<IDBValidKey>)
}

/** پاک کردن کل کش — برای دکمه‌ی «پاک کردن داده‌های محلی» */
export async function clearCache(): Promise<void> {
  await runTx('readwrite', (store) => store.clear() as IDBRequest<undefined>)
}
