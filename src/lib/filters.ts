import type { ComparedRow } from './compare'

/**
 * موتور فیلتر جدول.
 *
 * چرا خودمان می‌سازیم و به فیلتر سرچ کنسول اکتفا نمی‌کنیم؟ فیلتر گوگل دو
 * محدودیت دارد که دقیقاً جلوی کار روزمره را می‌گیرد:
 *   ۱) بازه‌ی عددی ندارد — نمی‌شود گفت «موقعیت بین ۱ تا ۵».
 *   ۲) هم‌زمان روی چند معیار کار نمی‌کند — نمی‌شود کوئری و موقعیت و نمایش را
 *      با هم فیلتر کرد.
 * اینجا هر تعداد شرط با AND ترکیب می‌شوند و شرط عددی بازه هم دارد.
 */

export type TextField = 'page' | 'query'
export type NumberField =
  | 'clicks'
  | 'impressions'
  | 'ctr'
  | 'position'
  | 'deltaClicks'
  | 'deltaPosition'
export type FilterField = TextField | NumberField

export type TextOp = 'contains' | 'notContains' | 'equals'
export type NumberOp = 'between' | 'gte' | 'lte' | 'eq'

export interface TextFilter {
  id: string
  kind: 'text'
  field: TextField
  op: TextOp
  value: string
}

export interface NumberFilter {
  id: string
  kind: 'number'
  field: NumberField
  op: NumberOp
  /** برای between حد پایین، برای gte/lte/eq تنها مقدار */
  min: string
  /** فقط برای between */
  max: string
}

export type Filter = TextFilter | NumberFilter

interface FieldSpec {
  id: FilterField
  label: string
  kind: 'text' | 'number'
  /**
   * واحدی که کاربر وارد می‌کند با واحد داده یکی نیست.
   * CTR در داده نسبت اعشاری است (۰٫۰۳) ولی کاربر «۳» را به‌عنوان درصد می‌نویسد.
   */
  unit?: 'percent'
  /** فقط وقتی مقایسه‌ی دو دوره روشن است معنی دارد */
  compareOnly?: boolean
  /** راهنمای کوتاه زیر ورودی */
  hint?: string
}

export const FILTER_FIELDS: readonly FieldSpec[] = [
  { id: 'page', label: 'صفحه', kind: 'text' },
  { id: 'query', label: 'کوئری', kind: 'text' },
  { id: 'clicks', label: 'کلیک', kind: 'number' },
  { id: 'impressions', label: 'نمایش', kind: 'number' },
  { id: 'ctr', label: 'CTR', kind: 'number', unit: 'percent', hint: 'بر حسب درصد؛ مثلاً ۳' },
  { id: 'position', label: 'موقعیت', kind: 'number', hint: 'عدد کوچک‌تر یعنی رتبه‌ی بهتر' },
  { id: 'deltaClicks', label: 'تغییر کلیک', kind: 'number', compareOnly: true },
  {
    id: 'deltaPosition',
    label: 'تغییر موقعیت',
    kind: 'number',
    compareOnly: true,
    hint: 'مثبت یعنی رتبه بهتر شده',
  },
]

export const TEXT_OPS: readonly { id: TextOp; label: string }[] = [
  { id: 'contains', label: 'شامل' },
  { id: 'notContains', label: 'شامل نباشد' },
  { id: 'equals', label: 'دقیقاً برابر' },
]

export const NUMBER_OPS: readonly { id: NumberOp; label: string }[] = [
  { id: 'between', label: 'بین' },
  { id: 'gte', label: 'بیشتر یا مساوی' },
  { id: 'lte', label: 'کمتر یا مساوی' },
  { id: 'eq', label: 'برابر' },
]

export function fieldSpec(field: FilterField): FieldSpec {
  return FILTER_FIELDS.find((f) => f.id === field) ?? FILTER_FIELDS[0]
}

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹'
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

/**
 * تبدیل ورودی کاربر به عدد.
 *
 * کاربر فارسی‌زبان ممکن است «۱۲٫۵» بنویسد؛ `Number()` روی ارقام فارسی NaN می‌دهد.
 * جداکننده‌ی هزارگان (، یا ٬) و ممیز فارسی (٫) هم باید نرمال شوند.
 */
