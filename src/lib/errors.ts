/** دسته‌بندی خطاهایی که در کار با GSC معنی‌دار است و UI بر اساس آن تصمیم می‌گیرد. */
export type GscErrorKind =
  /** توکن منقضی/باطل شده — کاربر باید دوباره وارد شود (۴۰۱) */
  | 'auth'
  /** دسترسی رد شد — Test users یا فعال نبودن API (۴۰۳) */
  | 'forbidden'
  /** سقف نرخ درخواست (۴۲۹ یا ۵xx مکرر) */
  | 'rateLimit'
  /** قطعی شبکه / فیلترینگ / CORS */
  | 'network'
  /** ورودی نامعتبر (۴۰۰) */
  | 'badRequest'
  /** هر چیز دیگر */
  | 'unknown'

export interface GscErrorDetails {
  kind: GscErrorKind
  /** عنوان کوتاه فارسی برای نمایش */
  title: string
  /** توضیح و راهنمای رفع، فارسی */
  hint: string
  /** کد وضعیت HTTP در صورت وجود */
  status?: number
  /** پیام خام گوگل، برای دیباگ */
  raw?: string
}

export class GscError extends Error implements GscErrorDetails {
  kind: GscErrorKind
  title: string
  hint: string
  status?: number
  raw?: string

  constructor(details: GscErrorDetails) {
    super(`${details.title} — ${details.hint}`)
    this.name = 'GscError'
    this.kind = details.kind
    this.title = details.title
    this.hint = details.hint
    this.status = details.status
    this.raw = details.raw
  }
}

export function isGscError(e: unknown): e is GscError {
  return e instanceof GscError
}

/** ساخت خطای دسته‌بندی‌شده از پاسخ HTTP گوگل */
export function errorFromResponse(status: number, rawBody: string): GscError {
  const raw = extractGoogleMessage(rawBody)

  if (status === 401) {
    return new GscError({
      kind: 'auth',
      status,
      raw,
      title: 'دسترسی شما منقضی شده است',
      hint:
        'توکن دسترسی گوگل حدوداً یک ساعت اعتبار دارد و مهلتش تمام شده. ' +
        'برای ادامه، دوباره وارد حساب گوگل شوید. داده‌های کش‌شده‌ی شما پاک نمی‌شود.',
    })
  }

  if (status === 403) {
    return new GscError({
      kind: 'forbidden',
      status,
      raw,
      title: 'دسترسی رد شد (۴۰۳)',
      hint:
        'محتمل‌ترین دلیل‌ها:\n' +
        '۱) اپ گوگل شما در حالت Testing است و ایمیل شما در فهرست Test users اضافه نشده. ' +
        '(Google Cloud Console → APIs & Services → OAuth consent screen → Test users)\n' +
        '۲) سرویس Google Search Console API در پروژه‌ی گوگل‌کلاد فعال نشده. ' +
        '(APIs & Services → Library → Google Search Console API → Enable)\n' +
        '۳) حساب گوگلی که با آن وارد شده‌اید روی این پراپرتی دسترسی ندارد.',
    })
  }

  if (status === 429) {
    return new GscError({
      kind: 'rateLimit',
      status,
      raw,
      title: 'سقف تعداد درخواست گوگل پر شد (۴۲۹)',
      hint:
        'گوگل موقتاً درخواست‌های بیشتر را رد می‌کند. ابزار به‌صورت خودکار چند بار با ' +
        'فاصله‌ی افزایشی تلاش می‌کند؛ اگر باز هم نشد، چند دقیقه صبر کنید و «به‌روزرسانی داده» را بزنید.',
    })
  }

  if (status === 400) {
    return new GscError({
      kind: 'badRequest',
      status,
      raw,
      title: 'درخواست نامعتبر بود (۴۰۰)',
      hint:
        'معمولاً یعنی آدرس پراپرتی یا بازه‌ی تاریخ درست ساخته نشده. ' +
        'پراپرتی دیگری را امتحان کنید یا صفحه را دوباره باز کنید.' +
        (raw ? `\nپیام گوگل: ${raw}` : ''),
    })
  }

  if (status >= 500) {
    return new GscError({
      kind: 'rateLimit',
      status,
      raw,
      title: `خطای موقت سمت گوگل (${status})`,
      hint: 'سرور گوگل موقتاً پاسخ نداد. ابزار دوباره تلاش می‌کند؛ در صورت تکرار کمی بعد امتحان کنید.',
    })
  }

  return new GscError({
    kind: 'unknown',
    status,
    raw,
    title: `خطای ناشناخته از گوگل (${status})`,
    hint: raw || 'جزئیات بیشتری از گوگل دریافت نشد.',
  })
}

/** خطای شبکه (fetch رد شده) — در ایران معمولاً یعنی نیاز به تغییر مسیر شبکه */
export function networkError(cause?: unknown): GscError {
  return new GscError({
    kind: 'network',
    raw: cause instanceof Error ? cause.message : String(cause ?? ''),
    title: 'اتصال به گوگل برقرار نشد',
    hint:
      'درخواست به سرورهای گوگل ناموفق بود. اتصال اینترنت و دسترسی به سرویس‌های گوگل ' +
      '(googleapis.com و accounts.google.com) را بررسی کنید و دوباره تلاش کنید.',
  })
}

function extractGoogleMessage(body: string): string {
  if (!body) return ''
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } }
    return parsed.error?.message ?? body.slice(0, 300)
  } catch {
    return body.slice(0, 300)
  }
}
