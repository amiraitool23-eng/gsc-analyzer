import type { GscRow } from '../types'

/**
 * منحنی CTR بر حسب موقعیت — از داده‌ی **خود سایت**.
 *
 * چرا نه یک آستانه‌ی ثابت مثل «CTR < ۳٪»؟
 * چون CTR عمدتاً تابع موقعیت است. صفحه‌ای در موقعیت ۱ با CTR ۳٪ فاجعه است و
 * صفحه‌ای در موقعیت ۱۵ با همان ۳٪ عالی. یک عدد ثابت هر دو را یکسان قضاوت می‌کند.
 *
 * چرا نه منحنی‌های صنعتی منتشرشده؟ آن‌ها تقریباً همه از داده‌ی انگلیسی‌زبان و
 * SERP آمریکا هستند. منحنیِ خود سایت، زبان و صنعت و اثر برند و شکل نتایج را
 * خودبه‌خود در خودش دارد و به هیچ داده‌ی بیرونی نیاز ندارد.
 *
 * منحنی از سطرهای **کوئری‌محور** ساخته می‌شود، نه صفحه‌محور: موقعیت یک کوئری
 * عدد واقعی است، ولی موقعیت یک صفحه میانگین چند کوئری با موقعیت‌های متفاوت
 * است و برای ساخت منحنی گمراه‌کننده می‌شود.
 */

/** مرزهای سطل‌های موقعیت؛ نزدیک صدر ریزتر، چون تفاوت CTR آنجا شدیدتر است */
const BUCKET_EDGES = [1, 2, 3, 4, 5, 6, 8, 11, 16, 21, 31, 51, Infinity]

/** زیر این تعداد سطر، میانه‌ی سطل قابل اتکا نیست */
const MIN_ROWS_PER_BUCKET = 5

/** با کمتر از این تعداد نقطه، درون‌یابی بی‌معنی است */
const MIN_POINTS = 2

export interface CurvePoint {
  /** میانه‌ی موقعیت سطرهای این سطل (نه وسط بازه — واقعی‌تر است) */
  position: number
  /** میانه‌ی CTR سطرهای این سطل، به‌صورت نسبت */
  ctr: number
  rows: number
}

export interface CtrCurve {
  points: CurvePoint[]
  /** آیا منحنی قابل استفاده است */
  available: boolean
  /** چند سطر به‌خاطر برند کنار گذاشته شد */
  brandRowsExcluded: number
  /** چند سطر در ساخت منحنی استفاده شد */
  rowsUsed: number
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * ساخت منحنی از سطرهای کوئری‌محور.
 * @param isBrand کوئری‌های برند از منحنی کنار گذاشته می‌شوند
 */
export function buildCtrCurve(
  rows: readonly GscRow[],
  isBrand: (query: string) => boolean = () => false,
): CtrCurve {
  const usable = rows.filter((r) => r.impressions > 0 && r.position >= 1)
  const brandRows = usable.filter((r) => isBrand(r.query))
  const nonBrand = usable.filter((r) => !isBrand(r.query))

  const points: CurvePoint[] = []
  for (let i = 0; i < BUCKET_EDGES.length - 1; i++) {
    const from = BUCKET_EDGES[i]
    const to = BUCKET_EDGES[i + 1]
    const inBucket = nonBrand.filter((r) => r.position >= from && r.position < to)
    if (inBucket.length < MIN_ROWS_PER_BUCKET) continue
    points.push({
      position: median(inBucket.map((r) => r.position)),
      ctr: median(inBucket.map((r) => r.ctr)),
      rows: inBucket.length,
    })
  }

  points.sort((a, b) => a.position - b.position)

  return {
    points,
    available: points.length >= MIN_POINTS,
    brandRowsExcluded: brandRows.length,
    rowsUsed: nonBrand.length,
  }
}

/**
 * CTR انتظاری برای یک موقعیت، با درون‌یابی خطی بین نقاط منحنی.
 * بیرون از بازه‌ی نقاط، به نزدیک‌ترین نقطه چسبانده می‌شود (بیرون‌یابی نمی‌کنیم:
 * برای موقعیت ۸۰ که داده‌ای نداریم، حدس زدن بدتر از محتاط بودن است).
 */
export function expectedCtr(curve: CtrCurve, position: number): number | null {
  if (!curve.available) return null
  const pts = curve.points
  if (position <= pts[0].position) return pts[0].ctr
  if (position >= pts[pts.length - 1].position) return pts[pts.length - 1].ctr

  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    if (position >= a.position && position <= b.position) {
      const span = b.position - a.position
      if (span === 0) return a.ctr
      const t = (position - a.position) / span
      return a.ctr + t * (b.ctr - a.ctr)
    }
  }
  return pts[pts.length - 1].ctr
}