export function parseNumberFa(input: string): number | null {
  const normalized = input
    .trim()
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
    .replace(/٫/g, '.')
    .replace(/[,٬\s]/g, '')
    .replace(/٪|%/g, '')
  if (normalized === '') return null
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

/** سطری که فیلتر روی آن اجرا می‌شود؛ فیلدهای مقایسه ممکن است نباشند */
export type FilterableRow = ComparedRow

/**
 * شرط ناقص (ورودی خالی یا نامعتبر) نادیده گرفته می‌شود، نه اینکه همه چیز را حذف کند.
 * وگرنه لحظه‌ای که کاربر شرط تازه‌ای اضافه می‌کند جدول خالی می‌شود.
 */
export function isComplete(filter: Filter): boolean {
  if (filter.kind === 'text') return filter.value.trim() !== ''
  const min = parseNumberFa(filter.min)
  if (filter.op === 'between') return min !== null && parseNumberFa(filter.max) !== null
  return min !== null
}

function rowNumber(row: FilterableRow, field: NumberField): number | undefined {
  const raw = row[field]
  return typeof raw === 'number' ? raw : undefined
}

function matches(row: FilterableRow, filter: Filter): boolean {
  if (filter.kind === 'text') {
    const haystack = (filter.field === 'query' ? (row.query ?? '') : row.page).toLowerCase()
    const needle = filter.value.trim().toLowerCase()
    switch (filter.op) {
      case 'contains':
        return haystack.includes(needle)
      case 'notContains':
        return !haystack.includes(needle)
      case 'equals':
        return haystack === needle
    }
  }

  const value = rowNumber(row, filter.field)
  // سطری که این فیلد را ندارد (مثلاً تغییر کلیک بدون مقایسه) از فیلتر رد نمی‌شود
  if (value === undefined) return false

  const spec = fieldSpec(filter.field)
  const scaled = spec.unit === 'percent' ? value * 100 : value

  const min = parseNumberFa(filter.min)
  if (min === null) return true

  switch (filter.op) {
    case 'gte':
      return scaled >= min
    case 'lte':
      return scaled <= min
    case 'eq':
      return scaled === min
    case 'between': {
      const max = parseNumberFa(filter.max)
      if (max === null) return true
      // اگر کاربر بازه را برعکس وارد کرد، خودمان مرتبش می‌کنیم
      const low = Math.min(min, max)
      const high = Math.max(min, max)
      return scaled >= low && scaled <= high
    }
  }
}

/** همه‌ی شرط‌ها با AND ترکیب می‌شوند */
export function applyFilters<T extends FilterableRow>(
  rows: readonly T[],
  filters: readonly Filter[],
): T[] {
  const active = filters.filter(isComplete)
  if (active.length === 0) return rows as T[]
  return rows.filter((row) => active.every((f) => matches(row, f)))
}

const numFa = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 })

/** توضیح کوتاه فارسی برای نمایش روی چیپ فیلتر */
export function describeFilter(filter: Filter): string {
  const spec = fieldSpec(filter.field)
  const suffix = spec.unit === 'percent' ? '٪' : ''

  if (filter.kind === 'text') {
    const op = TEXT_OPS.find((o) => o.id === filter.op)?.label ?? ''
    return `${spec.label} ${op} «${filter.value.trim()}»`
  }

  const min = parseNumberFa(filter.min)
  const shown = min === null ? filter.min : numFa.format(min) + suffix

  switch (filter.op) {
    case 'gte':
      return `${spec.label} ≥ ${shown}`
    case 'lte':
      return `${spec.label} ≤ ${shown}`
    case 'eq':
      return `${spec.label} = ${shown}`
    case 'between': {
      const max = parseNumberFa(filter.max)
      const shownMax = max === null ? filter.max : numFa.format(max) + suffix
      return `${spec.label} بین ${shown} و ${shownMax}`
    }
  }
}

let seq = 0
export function newFilter(field: FilterField = 'position'): Filter {
  seq += 1
  const id = `f${seq}`
  const spec = fieldSpec(field)
  return spec.kind === 'text'
    ? { id, kind: 'text', field: field as TextField, op: 'contains', value: '' }
    : { id, kind: 'number', field: field as NumberField, op: 'between', min: '', max: '' }
}
