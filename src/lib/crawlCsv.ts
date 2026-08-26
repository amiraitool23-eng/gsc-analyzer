import { foldDigits } from './faDigits'
import { normalizeUrlKey } from './urlKey'

/**
 * خواندن خروجی CSV کراولر (Screaming Frog و هم‌خانواده‌هایش).
 *
 * فایل کاربر است، نه درخواست شبکه: با `FileReader` در همان مرورگر خوانده می‌شود
 * و هیچ‌جا فرستاده نمی‌شود. پس با قاعده‌ی «بدون بک‌اند» تضادی ندارد.
 *
 * دو تصمیم که فایل‌های واقعی تحمیل کردند:
 *
 * ۱) **جداکردن با `split(',')` غلط است.** عنوان فارسی معمولاً ویرگول دارد
 *    («خرید کفش، راهنمای کامل») و داخل گیومه می‌آید. پارسر واقعی لازم است.
 * ۲) **نام ستون‌ها بین نسخه‌ها فرق می‌کند.** پس هر ستون چند نام معادل دارد و
 *    اگر پیدا نشد، به‌جای خطا در گزارش می‌آید تا کاربر بفهمد چه چیزی کم است.
 */

/** پارسر CSV مطابق RFC 4180: گیومه، ویرگولِ داخل فیلد، گیومه‌ی دوتایی، CRLF */
export function parseCsvRows(text: string): string[][] {
  // BOM را اکسل و Screaming Frog هر دو می‌گذارند؛ اگر بماند نام ستون اول خراب می‌شود
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < src.length; i++) {
    const c = src[i]

    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        // شکست خط داخل گیومه بخشی از متن است (توضیحات متای چندخطی)
        field += c
      }
      continue
    }

    if (c === '"') inQuotes = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (c !== '\r') field += c
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** نام‌های معادل هر ستون، همه با حروف کوچک و بدون فاصله‌ی اضافه */
const COLUMN_ALIASES: Record<string, string[]> = {
  url: ['address', 'url'],
  status: ['status code', 'status'],
  indexability: ['indexability'],
  title: ['title 1', 'title', 'page title 1'],
  metaDescription: ['meta description 1', 'meta description'],
  h1: ['h1-1', 'h1 1', 'h1'],
  wordCount: ['word count', 'word count 1'],
  canonical: ['canonical link element 1', 'canonical link element', 'canonical'],
  contentType: ['content type', 'content'],
}

/** ستون‌هایی که بدونشان تحلیل بی‌معنی است */
const REQUIRED = ['url']

/**
 * نام ستون را به شکل قابل مقایسه درمی‌آورد.
 *
 * `foldDigits` اینجا حیاتی است: Screaming Frog روی ویندوز فارسی هدرها را
 * محلی‌سازی می‌کند و `Title ۱` می‌نویسد. بدون تبدیل رقم، ستون عنوان پیدا نمی‌شود
 * و فایل **بی‌سروصدا** با عنوان‌های خالی خوانده می‌شود.
 */
const header = (cell: string) => foldDigits(cell).trim().toLowerCase().replace(/\s+/g, ' ')

export interface CrawlPage {
  /** آدرس همان‌طور که در فایل بود — برای نمایش و لینک */
  url: string
  /** کلید تطبیق با سرچ کنسول */
  key: string
  title: string
  metaDescription: string
  h1: string
  /** `null` یعنی ستونش نبود یا عدد نبود */
  wordCount: number | null
  status: number | null
  indexability: string
  canonical: string
}

export interface CrawlImport {
  pages: CrawlPage[]
  byKey: Map<string, CrawlPage>
  /** ستون‌های منطقی که پیدا شدند → نام واقعی‌شان در فایل */
  columns: Record<string, string>
  /** ستون‌های لازمی که پیدا نشدند */
  missingColumns: string[]
  totalRows: number
  /** سطرهایی که آدرس نداشتند یا آدرسشان قابل تفسیر نبود */
  skippedRows: number
  /** سطرهایی که HTML نبودند (تصویر، CSS…) و کنار گذاشته شدند */
  nonHtmlRows: number
  /** آدرس‌های تکراری بعد از یکسان‌سازی؛ اولی نگه داشته می‌شود */
  duplicateKeys: number
}

