import type { GscPageRow, SiteTotals } from '../types'
import type { Totals } from './metrics'

/** یک سطر با داده‌ی دوره‌ی قبل، برای نمایش تغییر */
export interface ComparedRow extends GscPageRow {
  query?: string
  /** مقادیر همین کلید در دوره‌ی قبل؛ نبودنش یعنی این سطر تازه است */
  prev?: Pick<GscPageRow, 'clicks' | 'impressions' | 'ctr' | 'position'>
  /** مثبت = کلیک بیشتر شده */
  deltaClicks: number
  /**
   * مثبت = موقعیت **بهتر** شده.
   * در سرچ کنسول عدد کوچک‌تر بهتر است، پس عمداً برعکسِ تفریق ساده حساب می‌شود
   * تا در UI هم‌جهت با بقیه‌ی معیارها باشد (مثبت = خوب).
   */
  deltaPosition: number
}

/** تفاوت دو دوره در سطح خلاصه */
export interface TotalsDelta {
  clicks: number
  impressions: number
  /** واحدش «واحد درصد» است، نه نسبت: تفاضل دو CTR */
  ctrPoints: number
  /** مثبت = بهتر شده */
  position: number
}

const keyOf = (row: { page: string; query?: string }) =>
  row.query === undefined ? row.page : `${row.page} ${row.query}`

/**
 * ادغام سطرهای دو دوره بر اساس کلید (صفحه، یا صفحه+کوئری).
 *
 * سطرهایی که فقط در دوره‌ی قبل بوده‌اند هم برمی‌گردند، با مقادیر صفر برای دوره‌ی
 * فعلی. حذفشان اشتباه رایجی است: صفحه‌ای که کلیکش صفر شده مهم‌ترین چیزی است که
 * کاربر باید ببیند.
 */
export function mergeForCompare<T extends GscPageRow & { query?: string }>(
  current: readonly T[],
  previous: readonly T[],
): ComparedRow[] {
  const prevByKey = new Map<string, T>()
  for (const row of previous) prevByKey.set(keyOf(row), row)

  const merged: ComparedRow[] = current.map((row) => {
    const prev = prevByKey.get(keyOf(row))
    return {
      ...row,
      prev: prev && {
        clicks: prev.clicks,
        impressions: prev.impressions,
        ctr: prev.ctr,
        position: prev.position,
      },
      deltaClicks: row.clicks - (prev?.clicks ?? 0),
      deltaPosition: prev ? prev.position - row.position : 0,
    }
  })

  const currentKeys = new Set(current.map(keyOf))
  for (const row of previous) {
    if (currentKeys.has(keyOf(row))) continue
    merged.push({
      ...row,
      clicks: 0,
      impressions: 0,
      ctr: 0,
      // موقعیت صفر بی‌معنی است؛ آخرین موقعیت شناخته‌شده را نگه می‌داریم
      position: row.position,
      prev: {
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      },
      deltaClicks: -row.clicks,
      deltaPosition: 0,
    })
  }

  return merged
}

/** تفاوت خلاصه‌ی دو دوره */
export function totalsDelta(current: Totals, previous: Totals): TotalsDelta {
  return {
    clicks: current.clicks - previous.clicks,
    impressions: current.impressions - previous.impressions,
    ctrPoints: (current.ctr - previous.ctr) * 100,
    position: previous.position - current.position,
  }
}

/** تفاوت آمار کل سایت بین دو دوره */
export function siteTotalsDelta(
  current: SiteTotals | undefined,
  previous: SiteTotals | undefined,
): TotalsDelta | undefined {
  if (!current || !previous) return undefined
  return {
    clicks: current.clicks - previous.clicks,
    impressions: current.impressions - previous.impressions,
    ctrPoints: (current.ctr - previous.ctr) * 100,
    position: previous.position - current.position,
  }
}
