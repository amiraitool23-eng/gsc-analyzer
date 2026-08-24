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
 * بازه‌ی پیش‌فرض گزارش:
 *   endDate   = امروز منهای ۳ روز (به‌خاطر تأخیر داده‌ی GSC)
 *   startDate = سه ماه قبل از endDate
 */
export function defaultDateRange(today: Date = new Date()): DateRange {
  const end = addDays(today, -GSC_DATA_LAG_DAYS)
  const start = addMonths(end, -3)
  return { startDate: toIsoDate(start), endDate: toIsoDate(end) }
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
