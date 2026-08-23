/** یک پراپرتی (سایت) در سرچ کنسول */
export interface GscSite {
  /** برای پراپرتی Domain به شکل `sc-domain:example.com` و برای URL-prefix یک URL کامل است. */
  siteUrl: string
  permissionLevel: string
}

/** یک سطر داده‌ی searchAnalytics با ابعاد page + query */
export interface GscRow {
  page: string
  query: string
  clicks: number
  impressions: number
  /** از API به صورت نسبت اعشاری می‌آید (۰٫۰۴۸ یعنی ۴٫۸٪) */
  ctr: number
  /** میانگین موقعیت این سطر؛ برای تجمیع باید وزنی با impressions حساب شود */
  position: number
}

/** بازه‌ی تاریخی گزارش (هر دو به شکل YYYY-MM-DD) */
export interface DateRange {
  startDate: string
  endDate: string
}

/** داده‌ی یک گزارش، همان چیزی که در IndexedDB کش می‌شود */
export interface ReportData {
  siteUrl: string
  range: DateRange
  rows: GscRow[]
  /** زمان دریافت داده از گوگل (میلی‌ثانیه) */
  fetchedAt: number
}

export type FetchProgress = {
  /** تعداد سطرهای دریافت‌شده تا این لحظه */
  rowsFetched: number
  /** شماره‌ی درخواست فعلی (هر درخواست حداکثر ۲۵۰۰۰ سطر) */
  page: number
}
