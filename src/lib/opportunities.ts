import type { GscPageRow } from '../types'
import type { CtrCurve } from './ctrCurve'
import { expectedCtr } from './ctrCurve'

/**
 * «فرصت‌های از دست رفته» — جایگزین قاعده‌ی «نمایش > ۱۰۰۰ و CTR < ۳٪».
 *
 * دو مشکل آن قاعده:
 *   ۱) هر دو عدد به اندازه‌ی سایت وابسته‌اند و برای سایت دیگر غلط‌اند.
 *   ۲) CTR بدون در نظر گرفتن موقعیت بی‌معنی است.
 *
 * راه‌حل: به‌جای **فیلتر** با آستانه، **رتبه‌بندی** با «کلیک از دست رفته»:
 *
 *     کلیک از دست رفته = نمایش × (CTR انتظاری − CTR واقعی)
 *
 * این عدد حجم را در خودش دارد، پس آستانه‌ی حجم لازم نیست: صفحه‌ی پرنمایش با
 * فاصله‌ی کم، بالاتر از صفحه‌ی کم‌نمایش با فاصله‌ی زیاد می‌آید — و همین درست است.
 * فهرست هم هیچ‌وقت خالی نمی‌شود؛ سایت کوچک هم اولویت‌بندی خودش را می‌گیرد.
 */

export type Confidence = 'high' | 'medium' | 'low'

export interface Opportunity extends GscPageRow {
  /** CTR انتظاری برای موقعیت این صفحه، از منحنی خود سایت */
  expectedCtr: number
  /** فاصله‌ی CTR بر حسب واحد درصد (مثبت = کمتر از انتظار) */
  gapPoints: number
  /** تخمین کلیکی که با رسیدن به CTR انتظاری به دست می‌آمد */
  missedClicks: number
  /** دقت اندازه‌گیری CTR این صفحه بر حسب واحد درصد (برای نمایش) */
  marginPoints: number
  /** چند انحراف معیار، کلیکِ واقعی زیر کلیکِ انتظاری است */
  zScore: number
  confidence: Confidence
}

/** ضریب ۹۵٪ اطمینان برای فاصله‌ی اطمینان نسبت */
const Z = 1.96

/**
 * نصف پهنای فاصله‌ی اطمینان CTR، بر حسب **واحد درصد**.
 *
 * CTR یک نسبت است و دقتش به تعداد نمایش بستگی دارد: با ۵۰ نمایش دقت حدود
 * ±۵ واحد درصد است و با ۱۴۰۰ نمایش حدود ±۱ واحد. برای همین به‌جای آستانه‌ی
 * دلبخواهی روی نمایش، همین عدد را حساب می‌کنیم و به کاربر نشان می‌دهیم.
 */
export function ctrMarginPoints(ctr: number, impressions: number): number {
  if (impressions <= 0) return 100
  const p = Math.min(Math.max(ctr, 0), 1)
  return Z * Math.sqrt((p * (1 - p)) / impressions) * 100
}

/**
 * چقدر مطمئنیم که این کم‌آوردن واقعی است و تصادفی نیست؟
 *
 * سؤال درست این نیست که «CTR این صفحه را چقدر دقیق می‌دانم» — سؤال این است که
 * «دیدن این تعداد کلیک، وقتی انتظار این‌قدر داشتیم، چقدر بعید است». پس به‌جای
 * فاصله‌ی اطمینانِ خودِ CTR، فاصله‌ی کلیکِ واقعی از کلیکِ انتظاری را بر حسب
 * انحراف معیارِ توزیع دوجمله‌ای می‌سنجیم.
 *
 * تفاوتش مهم است: صفحه‌ای با ۱۰۰ نمایش که انتظار ۵ کلیک داشت و ۱ کلیک گرفت،
 * با معیار اول «کم‌داده» به نظر می‌رسد ولی در واقع سیگنال معناداری دارد.
 */
function shortfallZ(observedClicks: number, impressions: number, expected: number): number {
  const variance = impressions * expected * (1 - expected)
  if (variance <= 0) return 0
  return (impressions * expected - observedClicks) / Math.sqrt(variance)
}

function classify(z: number): Confidence {
  if (z >= 3) return 'high'
  if (z >= 1.64) return 'medium' // یک‌طرفه، ۹۵٪
  return 'low'
}

/**
 * ساخت فهرست فرصت‌ها از سطرهای صفحه‌محور.
 *
 * نکته‌ی دقت: منحنی از موقعیت **کوئری** ساخته شده ولی اینجا روی موقعیت
 * **میانگین صفحه** اعمال می‌شود. چون CTR نسبت به موقعیت محدب است، این کار
 * CTR انتظاری را کمی **کمتر** از واقع تخمین می‌زند؛ یعنی خطا در جهت محتاطانه
 * است و باعث اعلام فرصتِ الکی نمی‌شود.
 */
export function findOpportunities(
  pageRows: readonly GscPageRow[],
  curve: CtrCurve,
): Opportunity[] {
  if (!curve.available) return []

  const out: Opportunity[] = []
  for (const row of pageRows) {
    if (row.impressions <= 0) continue
    const expected = expectedCtr(curve, row.position)
    if (expected === null) continue

    const gapPoints = (expected - row.ctr) * 100
    // صفحه‌ای که بهتر از انتظار عمل می‌کند فرصت نیست
    if (gapPoints <= 0) continue

    const z = shortfallZ(row.clicks, row.impressions, expected)
    out.push({
      ...row,
      expectedCtr: expected,
      gapPoints,
      missedClicks: row.impressions * (expected - row.ctr),
      marginPoints: ctrMarginPoints(row.ctr, row.impressions),
      zScore: z,
      confidence: classify(z),
    })
  }

  return out.sort((a, b) => b.missedClicks - a.missedClicks)
}
