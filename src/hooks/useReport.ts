import { useCallback, useEffect, useRef, useState } from 'react'
import type { DateRange, FetchProgress, ReportData } from '../types'
import { readReport, writeReport } from '../lib/cache'
import { fetchAllPageRows, fetchAllRows, fetchSiteTotals } from '../lib/gscApi'
import { GscError, isGscError, networkError } from '../lib/errors'

export type ReportStatus = 'idle' | 'loadingCache' | 'fetching' | 'ready' | 'error'

export interface ReportState {
  status: ReportStatus
  report: ReportData | null
  error: GscError | null
  progress: FetchProgress | null
  /** داده از کش آمده یا تازه از گوگل گرفته شده */
  fromCache: boolean
  /** دریافت مجدد با دور زدن کش */
  refresh: () => void
}

interface Params {
  siteUrl: string | null
  range: DateRange
  token: string | null
  /** وقتی گوگل ۴۰۱ داد تا اپ حالت «منقضی» را نشان دهد */
  onAuthExpired: () => void
}

export function useReport({ siteUrl, range, token, onAuthExpired }: Params): ReportState {
  const [status, setStatus] = useState<ReportStatus>('idle')
  const [report, setReport] = useState<ReportData | null>(null)
  const [error, setError] = useState<GscError | null>(null)
  const [progress, setProgress] = useState<FetchProgress | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  /** با کلیک روی «به‌روزرسانی داده» کش خوانده نمی‌شود */
  const bypassCache = useRef(false)
  const authExpiredRef = useRef(onAuthExpired)
  authExpiredRef.current = onAuthExpired

  const refresh = useCallback(() => {
    bypassCache.current = true
    setReloadKey((k) => k + 1)
  }, [])

  useEffect(() => {
    if (!siteUrl) {
      setStatus('idle')
      setReport(null)
      setError(null)
      setProgress(null)
      return
    }

    const controller = new AbortController()
    const skipCache = bypassCache.current
    bypassCache.current = false
    let active = true

    const run = async () => {
      setError(null)
      setProgress(null)

      if (!skipCache) {
        setStatus('loadingCache')
        const cached = await readReport(siteUrl, range)
        if (!active) return
        if (cached) {
          setReport(cached)
          setFromCache(true)
          setStatus('ready')
          // رکوردهای کش‌شده‌ی قدیمی آمار کل سایت و نمای صفحه‌محور را ندارند.
          // هر دو کوچک‌اند، پس بدون دانلود دوباره‌ی کل سطرهای کوئری تکمیلشان می‌کنیم.
          const needsTotals = !cached.siteTotals
          const needsPages = !cached.pageRows
          if ((needsTotals || needsPages) && token) {
            try {
              const req = { token, signal: controller.signal }
              const [totals, pageRows] = await Promise.all([
                needsTotals ? fetchSiteTotals(siteUrl, range, req) : cached.siteTotals,
                needsPages ? fetchAllPageRows(siteUrl, range, req) : cached.pageRows,
              ])
              if (!active) return
              const filled = { ...cached, siteTotals: totals, pageRows }
              setReport(filled)
              void writeReport(filled)
            } catch {
              /* بدون این دو هم گزارش کوئری‌محور قابل استفاده است */
            }
          }
          return
        }
      }

      if (!token) {
        // کش نداشتیم و توکن هم نداریم: کاربر باید دوباره وارد شود
        if (!active) return
        setStatus('error')
        setError(
          new GscError({
            kind: 'auth',
            title: 'برای دریافت داده باید وارد شوید',
            hint: 'دسترسی شما به گوگل فعال نیست. دوباره وارد حساب گوگل شوید تا داده دریافت شود.',
          }),
        )
        return
      }

      setStatus('fetching')
      try {
        // اول آمار کل سایت (یک درخواست سریع) تا اگر گرفتن سطرها طول کشید،
        // عددِ مرجع از قبل آماده باشد. شکستش نباید کل گزارش را از کار بیندازد.
        let siteTotals: Awaited<ReturnType<typeof fetchSiteTotals>> | undefined
        try {
          siteTotals = await fetchSiteTotals(siteUrl, range, {
            token,
            signal: controller.signal,
          })
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') throw e
          if (isGscError(e) && e.kind === 'auth') throw e
        }

        // نمای صفحه‌محور اول: سطرش خیلی کمتر است و سریع می‌آید
        const pageRows = await fetchAllPageRows(
          siteUrl,
          range,
          { token, signal: controller.signal },
          (p) => {
            if (active) setProgress(p)
          },
        )
        if (!active) return

        const rows = await fetchAllRows(
          siteUrl,
          range,
          { token, signal: controller.signal },
          (p) => {
            if (active) setProgress(p)
          },
        )
        if (!active) return
        const next: ReportData = {
          siteUrl,
          range,
          rows,
          pageRows,
          siteTotals,
          fetchedAt: Date.now(),
        }
        setReport(next)
        setFromCache(false)
        setStatus('ready')
        void writeReport(next)
      } catch (e) {
        if (!active) return
        if (e instanceof DOMException && e.name === 'AbortError') return
        const gscError = isGscError(e) ? e : networkError(e)
        setError(gscError)
        setStatus('error')
        if (gscError.kind === 'auth') authExpiredRef.current()
      }
    }

    void run()

    return () => {
      active = false
      controller.abort()
    }
    // range یک شیء تازه در هر رندر نیست چون در App با useMemo ساخته می‌شود
  }, [siteUrl, range, token, reloadKey])

  return { status, report, error, progress, fromCache, refresh }
}
