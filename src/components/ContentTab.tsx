import { useMemo } from 'react'
import type { GscPageRow, GscRow } from '../types'
import { inPropertyScope } from '../lib/urlKey'
import { useCrawl } from '../hooks/useCrawl'
import { ContentGapsPanel } from './ContentGapsPanel'
import { CrawlPanel } from './CrawlPanel'

/**
 * تب «محتوای سایت»: ایمپورت کراول و تحلیل‌هایی که به آن نیاز دارند.
 *
 * وضعیت کراول اینجا نگه داشته می‌شود تا هر دو پنل یک منبع مشترک داشته باشند؛
 * وگرنه بعد از ایمپورت فقط پنل بالایی به‌روز می‌شد.
 */

interface Props {
  siteUrl: string
  pageRows: GscPageRow[] | undefined
  queryRows: GscRow[]
}

export function ContentTab({ siteUrl, pageRows, queryRows }: Props) {
  const { crawl, status, importFile, remove } = useCrawl(siteUrl)

  // صفحه‌های بیرون از این پراپرتی نباید وارد هیچ تحلیلی شوند
  const scopedPages = useMemo(
    () => (crawl ? crawl.pages.filter((page) => inPropertyScope(siteUrl, page.url)) : []),
    [crawl, siteUrl],
  )

  return (
    <>
      <CrawlPanel
        siteUrl={siteUrl}
        pageRows={pageRows}
        crawl={crawl}
        status={status}
        onImport={(file) => void importFile(file)}
        onRemove={() => void remove()}
      />
      {crawl && scopedPages.length > 0 && (
        <ContentGapsPanel
          siteUrl={siteUrl}
          queryRows={queryRows}
          crawlPages={scopedPages}
        />
      )}
    </>
  )
}
