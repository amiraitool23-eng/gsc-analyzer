import type { GscSite } from '../types'
import { displaySiteName, isDomainProperty } from '../lib/gscApi'

interface Props {
  sites: GscSite[]
  selected: string | null
  onSelect: (siteUrl: string) => void
}

/**
 * فهرست پراپرتی‌های کاربر.
 * پراپرتی‌های Domain به شکل `sc-domain:example.com` برمی‌گردند؛ برای نمایش
 * پیشوند را حذف می‌کنیم ولی مقدار اصلی (که در URL باید encode شود) دست‌نخورده می‌ماند.
 */
export function PropertyPicker({ sites, selected, onSelect }: Props) {
  if (sites.length === 0) {
    return (
      <div className="card">
        <h2 className="card-title">پراپرتی‌ای پیدا نشد</h2>
        <p className="card-desc">
          این حساب گوگل روی هیچ پراپرتی تأییدشده‌ای در سرچ کنسول دسترسی ندارد. با حساب دیگری وارد
          شوید یا در Search Console دسترسی بگیرید.
        </p>
      </div>
    )
  }

  return (
    <div className="card">
      <h2 className="card-title">پراپرتی را انتخاب کنید</h2>
      <p className="card-desc">{sites.length} پراپرتی روی این حساب گوگل پیدا شد.</p>
      <div className="property-list">
        {sites.map((site) => (
          <button
            key={site.siteUrl}
            className="property-item"
            aria-current={site.siteUrl === selected}
            onClick={() => onSelect(site.siteUrl)}
          >
            <span className="property-url">{displaySiteName(site.siteUrl)}</span>
            {isDomainProperty(site.siteUrl) && <span className="badge badge-domain">Domain</span>}
            <span className="badge">{site.permissionLevel}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
