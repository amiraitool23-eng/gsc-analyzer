import { useMemo } from 'react'
import type { GscRow } from '../types'
import { makeBrandMatcher } from '../lib/brand'
import { loadBrandTerms, loadConfirmedTerms } from '../lib/brandStore'
import { buildCtrCurve } from '../lib/ctrCurve'

/**
 * منحنی CTR سایت و تابع تشخیص برند، از کلمات **تأییدشده**.
 *
 * تب «فرصت‌ها» کلمات برند را می‌گیرد و تأیید می‌کند؛ تحلیل‌های دیگر هم به همان
 * نیاز دارند و نباید محاسبه‌ی موازیِ خودشان را داشته باشند. اگر کاربر هنوز تأیید
 * نکرده، از حدس خودکار استفاده می‌شود و `confirmed` برابر false است تا UI بتواند
 * بگوید نتیجه هنوز روی حدس ایستاده.
 */
export function useSiteCurve(siteUrl: string, queryRows: readonly GscRow[]) {
  const confirmedTerms = useMemo(() => loadConfirmedTerms(siteUrl), [siteUrl])
  const terms = useMemo(
    () => confirmedTerms ?? loadBrandTerms(siteUrl),
    [confirmedTerms, siteUrl],
  )
  const isBrand = useMemo(() => makeBrandMatcher(terms), [terms])
  const curve = useMemo(() => buildCtrCurve(queryRows, isBrand), [queryRows, isBrand])
  return { curve, isBrand, terms, confirmed: confirmedTerms !== null }
}
