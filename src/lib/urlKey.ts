/**
 * کلید یکسان‌سازی آدرس، برای چسباندن دادهٔ سرچ کنسول به خروجی کراول.
 *
 * چرا لازم است؟ دو منبع یک صفحه را به دو شکل می‌نویسند و اگر خام مقایسه شوند
 * تقریباً هیچ‌کدام مچ نمی‌شوند — و بدتر اینکه **بی‌صدا** مچ نمی‌شوند: ابزار
 * می‌گوید «برای این عبارت صفحه‌ای ندارید» در حالی که صفحه هست.
 *
 * تفاوت‌های واقعی که دیده می‌شوند:
 *   - سرچ کنسول آدرس فارسی را درصدکدشده می‌دهد (`/%D8%B3%D8%A6%D9%88`)،
 *     کراول اغلب رمزگشایی‌شده (`/سئو`)
 *   - اسلش انتهایی هست یا نیست
 *   - `www.` هست یا نیست
 *   - `http` در برابر `https`
 *   - پارامترهای ردیابی (`?utm_source=…`) که صفحه را عوض نمی‌کنند
 *   - ترتیب پارامترها
 *   - شکل یونیکد فارسی (NFC در برابر NFD) که چشم فرقش را نمی‌بیند ولی
 *     `===` می‌بیند
 */

/**
 * پارامترهایی که محتوای صفحه را عوض نمی‌کنند و باید از کلید حذف شوند.
 * عمداً محافظه‌کارانه است: `page` یا `id` اینجا نیستند چون واقعاً صفحهٔ دیگری‌اند.
 */
const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'gclid', 'gclsrc', 'dclid', 'fbclid', 'yclid', 'msclkid', 'igshid',
  'mc_cid', 'mc_eid', '_ga', '_gl',
])

function decodeSafe(text: string): string {
  try {
    return decodeURIComponent(text)
  } catch {
    // درصدِ تنها یا کدگذاری خراب: همان خام بهتر از پرتاب خطاست
    return text
  }
}

function toUrl(raw: string): URL | null {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  try {
    // آدرس بدون پروتکل هم قبول است؛ پروتکل در کلید نمی‌آید
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    // `mailto:a@b.c` پروتکلِ `//` ندارد، پس بالا `https://` می‌گیرد و URL آن را
    // «کاربر mailto با رمز a روی میزبان b.c» می‌خواند. وجود نام کاربری یعنی این
    // رشته آدرس صفحه نبوده.
    if (url.username !== '' || url.password !== '') return null
    return url
  } catch {
    return null
  }
}

/**
 * کلید تطبیق یک آدرس. `null` یعنی آدرس قابل تفسیر نبود.
 *
 * پروتکل عمداً در کلید نیست: پراپرتی Domain در سرچ کنسول هر دو را پوشش می‌دهد و
 * کراول ممکن است یکی‌شان را دیده باشد.
 *
 * حروف مسیر **کوچک نمی‌شوند**. روی سرورهای حساس به حروف، `/A` و `/a` دو صفحهٔ
 * متفاوت‌اند و یکی کردنشان دو صفحه را اشتباهی روی هم می‌اندازد.
 */
export function normalizeUrlKey(raw: string): string | null {
  const url = toUrl(raw)
  if (url === null) return null

  const host = url.hostname.toLowerCase().replace(/^www\./, '')

  let path = decodeSafe(url.pathname).normalize('NFC')
  // اسلش انتهایی حذف می‌شود، ولی ریشه خودش یک اسلش می‌ماند
  if (path.length > 1) path = path.replace(/\/+$/, '')
  if (path === '') path = '/'

  // searchParams خودش مقادیر را رمزگشایی می‌کند؛ فقط باید مرتب و پالایش شوند
  const params = [...url.searchParams.entries()]
    .filter(([key]) => !TRACKING_PARAMS.has(key.toLowerCase()))
    .map(([key, value]) => [key.normalize('NFC'), value.normalize('NFC')] as const)
    .sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) : a[0] < b[0] ? -1 : 1))

  const query =
    params.length > 0
      ? `?${params.map(([k, v]) => (v === '' ? k : `${k}=${v}`)).join('&')}`
      : ''

  // fragment عمداً دور ریخته می‌شود: سرور همان صفحه را می‌دهد
  return host + path + query
}

/**
 * کلید سست‌تر: بدون هیچ پارامتری.
 *
 * برای **تطبیق** استفاده نمی‌شود (وگرنه `?page=2` روی صفحهٔ اول می‌افتد)، فقط
 * برای تشخیص اینکه چند آدرسِ مچ‌نشده «فقط به‌خاطر پارامتر» جا مانده‌اند — تا در
 * UI بشود به کاربر گفت مشکل کجاست.
 */
export function looseUrlKey(raw: string): string | null {
  const key = normalizeUrlKey(raw)
  if (key === null) return null
  const q = key.indexOf('?')
  return q === -1 ? key : key.slice(0, q)
}

/**
 * آیا این آدرس داخل محدودهٔ این پراپرتی سرچ کنسول است؟
 *
 * چرا لازم است؟ کراول معمولاً بیشتر از یک پراپرتی را می‌گیرد. در دادهٔ واقعی
 * اولین کاربر، فایل هم `blog.nimkat.org` داشت و هم `nimkat.org` — و هر ۲۵۷
 * صفحهٔ دومی صفر نمایش داشتند، چون سرچ کنسول فقط روی پراپرتی بلاگ وصل بود.
 *
 * بدون این تابع، آن ۲۵۷ صفحه به‌عنوان «محتوایی که هیچ کاری نمی‌کند» علامت
 * می‌خوردند، در حالی که فقط جای دیگری گزارش می‌شوند. یعنی دقیقاً همان «دادهٔ
 * ناقصی که کار سئوکار را بیشتر می‌کند».
 */
export function inPropertyScope(siteUrl: string, url: string): boolean {
  const target = normalizeUrlKey(url)
  if (target === null) return false

  if (siteUrl.startsWith('sc-domain:')) {
    // پراپرتی Domain همه‌ی زیردامنه‌ها را پوشش می‌دهد
    const domain = siteUrl.slice('sc-domain:'.length).toLowerCase().replace(/^www\./, '')
    if (domain === '') return false
    const host = target.split('/')[0]
    return host === domain || host.endsWith(`.${domain}`)
  }

  // پراپرتی URL-prefix: میزبان و ابتدای مسیر هر دو باید بخوانند
  const prefix = normalizeUrlKey(siteUrl)
  if (prefix === null) return false
  if (target === prefix) return true
  // مرز مسیر مهم است: `/blog` نباید `/blogfa` را هم بگیرد
  return target.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`)
}
