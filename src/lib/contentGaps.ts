import type { GscRow } from '../types'
import type { CrawlPage } from './crawlCsv'
import type { CtrCurve } from './ctrCurve'
import { expectedCtr } from './ctrCurve'
import { TokenIndex, tokenize } from './textIndex'

/**
 * «عبارت‌هایی که تقاضا دارند ولی صفحه‌ی اختصاصی ندارند».
 *
 * کاری که سئوکار دستی می‌کند: صفحه را باز می‌کند، کوئری‌هایش را می‌بیند، و
 * عبارت‌هایی را جدا می‌کند که به کسب‌وکار مربوط‌اند ولی این صفحه جای درستشان
 * نیست و صفحه‌ی جداگانه‌ای هم برایشان وجود ندارد.
 *
 * دو نیمه‌ی این سؤال از دو منبع می‌آید:
 *   - **تقاضا** از سرچ کنسول (بُعد page+query)
 *   - **آنچه داریم** از کراول (عنوان و H1 و آدرس همه‌ی صفحه‌ها)
 *
 * بدون نیمه‌ی دوم فقط می‌شد از روی اسلاگِ صفحه‌های **دارای نمایش** حدس زد — و
 * صفحه‌ای که نوشته شده و هنوز هیچ نمایشی نگرفته، نامرئی می‌ماند و ابزار می‌گفت
 * «ندارید» و کاربر دوباره همان را می‌نوشت.
 */

/** پوشش عنوان از این بیشتر باشد یعنی صفحه‌ای برای این عبارت هست */
const COVERED_THRESHOLD = 0.75

/** با یک کلمه‌ی مشترک نمی‌شود گفت صفحه درباره‌ی این عبارت است */
const MIN_MATCHING_TOKENS = 2

/**
 * رتبه‌ای که فرض می‌کنیم یک صفحه‌ی اختصاصیِ خوب به آن می‌رسد.
 *
 * عدد لازم است چون «چقدر کلیک از دست می‌دهیم» بدون فرضِ رتبه بی‌معنی است. ۵
 * محافظه‌کارانه است (نه ۱)، و در UI صریح نوشته می‌شود که این یک فرض است.
 */
const TARGET_POSITION = 5

/** زیر این تعداد نمایش، عبارت آن‌قدر کوچک است که فهرست را شلوغ می‌کند */
const MIN_IMPRESSIONS = 10

export interface QueryDemand {
  query: string
  clicks: number
  impressions: number
  /** تجمیعی: Σclicks ÷ Σimpressions */
  ctr: number
  /** میانگین وزنی با نمایش، روی همه‌ی صفحه‌هایی که این عبارت را گرفته‌اند */
  position: number
  /** چند صفحه برای این عبارت دیده شده‌اند */
  pageCount: number
  /** صفحه‌ای که بیشترین نمایش این عبارت را دارد */
  topPage: string
  /** سهم این عبارت از نمایش‌های گزارش‌شده‌ی همان صفحه (۰ تا ۱) */
  topPageShare: number
}

export interface ContentGap extends QueryDemand {
  /** نزدیک‌ترین صفحه‌ی موجود از نظر عنوان — شاهدی که کاربر خودش قضاوت کند */
  nearestPage?: CrawlPage
  /** چه کسری از کلمات این عبارت در عنوان آن صفحه بود (۰ تا ۱) */
  nearestCoverage: number
  /** CTR انتظاری در رتبه‌ی هدف، از منحنی خود سایت */
  targetCtr: number
  /** تخمین کلیکی که با داشتن صفحه‌ی اختصاصی و رسیدن به رتبه‌ی هدف به دست می‌آید */
  missedClicks: number
}

/**
 * تجمیع سطرهای page+query روی خودِ عبارت.
 *
 * `topPageShare` عمداً نسبت به **جمع نمایش‌های کوئری‌های همان صفحه** حساب می‌شود،
 * نه نمایش کل صفحه از گزارش صفحه‌محور. آن یکی کامل است و این یکی زیرمجموعه؛ اگر
 * قاطی شوند سهم به‌شکل سیستماتیک کمتر از واقع درمی‌آید.
 */
