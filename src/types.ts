/** یک پراپرتی (سایت) در سرچ کنسول */
export interface GscSite {
  /** برای پراپرتی Domain به شکل `sc-domain:example.com` و برای URL-prefix یک URL کامل است. */
  siteUrl: string
  permissionLevel: string
}

/**
 * یک سطر با بُعد `page` تنها.
 *
 * این نما به آمار واقعی سایت نزدیک است: کلیک‌های کوئری‌های ناشناس هم به صفحه
 * نسبت داده می‌شوند، پس برخلاف نمای کوئری‌محور چیزی از قلم نمی‌افتد.
 */
export interface GscPageRow {
  page: string
  clicks: number
  impressions: number
  /** از API به صورت نسبت اعشاری می‌آید (۰٫۰۴۸ یعنی ۴٫۸٪) */
  ctr: number
  /** میانگین موقعیت این سطر؛ برای تجمیع باید وزنی با impressions حساب شود */
  position: number
}

/** یک سطر داده‌ی searchAnalytics با ابعاد page + query */
export interface GscRow extends GscPageRow {
  query: string
}

/** بازه‌ی تاریخی گزارش (هر دو به شکل YYYY-MM-DD) */
export interface DateRange {
  startDate: string
  endDate: string
}

/**
 * آمار کل پراپرتی در همان بازه — بدون هیچ بُعدی.
 *
 * این همان عددی است که صفحه‌ی Performance سرچ کنسول بالای نمودار نشان می‌دهد.
 * با جمع سطرهای بُعد Query **نمی‌خواند** و نباید بخواند: گوگل کوئری‌های کم‌تکرار
 * را گزارش نمی‌کند ولی کلیکشان در این آمار کل هست. نگه‌داشتن این عدد تنها راهی
 * است که کاربر بفهمد چقدر از داده‌اش پشت کوئری‌های ناشناس پنهان مانده.
 */
export interface SiteTotals {
  clicks: number
  impressions: number
  /** نسبت اعشاری، مثل بقیه‌ی جاها */
  ctr: number
  position: number
}

/** داده‌ی یک گزارش، همان چیزی که در IndexedDB کش می‌شود */
export interface ReportData {
  siteUrl: string
  range: DateRange
  /** نمای کوئری‌محور: بُعد page + query */
  rows: GscRow[]
  /** نمای صفحه‌محور: فقط بُعد page. در کش‌های قدیمی نیست و موقع خواندن تکمیل می‌شود. */
  pageRows?: GscPageRow[]
  /** آمار کل سایت؛ ممکن است نباشد (کش قدیمی یا خطای همان یک درخواست) */
  siteTotals?: SiteTotals
  /** زمان دریافت داده از گوگل (میلی‌ثانیه) */
  fetchedAt: number
}

export type FetchProgress = {
  /** تعداد سطرهای دریافت‌شده تا این لحظه */
  rowsFetched: number
  /** شماره‌ی درخواست فعلی (هر درخواست حداکثر ۲۵۰۰۰ سطر) */
  page: number
}
