import type { Filter, FilterField, NumberOp, TextOp } from '../lib/filters'
import { formatNumber } from '../lib/metrics'
import {
  FILTER_FIELDS,
  NUMBER_OPS,
  TEXT_OPS,
  describeFilter,
  fieldSpec,
  isComplete,
  newFilter,
} from '../lib/filters'

interface Props {
  filters: readonly Filter[]
  onChange: (filters: Filter[]) => void
  /** ستون کوئری فقط در نمای کوئری‌محور هست */
  variant: 'page' | 'query'
  /** فیلدهای تغییر فقط وقتی مقایسه روشن است معنی دارند */
  comparing: boolean
  open: boolean
  onToggle: () => void
}

export function FilterPanel({
  filters,
  onChange,
  variant,
  comparing,
  open,
  onToggle,
}: Props) {
  const available = FILTER_FIELDS.filter(
    (f) =>
      (f.id !== 'query' || variant === 'query') && (!f.compareOnly || comparing),
  )

  const activeCount = filters.filter(isComplete).length

  // پیش‌فرضِ شرط تازه «موقعیت» است، نه اولین فیلد فهرست: بازه‌ی عددی روی موقعیت
  // پرکاربردترین فیلتری است که سرچ کنسول ندارد، و شروع با یک شرط متنی کاربر را
  // یک قدم عقب می‌اندازد.
  const defaultField: FilterField =
    available.find((f) => f.id === 'position')?.id ?? available[0]?.id ?? 'position'

  const update = (id: string, patch: Partial<Filter>) =>
    onChange(filters.map((f) => (f.id === id ? ({ ...f, ...patch } as Filter) : f)))

  const remove = (id: string) => onChange(filters.filter((f) => f.id !== id))

  /**
   * تغییر فیلد فقط وقتی شرط را از نو می‌سازد که نوعش عوض شود (متنی ↔ عددی).
   * عوض کردن «موقعیت» به «نمایش» نباید عملگر و عددهای واردشده را پاک کند.
   */
  const changeField = (id: string, field: FilterField) => {
    const target = fieldSpec(field)
    onChange(
      filters.map((f) => {
        if (f.id !== id) return f
        const sameKind = (f.kind === 'text') === (target.kind === 'text')
        return sameKind
          ? ({ ...f, field } as Filter)
          : ({ ...newFilter(field), id } as Filter)
      }),
    )
  }

  return (
    <div className="filters">
      <div className="filters-bar">
        <button
          className={`btn btn-sm ${activeCount > 0 ? 'btn-primary' : 'btn-secondary'}`}
          onClick={onToggle}
          aria-expanded={open}
        >
          فیلترها
          {activeCount > 0 && (
            <span className="filter-count">{formatNumber(activeCount)}</span>
          )}
        </button>

        {!open &&
          filters.filter(isComplete).map((f) => (
            <span key={f.id} className="filter-chip">
              {describeFilter(f)}
              <button
                className="filter-chip-x"
                onClick={() => remove(f.id)}
                aria-label={`حذف فیلتر ${describeFilter(f)}`}
              >
                ×
              </button>
            </span>
          ))}

        {activeCount > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => onChange([])}>
            پاک کردن همه
          </button>
        )}
      </div>

      {open && (
        <div className="filters-panel">
          {filters.length === 0 && (
            <p className="faint" style={{ margin: '0 0 10px' }}>
              هنوز شرطی اضافه نشده. می‌توانید چند شرط را با هم ترکیب کنید — همه با «و»
              اعمال می‌شوند.
            </p>
          )}

          {filters.map((filter) => {
            const spec = fieldSpec(filter.field)
            return (
              <div key={filter.id} className="filter-row">
                <select
                  className="select"
                  value={filter.field}
                  onChange={(e) => changeField(filter.id, e.target.value as FilterField)}
                  aria-label="معیار"
                >
                  {available.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>

                {filter.kind === 'text' ? (
                  <>
                    <select
                      className="select"
                      value={filter.op}
                      onChange={(e) =>
                        update(filter.id, { op: e.target.value as TextOp })
                      }
                      aria-label="شرط"
                    >
                      {TEXT_OPS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className="search-input filter-input"
                      value={filter.value}
                      onChange={(e) => update(filter.id, { value: e.target.value })}
                      placeholder="متن…"
                      aria-label="مقدار"
                    />
                  </>
                ) : (
                  <>
                    <select
                      className="select"
                      value={filter.op}
                      onChange={(e) =>
                        update(filter.id, { op: e.target.value as NumberOp })
                      }
                      aria-label="شرط"
                    >
                      {NUMBER_OPS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className="search-input filter-input filter-input-num"
                      value={filter.min}
                      onChange={(e) => update(filter.id, { min: e.target.value })}
                      placeholder={filter.op === 'between' ? 'از' : 'مقدار'}
                      inputMode="decimal"
                      aria-label={filter.op === 'between' ? 'از' : 'مقدار'}
                    />
                    {filter.op === 'between' && (
                      <>
                        <span className="faint">تا</span>
                        <input
                          className="search-input filter-input filter-input-num"
                          value={filter.max}
                          onChange={(e) => update(filter.id, { max: e.target.value })}
                          placeholder="تا"
                          inputMode="decimal"
                          aria-label="تا"
                        />
                      </>
                    )}
                    {spec.hint && <span className="faint filter-hint">{spec.hint}</span>}
                  </>
                )}

                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => remove(filter.id)}
                  aria-label="حذف این شرط"
                >
                  حذف
                </button>
              </div>
            )
          })}

          <div className="filters-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onChange([...filters, newFilter(defaultField)])}
            >
              + افزودن شرط
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onToggle}>
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