export function aggregateQueries(rows: readonly GscRow[]): QueryDemand[] {
  const pageTotals = new Map<string, number>()
  for (const row of rows) {
    pageTotals.set(row.page, (pageTotals.get(row.page) ?? 0) + row.impressions)
  }

  interface Acc {
    clicks: number
    impressions: number
    weightedPos: number
    pages: Map<string, number>
  }
  const byQuery = new Map<string, Acc>()

  for (const row of rows) {
    if (row.impressions <= 0) continue
    const acc = byQuery.get(row.query) ?? {
      clicks: 0,
      impressions: 0,
      weightedPos: 0,
      pages: new Map<string, number>(),
    }
    acc.clicks += row.clicks
    acc.impressions += row.impressions
    acc.weightedPos += row.position * row.impressions
    acc.pages.set(row.page, (acc.pages.get(row.page) ?? 0) + row.impressions)
    byQuery.set(row.query, acc)
  }

  const out: QueryDemand[] = []
  for (const [query, acc] of byQuery) {
    let topPage = ''
    let topImpressions = 0
    for (const [page, impressions] of acc.pages) {
      if (impressions > topImpressions) {
        topImpressions = impressions
        topPage = page
      }
    }
    const pageTotal = pageTotals.get(topPage) ?? 0
    out.push({
      query,
      clicks: acc.clicks,
      impressions: acc.impressions,
      ctr: acc.clicks / acc.impressions,
      position: acc.weightedPos / acc.impressions,
      pageCount: acc.pages.size,
      topPage,
      topPageShare: pageTotal > 0 ? topImpressions / pageTotal : 0,
    })
  }
  return out
}

export interface GapOptions {
  queryRows: readonly GscRow[]
  crawlPages: readonly CrawlPage[]
  curve: CtrCurve
  isBrand: (query: string) => boolean
  /** برای تست؛ پیش‌فرض همان ثابت بالاست */
  minImpressions?: number
}

/**
 * عبارت‌هایی که هیچ صفحه‌ای در سایت عنوانش آن‌ها را پوشش نمی‌دهد.
 *
 * ترتیب بر اساس «کلیکی که با داشتن صفحه‌ی اختصاصی به دست می‌آمد» است، نه صرفاً
 * نمایش: عبارتی که همین حالا هم کلیک خوبی می‌گیرد فرصت نیست.
 */
export function findContentGaps({
  queryRows,
  crawlPages,
  curve,
  isBrand,
  minImpressions = MIN_IMPRESSIONS,
}: GapOptions): ContentGap[] {
  if (!curve.available || crawlPages.length === 0) return []

  const targetCtr = expectedCtr(curve, TARGET_POSITION)
  if (targetCtr === null) return []

  // نمایه از عنوان + H1 + آدرس. آدرس هم می‌آید چون در سایت فارسی اسلاگ معمولاً
  // خودِ عنوان است و گاهی عنوان کوتاه‌تر از اسلاگ است.
  const docs = crawlPages.map((page) => tokenize(`${page.title} ${page.h1} ${page.url}`))
  const index = new TokenIndex(docs)

  const gaps: ContentGap[] = []
  for (const demand of aggregateQueries(queryRows)) {
    if (demand.impressions < minImpressions) continue
    if (isBrand(demand.query)) continue

    const gain = targetCtr - demand.ctr
    // عبارتی که همین حالا بهتر از رتبه‌ی هدف عمل می‌کند، فرصت نیست
    if (gain <= 0) continue

    const tokens = tokenize(demand.query)
    if (tokens.length === 0) continue

    const best = index.bestCoverage(tokens, Math.min(MIN_MATCHING_TOKENS, tokens.length))

    // صفحه‌ای هست که عنوانش این عبارت را پوشش می‌دهد → این «کمبود محتوا» نیست
    if (best.coverage >= COVERED_THRESHOLD) continue

    gaps.push({
      ...demand,
      nearestPage: best.doc === -1 ? undefined : crawlPages[best.doc],
      nearestCoverage: best.coverage,
      targetCtr,
      missedClicks: demand.impressions * gain,
    })
  }

  return gaps.sort((a, b) => b.missedClicks - a.missedClicks)
}

export const GAP_TARGET_POSITION = TARGET_POSITION
