import type { DateRange } from '../types'

/**
 * داده‌ی سرچ کنسول همیشه ۲ تا ۳ روز تأخیر دارد.
 * برای اینکه آخرین روزهای بازه ناقص نباشند، انتهای بازه را ۳ روز عقب می‌بریم.
 */
export const GSC_DATA_LAG_DAYS = 3

/** تبدیل Date به رشته‌ی YYYY-MM-DD بر اساس تقویم محلی (نه UTC) */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d.getTime())
  copy.setDate(copy.getDate() + days)
  return copy
}

function addMonths(d: Date, months: number): Date {
  const copy = new Date(d.getTime())
  const targetDay = copy.getDate()
  copy.setMonth(copy.getMonth() + months)
  // اگر ماه مقصد آن روز را ندارد (مثلاً ۳۱ → ۳۰) به آخرین روز همان ماه برگرد
  if (copy.getDate() !== targetDay) copy.setDate(0)
  return copy
}

/**
 * بازه‌های آماده.
 *
 * عمداً دقیقاً همان گزینه‌های صفحه‌ی Performance سرچ کنسول است (۷ روز، ۲۸ روز،
 * ۳ / ۶ / ۱۲ ماه). اگر تعریف بازه با گوگل فرق کند، کاربر موقع مقایسه‌ی اعداد
 * دوباره فکر می‌کند ابزار خراب است — همان سردرگمی‌ای که CoverageNotice برای
 * رفعش ساخته شد. «ماهانه» در سرچ کنسول یعنی ۲۸ روز، نه ۳۰ روز.
 */
export type PeriodId = '7d' | '28d' | '3m' | '6m' | '12m'

export interface Period {
  id: PeriodId
  label: string
  /** طول بازه: یا بر حسب روز یا بر حسب ماه */
  days?: number
  months?: number
}

export const PERIODS: readonly Period[] = [
  { id: '7d', label: '۷ روز', days: 7 },
  { id: '28d', label: '۲۸ روز', days: 28 },
  { id: '3m', label: '۳ ماه', months: 3 },
  { id: '6m', label: '۶ ماه', months: 6 },
  { id: '12m', label: '۱۲ ماه', months: 12 },
]

export const DEFAULT_PERIOD: PeriodId = '3m'

/**
 * بازه‌ی یک دوره‌ی آماده:
 *   endDate   = امروز منهای ۳ روز (به‌خاطر تأخیر داده‌ی GSC)
 *   startDate = به اندازه‌ی طول دوره عقب‌تر
 */
export function rangeForPeriod(period: PeriodId, today: Date = new Date()): DateRange {
  const end = addDays(today, -GSC_DATA_LAG_DAYS)
  const spec = PERIODS.find((p) => p.id === period) ?? PERIODS[2]
  // برای بازه‌های روزشمار، خودِ endDate هم جزو بازه است؛ پس days-1 عقب می‌رویم
  const start = spec.days ? addDays(end, -(spec.days - 1)) : addMonths(end, -(spec.months ?? 3))
  return { startDate: toIsoDate(start), endDate: toIsoDate(end) }
}

/** بازه‌ی پیش‌فرض (سه ماه) */
export function defaultDateRange(today: Date = new Date()): DateRange {
  return rangeForPeriod(DEFAULT_PERIOD, today)
}

/** تبدیل YYYY-MM-DD به Date در تقویم محلی (نه UTC) */
function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** تعداد روزهای بازه، شاملِ هر دو سر */
export function rangeLengthDays(range: DateRange): number {
  const start = fromIsoDate(range.startDate)
  const end = fromIsoDate(range.endDate)
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1
}

/**
 * بازه‌ی هم‌اندازه‌ی بلافاصله قبل از بازه‌ی داده‌شده.
 *
 * برای مقایسه‌ی «این دوره در برابر دوره‌ی قبل» باید هر دو بازه دقیقاً هم‌طول باشند،
 * وگرنه اختلاف اعداد فقط به‌خاطر تعداد روز است نه تغییر واقعی عملکرد.
 */
export function previousRange(range: DateRange): DateRange {
  const days = rangeLengthDays(range)
  const prevEnd = addDays(fromIsoDate(range.startDate), -1)
  const prevStart = addDays(prevEnd, -(days - 1))
  return { startDate: toIsoDate(prevStart), endDate: toIsoDate(prevEnd) }
}

/** نمایش تاریخ میلادی به شکل خوانا در UI فارسی */
export function formatDateFa(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const dt = new Date(y, m - 1, d)
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(dt)
  } catch {
    return iso
  }
}

/** تاریخ کوتاه برای برچسب محور نمودار: «۵ مرداد» */
export function formatDateShortFa(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  try {
    return new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric' }).format(
      new Date(y, m - 1, d),
    )
  } catch {
    return iso
  }
}

/** «۲ ساعت پیش» و مانند آن، برای نمایش زمان آخرین به‌روزرسانی کش */
export function formatRelativeFa(timestamp: number, now: number = Date.now()): string {
  const diffSec = Math.round((timestamp - now) / 1000)
  const abs = Math.abs(diffSec)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 30],
    ['month', 12],
  ]
  let value = diffSec
  let unit: Intl.RelativeTimeFormatUnit = 'second'
  let remaining = abs
  for (const [u, size] of units) {
    unit = u
    if (remaining < size) break
    remaining = remaining / size
    value = value / size
  }
  try {
    return new Intl.RelativeTimeFormat('fa-IR', { numeric: 'auto' }).format(
      Math.round(value),
      unit,
    )
  } catch {
    return new Date(timestamp).toLocaleString('fa-IR')
  }
}
