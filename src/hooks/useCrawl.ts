import { useCallback, useEffect, useState } from 'react'
import { parseCrawlCsv } from '../lib/crawlCsv'
import type { LoadedCrawl } from '../lib/crawlStore'
import { deleteCrawl, readCrawl, writeCrawl } from '../lib/crawlStore'

export type CrawlStatus =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'error'; message: string }

/**
 * وضعیت کراولِ وارد‌شده‌ی یک پراپرتی.
 *
 * جدا از کامپوننت است چون دو بخش به آن نیاز دارند: پنل ایمپورت، و تحلیل
 * «کمبودهای محتوا». اگر هرکدام state خودش را داشت، بعد از ایمپورت فقط یکی
 * به‌روز می‌شد.
 */
export function useCrawl(siteUrl: string) {
  const [crawl, setCrawl] = useState<LoadedCrawl | null>(null)
  const [status, setStatus] = useState<CrawlStatus>({ kind: 'idle' })

  useEffect(() => {
    let alive = true
    setCrawl(null)
    setStatus({ kind: 'idle' })
    void readCrawl(siteUrl).then((loaded) => {
      if (alive) setCrawl(loaded)
    })
    return () => {
      alive = false
    }
  }, [siteUrl])

  const importFile = useCallback(
    async (file: File) => {
      setStatus({ kind: 'reading' })
      try {
        const parsed = parseCrawlCsv(await file.text())
        if (parsed.missingColumns.length > 0 || parsed.pages.length === 0) {
          setStatus({
            kind: 'error',
            message:
              'ستون آدرس در این فایل پیدا نشد. مطمئن شوید خروجی تب Internal است (نه Bulk Export) و فرمتش CSV است.',
          })
          return
        }
        const importedAt = Date.now()
        await writeCrawl(siteUrl, parsed, file.name, importedAt)
        setCrawl({ ...parsed, fileName: file.name, importedAt })
        setStatus({ kind: 'idle' })
      } catch {
        setStatus({ kind: 'error', message: 'خواندن فایل ممکن نشد. دوباره امتحان کنید.' })
      }
    },
    [siteUrl],
  )

  const remove = useCallback(async () => {
    await deleteCrawl(siteUrl)
    setCrawl(null)
    // خطای فایل قبلی نباید روی صفحه‌ی خالی بماند
    setStatus({ kind: 'idle' })
  }, [siteUrl])

  return { crawl, status, importFile, remove }
}
