import type { GscPageRow } from '../types'

/**
 * خلاصه‌ی آماری یک مجموعه سطر.
 * نکته‌ی مهم دامنه: میانگین Position باید وزنی با Impression باشد، نه میانگین ساده.
 */
export interface Totals {
  rows: number
  clicks: number
  impressions: number
  /** نسبت اعشاری (۰٫۰۴۸ یعنی ۴٫۸٪) — از تقسیم کل کلیک بر کل نمایش، نه میانگین CTRها */
  ctr: number
  /** میانگین وزنی موقعیت با وزن impressions */
  position: number
}

export const EMPTY_TOTALS: Totals = {
  rows: 0,
  clicks: 0,
  impressions: 0,
  ctr: 0,
  position: 0,
}

/**
 * میانگین وزنی موقعیت: Σ(position × impressions) ÷ Σ(impressions)
 *
 * چرا میانگین ساده غلط است؟ چون سطری با ۱۰ هزار نمایش و سطری با ۲ نمایش
 * در میانگین ساده هم‌وزن می‌شوند و عدد نهایی به شدت به سمت کوئری‌های
 * دم‌بلندِ کم‌نمایش (که معمولاً موقعیت بدی دارند) کشیده می‌شود.
 */
export function weightedPosition(rows: readonly GscPageRow[]): number {
  let weightedSum = 0
  let impressions = 0
  for (const row of rows) {
    weightedSum += row.position * row.impressions
    impressions += row.impressions
  }
  return impressions > 0 ? weightedSum / impressions : 0
}

/** تجمیع کلیک/نمایش/CTR/موقعیت روی مجموعه‌ای از سطرها */
export function computeTotals(rows: readonly GscPageRow[]): Totals {
  let clicks = 0
  let impressions = 0
  let weightedSum = 0
  for (const row of rows) {
    clicks += row.clicks
    impressions += row.impressions
    weightedSum += row.position * row.impressions
  }
  return {
    rows: rows.length,
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? weightedSum / impressions : 0,
  }
}

const numberFa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 })
const decimalFa = new Intl.NumberFormat('fa-IR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const percentFa = new Intl.NumberFormat('fa-IR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** عدد صحیح با جداکننده‌ی هزارگان و ارقام فارسی */
export function formatNumber(n: number): string {
  return numberFa.format(n)
}

/**
 * CTR از API نسبت اعشاری است (مثلاً 0.048)؛ برای نمایش باید ×۱۰۰ و با ٪ نشان داده شود.
 * هرگز عدد خام API را مستقیم به‌عنوان درصد چاپ نکنید.
 */
export function formatCtr(ratio: number): string {
  return `${percentFa.format(ratio * 100)}٪`
}

/** موقعیت با یک رقم اعشار */
export function formatPosition(position: number): string {
  return decimalFa.format(position)
}
