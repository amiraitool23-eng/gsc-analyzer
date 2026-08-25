import { useId, useMemo, useState } from 'react'
import type { DailyRow } from '../types'
import type { TrendMetric } from '../lib/trend'
import { formatDateShortFa } from '../lib/dates'
import { formatNumber } from '../lib/metrics'

/**
 * چرا کلیک و نمایش در دو نمودار جدا رسم می‌شوند و نه یکی با دو محور؟
 *
 * نمودار دومحوره (مثل خود سرچ کنسول) هم‌ترازی دو مقیاس را خودسرانه انتخاب می‌کند
 * و همبستگی‌ای می‌سازد که در داده نیست — نگاه‌کننده فکر می‌کند نمایش و کلیک با هم
 * بالا و پایین می‌روند چون خط‌ها روی هم افتاده‌اند. دو نمودار کوچکِ کنار هم، با
 * محور مشترکِ زمان، همان مقایسه را بدون این تحریف می‌دهد.
 */

const VIEW_W = 800
const VIEW_H = 200
const PAD = { top: 14, right: 14, bottom: 26, left: 46 }
const PLOT_W = VIEW_W - PAD.left - PAD.right
const PLOT_H = VIEW_H - PAD.top - PAD.bottom

interface Props {
  title: string
  metric: TrendMetric
  rows: readonly DailyRow[]
  /** دوره‌ی قبل؛ به‌عنوان زمینه رسم می‌شود، نه سری هم‌وزن */
  previous?: readonly DailyRow[]
  /** روزی که افت از آن شروع شده؛ روی نمودار علامت می‌خورد */
  markerDate?: string
}

/** تیک‌های محور عمودی روی اعداد گرد */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1]
  const rough = max / count
  const mag = 10 ** Math.floor(Math.log10(rough))
  // کلیک و نمایش عدد صحیح‌اند؛ گام کسری باعث می‌شود چند تیک با گرد شدن هم‌مقدار
  // چاپ شوند (۰، ۰، ۱، ۱) — پس حداقل گام ۱ است.
  const step = Math.max(
    1,
    [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) ?? mag * 10,
  )
  const ticks: number[] = []
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v)
  // سقف محور هرگز نباید زیر بیشترین مقدار بماند
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step)
  return ticks
}

export function TrendChart({ title, metric, rows, previous, markerDate }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const clipId = useId()

  const { current, prev, yMax, ticks } = useMemo(() => {
    const current = rows.map((r) => r[metric])
    const prev = previous?.map((r) => r[metric]) ?? []
    const max = Math.max(1, ...current, ...prev)
    const ticks = niceTicks(max)
    return { current, prev, yMax: ticks[ticks.length - 1], ticks }
  }, [rows, previous, metric])

  if (rows.length === 0) return null

  const x = (i: number) =>
    PAD.left + (rows.length === 1 ? PLOT_W / 2 : (i / (rows.length - 1)) * PLOT_W)
  const y = (v: number) => PAD.top + PLOT_H - (v / yMax) * PLOT_H

  const path = (values: readonly number[]) =>
    values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

  const areaPath =
    `${path(current)} L${x(current.length - 1).toFixed(1)},${(PAD.top + PLOT_H).toFixed(1)}` +
    ` L${x(0).toFixed(1)},${(PAD.top + PLOT_H).toFixed(1)} Z`

  const markerIndex = markerDate ? rows.findIndex((r) => r.date === markerDate) : -1
  const markerAnchor =
    markerIndex / Math.max(1, rows.length - 1) < 0.12
      ? 'start'
      : markerIndex / Math.max(1, rows.length - 1) > 0.88
        ? 'end'
        : 'middle'

  // برچسب‌های محور زمان: اول، وسط، آخر — بیشتر از این روی هم می‌افتد
  const xLabelIdx = rows.length <= 2 ? [0] : [0, Math.floor((rows.length - 1) / 2), rows.length - 1]

  const hoverRow = hover !== null ? rows[hover] : null
  const hoverPrev = hover !== null && previous ? previous[hover] : undefined

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const rel = ((e.clientX - box.left) / box.width) * VIEW_W
    const ratio = (rel - PAD.left) / PLOT_W
    const i = Math.round(ratio * (rows.length - 1))
    setHover(i >= 0 && i < rows.length ? i : null)
  }

  return (
    <figure className="chart">
      <figcaption className="chart-title">
        {title}
        {previous && (
          <span className="chart-legend">
            <span className="legend-key">
              <span className="legend-line legend-line-current" /> این دوره
            </span>
            <span className="legend-key">
              <span className="legend-line legend-line-prev" /> دوره‌ی قبل
            </span>
          </span>
        )}
      </figcaption>

      <div className="chart-plot">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="chart-svg"
          role="img"
          aria-label={`${title} — نمودار روند روزانه`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <clipPath id={clipId}>
              <rect x={PAD.left} y={PAD.top} width={PLOT_W} height={PLOT_H} />
            </clipPath>
          </defs>

          {/* خطوط راهنما: نازک، یکنواخت، عقب‌نشسته */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={PAD.left + PLOT_W}
                y1={y(t)}
                y2={y(t)}
                className="chart-grid"
              />
              <text x={PAD.left - 8} y={y(t) + 4} className="chart-tick" textAnchor="end">
                {formatNumber(t)}
              </text>
            </g>
          ))}

          {/* دوره‌ی قبل: زمینه است، نه سری هم‌وزن */}
          {previous && prev.length > 1 && (
            <path d={path(prev)} className="chart-line-prev" clipPath={`url(#${clipId})`} />
          )}

          {!previous && <path d={areaPath} className="chart-area" clipPath={`url(#${clipId})`} />}
          <path d={path(current)} className="chart-line" clipPath={`url(#${clipId})`} />

          {/* روزی که افت از آن شروع شده */}
          {markerIndex >= 0 && (
            <g>
              <line
                x1={x(markerIndex)}
                x2={x(markerIndex)}
                y1={PAD.top}
                y2={PAD.top + PLOT_H}
                className="chart-marker"
              />
              <text
                x={x(markerIndex)}
                y={PAD.top - 3}
                className="chart-marker-label"
                textAnchor={markerAnchor}
              >
                شروع افت
              </text>
            </g>
          )}

          {/* خط‌کش شناور */}
          {hover !== null && (
            <g>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={PAD.top}
                y2={PAD.top + PLOT_H}
                className="chart-crosshair"
              />
              <circle cx={x(hover)} cy={y(current[hover])} r={4.5} className="chart-dot" />
            </g>
          )}

          {xLabelIdx.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={VIEW_H - 8}
              className="chart-tick"
              textAnchor={i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'}
            >
              {formatDateShortFa(rows[i].date)}
            </text>
          ))}
        </svg>

        {hoverRow && (
          <div
            className="chart-tooltip"
            style={{ left: `${(x(hover!) / VIEW_W) * 100}%` }}
          >
            <div className="chart-tooltip-date">{formatDateShortFa(hoverRow.date)}</div>
            <div className="chart-tooltip-row">
              <span className="legend-line legend-line-current" />
              {formatNumber(hoverRow[metric])}
            </div>
            {hoverPrev && (
              <div className="chart-tooltip-row muted">
                <span className="legend-line legend-line-prev" />
                {formatNumber(hoverPrev[metric])}
              </div>
            )}
          </div>
        )}
      </div>
    </figure>
  )
}
