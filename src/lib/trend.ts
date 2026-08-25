import type { DailyRow } from '../types'

/** معیارهایی که سری زمانی برایشان معنی دارد */
export type TrendMetric = 'clicks' | 'impressions'

/**
 * میانگین متحرک؛ برای هموار کردن نوسان روزانه (به‌ویژه الگوی آخر هفته).
 * مقدارهای ابتدای سری با همان تعداد روز موجود حساب می‌شوند تا سری کوتاه نشود.
 */
export function movingAverage(values: readonly number[], window: number): number[] {
  const out: number[] = []
  for (let i = 0; i < values.length; i++) {
    const from = Math.max(0, i - window + 1)
    let sum = 0
    for (let j = from; j <= i; j++) sum += values[j]
    out.push(sum / (i - from + 1))
  }
  return out
}

export interface DropFinding {
  /** روزی که افت از آن شروع شده */
  date: string
  /** میانگین روزانه در پنجره‌ی قبل از آن روز */
  beforeAvg: number
  /** میانگین روزانه در پنجره‌ی بعد از آن روز */
  afterAvg: number
  /** نسبت افت، ۰ تا ۱ */
  dropRatio: number
  /** طول پنجره‌ی مقایسه بر حسب روز */
  window: number
}

/** حداقل نسبت افت تا «افت» به حساب بیاید */
const MIN_DROP_RATIO = 0.3
/** حداقل حجم در پنجره‌ی قبل؛ جلوی «افت» اعلام کردن از ۱ کلیک به ۰ را می‌گیرد */
const MIN_BEFORE_TOTAL = 10

/**
 * پیدا کردن روزی که بیشترین افتِ پایدار از آن شروع شده.
 *
 * روش عمداً ساده و قابل توضیح است: برای هر روز، میانگین پنجره‌ی قبل با میانگین
 * پنجره‌ی بعد مقایسه می‌شود و بزرگ‌ترین افت برنده است. این یک هشدار است نه اثبات؛
 * برای همین اعداد خام هم برگردانده می‌شوند تا UI نشانشان بدهد و کاربر خودش قضاوت کند.
 *
 * اگر داده کم باشد یا افت به آستانه نرسد، `null` برمی‌گردد — بهتر از اعلام افت
 * ساختگی روی نوسان طبیعی.
 */
export function detectDrop(
  rows: readonly DailyRow[],
  metric: TrendMetric = 'clicks',
): DropFinding | null {
  if (rows.length < 14) return null

  // پنجره حداکثر ۷ روز، و برای بازه‌های کوتاه کوچک‌تر
  const window = Math.min(7, Math.floor(rows.length / 4))
  if (window < 3) return null

  const values = rows.map((r) => r[metric])
  let best: DropFinding | null = null

  for (let i = window; i <= values.length - window; i++) {
    let beforeSum = 0
    for (let j = i - window; j < i; j++) beforeSum += values[j]
    let afterSum = 0
    for (let j = i; j < i + window; j++) afterSum += values[j]

    if (beforeSum < MIN_BEFORE_TOTAL) continue

    const beforeAvg = beforeSum / window
    const afterAvg = afterSum / window
    const dropRatio = (beforeAvg - afterAvg) / beforeAvg
    if (dropRatio < MIN_DROP_RATIO) continue

    if (!best || dropRatio > best.dropRatio) {
      best = { date: rows[i].date, beforeAvg, afterAvg, dropRatio, window }
    }
  }

  return best
}
