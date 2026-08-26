import type { GscPageRow } from '../types'
import type { CrawlImport, CrawlPage } from './crawlCsv'
import { inPropertyScope, looseUrlKey, normalizeUrlKey } from './urlKey'

/**
 * چسباندن دادهٔ سرچ کنسول به خروجی کراول.
 *
 * قاعده‌ی اصلی این فایل: **تطبیق ناموفق باید دیده شود، نه اینکه بی‌صدا رد شود.**
 * اگر آدرس‌ها به هم نچسبند، هر تحلیلی که رویش بنشیند می‌گوید «برای این عبارت
 * صفحه‌ای ندارید» در حالی که صفحه هست — یعنی دقیقاً همان چیزی که کار کاربر را
 * بیشتر می‌کند نه کمتر. پس نرخ تطبیق همیشه محاسبه و در UI نشان داده می‌شود.
 */

export interface JoinReport {
  /** چند صفحه در گزارش صفحه‌محور سرچ کنسول بود */
  gscPages: number
  /** چند صفحه در فایل کراول بود */
  crawlPages: number
  /** چند صفحهٔ سرچ کنسول در کراول پیدا شد */
  matched: number
  /** نسبت ۰ تا ۱ */
  matchRate: number
  /**
   * چند آدرسِ مچ‌نشده، **فقط** به‌خاطر پارامترهای آدرس جا مانده‌اند.
   * عمداً خودکار مچ نمی‌شوند (`?page=2` صفحهٔ دیگری است) ولی عددش به کاربر
   * می‌گوید مشکل کجاست.
   */
  paramMismatches: number
  /** نمونه‌ای از آدرس‌های مچ‌نشده، برای اینکه کاربر با چشم ببیند چه شکلی‌اند */
  unmatchedSample: string[]
  /** صفحه‌هایی که کراول شده‌اند ولی در سرچ کنسول هیچ نمایشی نگرفته‌اند */
  crawlOnly: number
  /**
   * صفحه‌های کراول‌شده‌ای که اصلاً مال این پراپرتی نیستند (میزبان یا مسیر دیگر).
   * این‌ها کنار گذاشته می‌شوند، نه اینکه «بدون نمایش» شمرده شوند.
   */
  outOfScope: number
}

/** سطر صفحه‌محور سرچ کنسول، به‌علاوهٔ چیزی که کراول دربارهٔ همان صفحه می‌داند */
export interface PageWithContent extends GscPageRow {
  crawl?: CrawlPage
}

const SAMPLE_SIZE = 10

export function joinCrawl(
  pageRows: readonly GscPageRow[],
  crawl: CrawlImport,
  siteUrl: string,
): JoinReport {
  const inScope = crawl.pages.filter((page) => inPropertyScope(siteUrl, page.url))
  const matchedKeys = new Set<string>()
  const unmatchedSample: string[] = []
  let matched = 0
  let paramMismatches = 0

  // نگاشت کلیدِ بدون‌پارامتر → وجود دارد؟ فقط برای تشخیص علت، نه برای تطبیق
  const looseKeys = new Set<string>()
  for (const page of inScope) {
    const loose = looseUrlKey(page.url)
    if (loose !== null) looseKeys.add(loose)
  }

  for (const row of pageRows) {
    const key = normalizeUrlKey(row.page)
    if (key !== null && crawl.byKey.has(key)) {
      matched++
      matchedKeys.add(key)
      continue
    }
    const loose = looseUrlKey(row.page)
    if (loose !== null && looseKeys.has(loose)) paramMismatches++
    if (unmatchedSample.length < SAMPLE_SIZE) unmatchedSample.push(row.page)
  }

  return {
    gscPages: pageRows.length,
    crawlPages: inScope.length,
    matched,
    matchRate: pageRows.length > 0 ? matched / pageRows.length : 0,
    paramMismatches,
    unmatchedSample,
    crawlOnly: inScope.length - matchedKeys.size,
    outOfScope: crawl.pages.length - inScope.length,
  }
}

/** همان سطرهای سرچ کنسول، با محتوای کراول چسبیده به هرکدام که پیدا شد */
export function attachCrawl(
  pageRows: readonly GscPageRow[],
  crawl: CrawlImport,
): PageWithContent[] {
  return pageRows.map((row) => {
    const key = normalizeUrlKey(row.page)
    const page = key === null ? undefined : crawl.byKey.get(key)
    return page === undefined ? { ...row } : { ...row, crawl: page }
  })
}

/**
 * صفحه‌هایی که در کراول هستند ولی در سرچ کنسول **هیچ نمایشی** نگرفته‌اند.
 *
 * این دسته با سرچ کنسول تنها اصلاً قابل دیدن نبود: چیزی که نمایش ندارد در هیچ
 * گزارشی نیست. محتوایی است که وجود دارد و هیچ کاری نمی‌کند.
 */
export function pagesWithoutImpressions(
  pageRows: readonly GscPageRow[],
  crawl: CrawlImport,
  siteUrl: string,
): CrawlPage[] {
  const seen = new Set<string>()
  for (const row of pageRows) {
    const key = normalizeUrlKey(row.page)
    if (key !== null) seen.add(key)
  }
  return crawl.pages.filter(
    (page) => inPropertyScope(siteUrl, page.url) && !seen.has(page.key),
  )
}
