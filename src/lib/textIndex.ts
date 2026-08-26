import { normalizeFa } from './brand'
import { foldDigits } from './faDigits'

/**
 * توکن‌سازی و نمایه‌ی متنی برای تطبیق «عبارت جست‌وجو» با «عنوان صفحه‌های سایت».
 *
 * چرا `normalizeForMatch` (که فاصله‌ها را حذف می‌کند) اینجا به کار نمی‌آید؟ آنجا
 * سؤال «آیا این کوئری شامل نام برند است» بود و یک رشته‌ی چسبیده کافی بود. اینجا
 * سؤال «چند کلمه از این عبارت در عنوان آن صفحه هست» است، پس به کلمه‌ی جدا نیاز
 * داریم.
 */

/**
 * کلمات پرتکرارِ بی‌بار معنایی.
 *
 * اگر حذف نشوند، هر عنوانی با هر عبارتی «کمی» مشترک می‌شود و پوشش بی‌معنی
 * می‌شود: «آموزش زبان در استانبول» و «قیمت گوشی در تهران» هر دو «در» دارند.
 */
const STOPWORDS = new Set([
  'و', 'در', 'به', 'از', 'که', 'این', 'با', 'را', 'برای', 'است', 'بر', 'تا',
  'یا', 'هم', 'می', 'بی', 'اگر', 'چه', 'چون', 'آن', 'یک', 'ها', 'های', 'هایی',
  'ای', 'شود', 'شده', 'کرد', 'کند', 'باید', 'بود', 'نیز', 'روی', 'هر', 'همه',
  'the', 'a', 'an', 'of', 'to', 'in', 'for', 'and', 'or', 'is', 'are', 'on',
])

/** کوتاه‌تر از این، توکن معناداری نیست */
const MIN_TOKEN = 2

/** پسوندهای جمع و نسبت که همان کلمه را دو شکل می‌کنند */
const SUFFIXES = ['هایی', 'های', 'ها', 'ترین', 'تر']

/**
 * ریشه‌گیری خیلی سبک.
 *
 * فارسی صرف پیچیده‌ای دارد و ریشه‌یاب کامل خارج از حوصله‌ی این ابزار است؛ ولی
 * بدون همین حداقل، «سریال» و «سریال‌های» دو کلمه‌ی متفاوت شمرده می‌شوند و
 * عنوانی که دقیقاً درباره‌ی همان موضوع است پوشش نمی‌دهد.
 */
function stem(token: string): string {
  for (const suffix of SUFFIXES) {
    if (token.length >= suffix.length + 3 && token.endsWith(suffix)) {
      return token.slice(0, -suffix.length)
    }
  }
  return token
}

/** متن → فهرست توکن‌های یکتا و نرمال‌شده */
export function tokenize(text: string): string[] {
  const normalized = foldDigits(normalizeFa(text))
  const out = new Set<string>()
  // هر چیزی که حرف یا رقم نیست جداکننده است: فاصله، خط تیره‌ی آدرس، نقطه، …
  for (const raw of normalized.split(/[^\p{L}\p{N}]+/u)) {
    if (raw.length < MIN_TOKEN || STOPWORDS.has(raw)) continue
    const token = stem(raw)
    if (token.length >= MIN_TOKEN && !STOPWORDS.has(token)) out.add(token)
  }
  return [...out]
}

export interface CoverageMatch {
  /** کسر وزنی کلماتِ عبارت که در بهترین سند پیدا شد (۰ تا ۱) */
  coverage: number
  /** شماره‌ی آن سند، یا ۱- اگر هیچ سند قابل قبولی نبود */
  doc: number
  /** چند توکنِ خام مشترک بود */
  matched: number
}

/**
 * نمایه‌ی معکوس با وزن‌دهی IDF.
 *
 * بدون نمایه، برای هر عبارت باید همه‌ی صفحه‌ها را می‌گشتیم؛ با چند هزار کوئری و
 * چند هزار صفحه این یعنی میلیون‌ها مقایسه در مرورگر.
 *
 * **چرا کلمات هم‌وزن نیستند؟** روی داده‌ی واقعی معلوم شد: در یک سایت آموزش زبان،
 * کلمه‌ی «زبان» تقریباً در هر عنوانی هست و هیچ اطلاعاتی نمی‌دهد. عبارت
 * «مدرک زبان اسپانیایی» با شمارش ساده ۶۷٪ پوشش گرفت (چون «زبان» در آن عنوانِ
 * خاص نبود) و به‌غلط «کمبود محتوا» علامت خورد، در حالی که صفحه‌اش دقیقاً وجود
 * داشت. با IDF، نبودنِ «زبان» تقریباً بی‌هزینه است و نبودنِ «مشهد» — که در هیچ
 * عنوانی نیست — سنگین.
 *
 * توکنی که در **هیچ** سندی نیست بیشترین وزن را می‌گیرد، و این درست است: کلمه‌ای
 * که هیچ‌جای سایت نیامده قوی‌ترین نشانه‌ی نبودِ صفحه است.
 */
export class TokenIndex {
  private readonly postings = new Map<string, number[]>()
  private readonly size: number

  constructor(documents: readonly string[][]) {
    this.size = documents.length
    documents.forEach((tokens, docIndex) => {
      for (const token of tokens) {
        const list = this.postings.get(token)
        if (list) list.push(docIndex)
        else this.postings.set(token, [docIndex])
      }
    })
  }

  /** وزن یک توکن: هرچه در سندهای کمتری باشد، معنادارتر */
  weight(token: string): number {
    const df = this.postings.get(token)?.length ?? 0
    return Math.log(this.size / (1 + df)) + 1
  }

  /**
   * بهترین سند برای این عبارت، با پوشش وزنی.
   * @param minMatched کمتر از این تعداد توکنِ مشترک، اصلاً تطبیق حساب نمی‌شود
   */
  bestCoverage(tokens: readonly string[], minMatched: number): CoverageMatch {
    if (tokens.length === 0 || this.size === 0) return { coverage: 0, doc: -1, matched: 0 }

    const weights = new Map<string, number>()
    let total = 0
    for (const token of tokens) {
      const w = this.weight(token)
      weights.set(token, w)
      total += w
    }
    if (total <= 0) return { coverage: 0, doc: -1, matched: 0 }

    const scores = new Map<number, { weighted: number; matched: number }>()
    for (const token of tokens) {
      const list = this.postings.get(token)
      if (!list) continue
      const w = weights.get(token) ?? 0
      for (const doc of list) {
        const entry = scores.get(doc) ?? { weighted: 0, matched: 0 }
        entry.weighted += w
        entry.matched += 1
        scores.set(doc, entry)
      }
    }

    let best: CoverageMatch = { coverage: 0, doc: -1, matched: 0 }
    for (const [doc, { weighted, matched }] of scores) {
      if (matched < minMatched) continue
      const coverage = weighted / total
      if (coverage > best.coverage) best = { coverage, doc, matched }
    }
    return best
  }
}
