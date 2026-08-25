/**
 * تشخیص کوئری‌های برند.
 *
 * چرا لازم است؟ صفحه‌ای که برای اسم برند رتبه‌ی ۱ دارد CTR خیلی بالایی می‌گیرد
 * (کاربر از قبل دنبال همان سایت بوده). اگر این‌ها در ساخت منحنی CTR بمانند،
 * سقف منحنی در موقعیت‌های بالا به‌شکل کاذب بالا می‌رود و بعد **همه‌ی** صفحات
 * دیگر «ضعیف» به نظر می‌رسند.
 */

/**
 * پسوندهای رایجی که جزو نام برند نیستند.
 * کامل نیست و لازم هم نیست باشد: خروجی فقط یک **حدس** است که کاربر می‌تواند
 * اصلاحش کند.
 */
const COMMON_TLDS = new Set([
  'ir', 'com', 'net', 'org', 'co', 'ac', 'gov', 'edu', 'info', 'biz',
  'io', 'dev', 'app', 'site', 'online', 'shop', 'store', 'blog', 'me',
  'xyz', 'pro', 'tech', 'news', 'tv', 'cc', 'uk', 'de', 'fr', 'ru',
])

/** نرمال‌سازی متن فارسی برای مقایسه: عربی→فارسی، حذف نیم‌فاصله و اعراب */
export function normalizeFa(text: string): string {
  return text
    .toLowerCase()
    .replace(/‌/g, '') // نیم‌فاصله
    .replace(/[ً-ْ]/g, '') // اعراب
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .trim()
}

/**
 * نرمال‌سازی برای **تطبیق** — علاوه بر بالا، فاصله‌ها هم حذف می‌شوند.
 *
 * چرا؟ نام فارسی یک برند را کاربران به سه شکل می‌نویسند: با فاصله
 * («دیجی کالا»)، با نیم‌فاصله («دیجی‌کالا») و سرِ هم («دیجیکالا»). اگر کاربر
 * فقط یکی از این‌ها را وارد کند، بقیه‌ی کوئری‌های برند در منحنی می‌مانند و
 * دقیقاً همان چیزی می‌شود که این ویژگی برای جلوگیری از آن ساخته شده.
 *
 * هزینه‌اش این است که تطبیق می‌تواند از مرز کلمه رد شود؛ چون کلمات برند
 * اسم خاص‌اند این ریسک در عمل ناچیز است و کاربر هم می‌تواند کلمه را حذف کند.
 */
export function normalizeForMatch(text: string): string {
  return normalizeFa(text).replace(/\s+/g, '')
}

/** دامنه‌ی پراپرتی، چه Domain باشد چه URL-prefix */
export function hostOf(siteUrl: string): string {
  const raw = siteUrl.startsWith('sc-domain:')
    ? siteUrl.slice('sc-domain:'.length)
    : siteUrl
  let host = raw
  try {
    if (/^https?:\/\//i.test(raw)) host = new URL(raw).hostname
  } catch {
    /* اگر URL نامعتبر بود، همان رشته‌ی خام */
  }
  return host.replace(/^www\./i, '').replace(/\/+$/, '').toLowerCase()
}

/**
 * حدس اولیه‌ی کلمات برند از روی دامنه.
 *
 * فقط لاتین را می‌تواند حدس بزند؛ نام فارسی برند («ای‌وی‌گارد») از دامنه
 * قابل استخراج نیست و کاربر باید خودش اضافه کند. برای همین UI این فهرست را
 * نشان می‌دهد و اجازه‌ی ویرایش می‌دهد، نه اینکه پشت صحنه اعمالش کند.
 */
export function guessBrandTerms(siteUrl: string): string[] {
  const host = hostOf(siteUrl)
  if (!host) return []

  const terms = new Set<string>([host])
  const labels = host.split('.').filter(Boolean)
  const meaningful = labels.filter((l) => !COMMON_TLDS.has(l))
  // مشخص‌ترین برچسبِ غیرپسوند معمولاً نام برند است
  const brand = meaningful[meaningful.length - 1]
  if (brand && brand.length >= 3) terms.add(brand)

  return [...terms]
}

/**
 * یک تابع تطبیق می‌سازد که می‌گوید آیا کوئری برندی است.
 * تطبیق «شامل بودن» است نه برابری، چون کوئری برند معمولاً ترکیبی است
 * («ورود aivanguard»، «aivanguard قیمت»).
 */
export function makeBrandMatcher(terms: readonly string[]): (query: string) => boolean {
  const needles = terms.map(normalizeForMatch).filter((t) => t !== '')
  if (needles.length === 0) return () => false
  return (query: string) => {
    const q = normalizeForMatch(query)
    return needles.some((n) => q.includes(n))
  }
}
