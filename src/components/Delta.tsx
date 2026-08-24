import { formatNumber, formatPosition } from '../lib/metrics'

const percentFa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 })
const pointsFa = new Intl.NumberFormat('fa-IR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

type Tone = 'up' | 'down' | 'flat'

function tone(value: number): Tone {
  if (value > 0) return 'up'
  if (value < 0) return 'down'
  return 'flat'
}

/** پیشوند علامت با ارقام فارسی؛ منفی را با «−» می‌نویسیم نه خط تیره‌ی لاتین */
function signed(value: number, body: string): string {
  if (value > 0) return `+${body}`
  if (value < 0) return `−${body}`
  return body
}

interface CountProps {
  /** تغییر مطلق؛ مثبت = بهتر */
  delta: number
  /** مقدار دوره‌ی قبل، برای حساب کردن درصد تغییر */
  previous?: number
  /** سطر تازه است (در دوره‌ی قبل اصلاً وجود نداشته) */
  isNew?: boolean
}

/**
 * تغییر یک عدد شمارشی (کلیک/نمایش).
 *
 * درصد تغییر فقط وقتی نشان داده می‌شود که مقدار قبلی صفر نباشد — «رشد بی‌نهایت
 * درصدی» از صفر به یک، عددی است که فقط گمراه می‌کند.
 */
export function DeltaCount({ delta, previous, isNew }: CountProps) {
  if (isNew) return <span className="delta delta-new">جدید</span>
  if (delta === 0) return <span className="delta delta-flat">بدون تغییر</span>

  const pct =
    previous !== undefined && previous > 0
      ? ` (${signed(delta, percentFa.format(Math.abs(delta / previous) * 100) + '٪')})`
      : ''

  return (
    <span className={`delta delta-${tone(delta)}`}>
      {signed(delta, formatNumber(Math.abs(delta)))}
      {pct}
    </span>
  )
}

interface PositionProps {
  /** مثبت = موقعیت بهتر شده (عدد کوچک‌تر) */
  delta: number
  isNew?: boolean
}

/**
 * تغییر موقعیت.
 *
 * در سرچ کنسول عدد کوچک‌تر بهتر است، پس به‌جای +/− که گیج‌کننده می‌شود،
 * صریح می‌نویسیم «بهتر» یا «بدتر».
 */
export function DeltaPosition({ delta, isNew }: PositionProps) {
  if (isNew) return <span className="delta delta-new">جدید</span>
  if (Math.abs(delta) < 0.05) return <span className="delta delta-flat">بدون تغییر</span>

  const improved = delta > 0
  return (
    <span className={`delta delta-${improved ? 'up' : 'down'}`}>
      {formatPosition(Math.abs(delta))} {improved ? 'بهتر' : 'بدتر'}
    </span>
  )
}

interface CtrProps {
  /** تفاوت بر حسب واحد درصد (نه نسبت) */
  points: number
}

/** تغییر CTR بر حسب واحد درصد — «۰٫۸۰ واحد» نه «۲۰٪ رشد» */
export function DeltaCtr({ points }: CtrProps) {
  if (Math.abs(points) < 0.005) return <span className="delta delta-flat">بدون تغییر</span>
  return (
    <span className={`delta delta-${tone(points)}`}>
      {signed(points, pointsFa.format(Math.abs(points)))} واحد
    </span>
  )
}
