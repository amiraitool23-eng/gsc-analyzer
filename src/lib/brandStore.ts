import { guessBrandTerms } from './brand'

/**
 * کلمات برند هر پراپرتی در همین مرورگر ذخیره می‌شوند.
 *
 * این‌ها رمز نیستند (نام برند خود کاربر است) و ذخیره‌شان همان قاعده‌ی Client ID
 * را دارد، نه قاعده‌ی توکن. بدون ذخیره، کاربر باید هر بار نام فارسی برندش را
 * دوباره تایپ کند.
 */
const PREFIX = 'gsc-analyzer:brand:'

export function loadBrandTerms(siteUrl: string): string[] {
  try {
    const raw = localStorage.getItem(PREFIX + siteUrl)
    if (raw === null) return guessBrandTerms(siteUrl)
    const parsed = JSON.parse(raw) as unknown
    // فهرست خالیِ ذخیره‌شده معتبر است: یعنی کاربر عمداً همه را حذف کرده
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : []
  } catch {
    return guessBrandTerms(siteUrl)
  }
}

export function saveBrandTerms(siteUrl: string, terms: readonly string[]): void {
  try {
    localStorage.setItem(PREFIX + siteUrl, JSON.stringify(terms))
  } catch {
    /* بدون ذخیره هم همان نشست کار می‌کند */
  }
}

/**
 * کلمات برندی که کاربر **تأیید کرده** و فرصت‌ها بر اساسشان حساب شده.
 *
 * جدا از فهرست بالا نگه داشته می‌شود، چون حدسِ خودکار هرگز کامل نیست: نام فارسی
 * برند از دامنه درنمی‌آید. تا وقتی کاربر یک بار تأیید نکرده، فهرست فرصت‌ها اصلاً
 * ساخته نمی‌شود؛ و اگر بعداً کلمه‌ای عوض شود، اختلاف این دو فهرست نشان می‌دهد که
 * نتیجه‌ی روی صفحه کهنه شده است.
 */
const CONFIRMED_PREFIX = 'gsc-analyzer:brand-confirmed:'

export function loadConfirmedTerms(siteUrl: string): string[] | null {
  try {
    const raw = localStorage.getItem(CONFIRMED_PREFIX + siteUrl)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : null
  } catch {
    return null
  }
}

export function saveConfirmedTerms(siteUrl: string, terms: readonly string[]): void {
  try {
    localStorage.setItem(CONFIRMED_PREFIX + siteUrl, JSON.stringify(terms))
  } catch {
    /* بدون ذخیره هم همان نشست کار می‌کند */
  }
}

/** دو فهرست کلمه، بدون توجه به ترتیب، یکی‌اند؟ */
export function sameTerms(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((t, i) => t === sortedB[i])
}
