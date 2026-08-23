import type { DateRange, FetchProgress, GscRow, GscSite } from '../types'
import { GscError, errorFromResponse, networkError } from './errors'

const API_BASE = 'https://www.googleapis.com/webmasters/v3'

/** سقف سطر در هر درخواست searchAnalytics — بیشترین مقداری که API قبول می‌کند */
export const ROW_LIMIT = 25_000

/** سقف ایمنی برای جلوگیری از حلقه‌ی بی‌پایان در سایت‌های خیلی بزرگ */
const MAX_REQUESTS = 200

/**
 * پراپرتی‌های Domain به شکل `sc-domain:example.com` هستند و کاراکتر «:» و «/»
 * در آن‌ها باید encode شود، وگرنه گوگل ۴۰۴/۴۰۰ برمی‌گرداند.
 * encodeURIComponent هر دو حالت Domain و URL-prefix را درست encode می‌کند.
 */
export function encodeSiteUrl(siteUrl: string): string {
  return encodeURIComponent(siteUrl)
}

/** آیا این پراپرتی از نوع Domain است؟ (برای نمایش برچسب در UI) */
export function isDomainProperty(siteUrl: string): boolean {
  return siteUrl.startsWith('sc-domain:')
}

/** نام خوانا برای نمایش پراپرتی */
export function displaySiteName(siteUrl: string): string {
  return isDomainProperty(siteUrl) ? siteUrl.slice('sc-domain:'.length) : siteUrl
}

interface RequestOptions {
  token: string
  signal?: AbortSignal
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(id)
        reject(new DOMException('لغو شد', 'AbortError'))
      },
      { once: true },
    )
  })

/**
 * fetch با مدیریت خطا و retry.
 * ۴۲۹ و ۵xx را با تأخیر افزایشی (۱s، ۲s، ۴s، ۸s) دوباره تلاش می‌کند؛
 * ۴۰۱ و ۴۰۳ retry نمی‌شوند چون با تکرار حل نمی‌شوند.
 */
async function apiFetch<T>(
  path: string,
  { token, signal }: RequestOptions,
  init?: RequestInit,
  attempt = 0,
): Promise<T> {
  const MAX_RETRIES = 4

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw networkError(cause)
  }

  if (response.ok) {
    return (await response.json()) as T
  }

  const body = await response.text().catch(() => '')
  const error = errorFromResponse(response.status, body)

  const retryable = error.kind === 'rateLimit'
  if (retryable && attempt < MAX_RETRIES) {
    // اگر گوگل Retry-After داد به آن احترام می‌گذاریم، وگرنه backoff نمایی
    const retryAfterSec = Number(response.headers.get('Retry-After'))
    const delayMs = Number.isFinite(retryAfterSec) && retryAfterSec > 0
      ? Math.min(retryAfterSec * 1000, 30_000)
      : 1000 * 2 ** attempt
    await sleep(delayMs, signal)
    return apiFetch<T>(path, { token, signal }, init, attempt + 1)
  }

  throw error
}

/** فهرست پراپرتی‌های سرچ کنسولِ حساب کاربر */
export async function listSites(options: RequestOptions): Promise<GscSite[]> {
  const data = await apiFetch<{ siteEntry?: GscSite[] }>('/sites', options)
  const sites = data.siteEntry ?? []
  return sites
    .filter((s) => s.permissionLevel !== 'siteUnverifiedUser')
    .sort((a, b) => displaySiteName(a.siteUrl).localeCompare(displaySiteName(b.siteUrl)))
}

interface SearchAnalyticsResponse {
  rows?: { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }[]
}

/**
 * دریافت کامل داده‌ی searchAnalytics با ابعاد page + query.
 *
 * API در هر درخواست حداکثر ROW_LIMIT سطر می‌دهد، پس با startRow صفحه‌بندی
 * می‌کنیم تا وقتی که پاسخی با کمتر از ROW_LIMIT سطر برگردد.
 */
export async function fetchAllRows(
  siteUrl: string,
  range: DateRange,
  options: RequestOptions,
  onProgress?: (progress: FetchProgress) => void,
): Promise<GscRow[]> {
  const path = `/sites/${encodeSiteUrl(siteUrl)}/searchAnalytics/query`
  const rows: GscRow[] = []

  for (let request = 0; request < MAX_REQUESTS; request++) {
    const startRow = request * ROW_LIMIT

    const data = await apiFetch<SearchAnalyticsResponse>(path, options, {
      method: 'POST',
      body: JSON.stringify({
        startDate: range.startDate,
        endDate: range.endDate,
        dimensions: ['page', 'query'],
        rowLimit: ROW_LIMIT,
        startRow,
        dataState: 'final',
      }),
    })

    const batch = data.rows ?? []
    for (const row of batch) {
      rows.push({
        page: row.keys?.[0] ?? '',
        query: row.keys?.[1] ?? '',
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        ctr: row.ctr ?? 0,
        position: row.position ?? 0,
      })
    }

    onProgress?.({ rowsFetched: rows.length, page: request + 1 })

    // پاسخ ناقص یعنی به انتهای داده رسیده‌ایم
    if (batch.length < ROW_LIMIT) return rows
  }

  throw new GscError({
    kind: 'unknown',
    title: 'حجم داده بیش از حد انتظار بود',
    hint:
      `بیش از ${MAX_REQUESTS * ROW_LIMIT} سطر داده برگشت و برای جلوگیری از گیر کردن مرورگر متوقف شدیم. ` +
      'بازه‌ی تاریخی کوتاه‌تری انتخاب کنید.',
  })
}
