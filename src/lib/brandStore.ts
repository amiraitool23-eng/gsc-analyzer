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
