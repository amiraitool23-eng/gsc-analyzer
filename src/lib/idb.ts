/**
 * دسترسی مشترک به IndexedDB.
 *
 * دو انبار داریم و هر دو فقط روی همین مرورگر می‌مانند:
 *   - `reports` گزارش‌های سرچ کنسول (کلید: پراپرتی + بازه‌ی تاریخ)
 *   - `crawls`  خروجی کراول هر پراپرتی (کلید: پراپرتی)
 *
 * هر خطایی — حالت ناشناس، ذخیره‌سازی بسته، فضای پر — به `null` تبدیل می‌شود نه
 * پرتاب خطا: اپ بدون کش هم باید کار کند.
 */

const DB_NAME = 'gsc-analyzer'
const DB_VERSION = 2

export const STORE_REPORTS = 'reports'
export const STORE_CRAWLS = 'crawls'

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
      // نسخه‌ی ۱ فقط reports داشت؛ رکوردهای قبلی دست‌نخورده می‌مانند
      if (!db.objectStoreNames.contains(STORE_REPORTS)) {
        db.createObjectStore(STORE_REPORTS, { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains(STORE_CRAWLS)) {
        db.createObjectStore(STORE_CRAWLS, { keyPath: 'siteUrl' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })

  return dbPromise
}

export function runTx<T>(
  storeName: string,
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
          const tx = db.transaction(storeName, mode)
          request = action(tx.objectStore(storeName))
        } catch {
          resolve(null)
          return
        }
        request.onsuccess = () => resolve(request.result ?? null)
        request.onerror = () => resolve(null)
      }),
  )
}

/** پاک کردن همه‌ی انبارها — پشت دکمه‌ی «پاک کردن داده‌های محلی» */
export async function clearAllStores(): Promise<void> {
  await runTx(STORE_REPORTS, 'readwrite', (s) => s.clear() as IDBRequest<undefined>)
  await runTx(STORE_CRAWLS, 'readwrite', (s) => s.clear() as IDBRequest<undefined>)
}