/**
 * عدد یک سلول. مقادیر هم می‌توانند فارسی باشند: در همان فایل، `Word Count`
 * لاتین است ولی `Position` به شکل `۱۲٫۲۴۰` می‌آید (`٫` جداکننده‌ی اعشار فارسی).
 */
function toNumber(value: string | undefined): number | null {
  if (value === undefined) return null
  const cleaned = foldDigits(value)
    .replace(/٫/g, '.')
    .replace(/[,٬،\s]/g, '')
    .trim()
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/**
 * تبدیل متن CSV به فهرست صفحه‌ها.
 *
 * سطر عنوان لزوماً سطر اول نیست: بعضی خروجی‌های Screaming Frog یک سطر توضیح
 * بالای جدول دارند. پس دنبال سطری می‌گردیم که ستون آدرس در آن باشد.
 */
export function parseCrawlCsv(text: string): CrawlImport {
  const rows = parseCsvRows(text)

  let headerIndex = -1
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = rows[i].map(header)
    if (COLUMN_ALIASES.url.some((alias) => cells.includes(alias))) {
      headerIndex = i
      break
    }
  }

  if (headerIndex === -1) {
    return {
      pages: [], byKey: new Map(), columns: {}, missingColumns: [...REQUIRED],
      totalRows: 0, skippedRows: 0, nonHtmlRows: 0, duplicateKeys: 0,
    }
  }

  const headers = rows[headerIndex].map(header)
  const index: Record<string, number> = {}
  const columns: Record<string, string> = {}
  for (const [logical, aliases] of Object.entries(COLUMN_ALIASES)) {
    const at = headers.findIndex((h) => aliases.includes(h))
    if (at !== -1) {
      index[logical] = at
      columns[logical] = rows[headerIndex][at].trim()
    }
  }

  const cell = (row: string[], logical: string): string | undefined =>
    index[logical] === undefined ? undefined : (row[index[logical]] ?? '').trim()

  const pages: CrawlPage[] = []
  const byKey = new Map<string, CrawlPage>()
  let skippedRows = 0
  let nonHtmlRows = 0
  let duplicateKeys = 0
  let totalRows = 0

  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    // سطر خالیِ انتهای فایل
    if (row.length === 1 && row[0].trim() === '') continue
    totalRows++

    // اگر کاربر به‌جای «Internal → HTML» کل Internal را گرفته باشد، تصویر و
    // CSS هم داخلش است. آن‌ها صفحه نیستند و نباید نرخ تطبیق را خراب کنند.
    const contentType = cell(row, 'contentType')
    if (contentType !== undefined && contentType !== '' && !/html/i.test(contentType)) {
      nonHtmlRows++
      continue
    }

    const url = cell(row, 'url') ?? ''
    const key = normalizeUrlKey(url)
    if (key === null) {
      skippedRows++
      continue
    }

    const page: CrawlPage = {
      url,
      key,
      title: cell(row, 'title') ?? '',
      metaDescription: cell(row, 'metaDescription') ?? '',
      h1: cell(row, 'h1') ?? '',
      wordCount: toNumber(cell(row, 'wordCount')),
      status: toNumber(cell(row, 'status')),
      indexability: cell(row, 'indexability') ?? '',
      canonical: cell(row, 'canonical') ?? '',
    }

    if (byKey.has(key)) {
      duplicateKeys++
      continue
    }
    byKey.set(key, page)
    pages.push(page)
  }

  return {
    pages,
    byKey,
    columns,
    missingColumns: REQUIRED.filter((c) => index[c] === undefined),
    totalRows,
    skippedRows,
    nonHtmlRows,
    duplicateKeys,
  }
}
