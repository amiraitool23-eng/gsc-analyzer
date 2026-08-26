import type { CrawlImport, CrawlPage } from './crawlCsv'
import { STORE_CRAWLS, runTx } from './idb'

/**
 * نگهداری خروجی کراول هر پراپرتی در IndexedDB.
 *
 * چرا ذخیره می‌شود؟ کراول یک کار دستیِ چنددقیقه‌ای است؛ اگر با هر رفرش صفحه از
 * بین برود، کسی از این ویژگی استفاده نمی‌کند. مثل بقیه‌ی دادهٔ این اپ، فقط روی
 * همین مرورگر می‌ماند و با «پاک کردن داده‌های محلی» هم پاک می‌شود.
 *
 * `byKey` یک `Map` است و مستقیم قابل ذخیره نیست، پس فقط `pages` ذخیره می‌شود و
 * نمایه موقع خواندن دوباره ساخته می‌شود.
 */

export interface StoredCrawl {
  siteUrl: string
  pages: CrawlPage[]
  columns: Record<string, string>
  totalRows: number
  skippedRows: number
  nonHtmlRows: number
  duplicateKeys: number
  /** نام فایلی که کاربر انتخاب کرده بود — برای اینکه بداند کدام کراول است */
  fileName: string
  importedAt: number
}

export interface LoadedCrawl extends CrawlImport {
  fileName: string
  importedAt: number
}

function toImport(stored: StoredCrawl): LoadedCrawl {
  const byKey = new Map<string, CrawlPage>()
  for (const page of stored.pages) byKey.set(page.key, page)
  return {
    pages: stored.pages,
    byKey,
    columns: stored.columns,
    missingColumns: [],
    totalRows: stored.totalRows,
    skippedRows: stored.skippedRows,
    nonHtmlRows: stored.nonHtmlRows,
    duplicateKeys: stored.duplicateKeys,
    fileName: stored.fileName,
    importedAt: stored.importedAt,
  }
}

export async function readCrawl(siteUrl: string): Promise<LoadedCrawl | null> {
  const stored = await runTx<StoredCrawl>(STORE_CRAWLS, 'readonly', (store) =>
    store.get(siteUrl) as IDBRequest<StoredCrawl>,
  )
  return stored ? toImport(stored) : null
}

export async function writeCrawl(
  siteUrl: string,
  crawl: CrawlImport,
  fileName: string,
  importedAt: number,
): Promise<void> {
  const stored: StoredCrawl = {
    siteUrl,
    pages: crawl.pages,
    columns: crawl.columns,
    totalRows: crawl.totalRows,
    skippedRows: crawl.skippedRows,
    nonHtmlRows: crawl.nonHtmlRows,
    duplicateKeys: crawl.duplicateKeys,
    fileName,
    importedAt,
  }
  await runTx(STORE_CRAWLS, 'readwrite', (store) => store.put(stored) as IDBRequest<IDBValidKey>)
}

export async function deleteCrawl(siteUrl: string): Promise<void> {
  await runTx(STORE_CRAWLS, 'readwrite', (store) => store.delete(siteUrl) as IDBRequest<undefined>)
}
