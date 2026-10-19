import { useState } from 'react'
import './charts.css'

export interface ColumnDatum {
  /** Etiqueta corta del eje X (ej. "Ene"). */
  label: string
  /** Etiqueta completa para tooltip/lectores (ej. "Enero 2026"). */
  fullLabel: string
  value: number
  /** Línea secundaria del tooltip (ej. "4 pagos"). */
  detail?: string
}

interface ColumnChartProps {
  title: string
  data: ColumnDatum[]
  formatValue: (value: number) => string
  formatTick: (value: number) => string
}

// Geometría (unidades del viewBox).
const WIDTH = 640
const HEIGHT = 240
const PADDING = { top: 24, right: 8, bottom: 28, left: 52 }
const MAX_BAR_WIDTH = 24
const RADIUS = 4
const TICK_COUNT = 4

/** Máximo "redondo" para el eje (1, 2, 2.5, 5 × 10^n). */
function niceMax(value: number): number {
  if (value <= 0) {
    return 1
  }
  const exponent = 10 ** Math.floor(Math.log10(value))
  const fraction = value / exponent
  const nice = [1, 2, 2.5, 5, 10].find((step) => fraction <= step) ?? 10
  return nice * exponent
}

/** Columna con extremo de datos redondeado (4px) y base recta sobre el eje. */
function columnPath(x: number, y: number, width: number, height: number): string {
  const r = Math.min(RADIUS, width / 2, height)
  const bottom = y + height
  return [
    `M${x},${bottom}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + width - r}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `V${bottom}`,
    'Z',
  ].join(' ')
}

/**
 * Gráfico de columnas de una sola serie (sin leyenda: el título nombra la serie).
 * Etiqueta solo el valor máximo; el resto se lee en el tooltip o en la tabla.
 */
export function ColumnChart({ title, data, formatValue, formatTick }: ColumnChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const maxValue = Math.max(0, ...data.map((datum) => datum.value))
  const axisMax = niceMax(maxValue)
  const band = plotWidth / Math.max(data.length, 1)
  const barWidth = Math.min(MAX_BAR_WIDTH, band * 0.6)
  const maxIndex = maxValue > 0 ? data.findIndex((datum) => datum.value === maxValue) : -1
  const yFor = (value: number) => PADDING.top + plotHeight - (value / axisMax) * plotHeight
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, index) => (axisMax / TICK_COUNT) * index)
  const active = activeIndex !== null ? data[activeIndex] : null

  return (
    <figure className="lm-chart">
      <figcaption className="lm-chart__title">{title}</figcaption>
      <div className="lm-chart__plot">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`${title}. Máximo: ${maxIndex >= 0 ? `${data[maxIndex].fullLabel}, ${formatValue(maxValue)}` : 'sin datos'}.`}
          onMouseLeave={() => setActiveIndex(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                className="lm-chart__grid"
                x1={PADDING.left}
                x2={WIDTH - PADDING.right}
                y1={yFor(tick)}
                y2={yFor(tick)}
              />
              <text className="lm-chart__tick" x={PADDING.left - 8} y={yFor(tick)} textAnchor="end" dominantBaseline="middle">
                {formatTick(tick)}
              </text>
            </g>
          ))}

          {data.map((datum, index) => {
            const centerX = PADDING.left + band * index + band / 2
            const barHeight = (datum.value / axisMax) * plotHeight
            const barY = PADDING.top + plotHeight - barHeight
            const isActive = activeIndex === index
            return (
              <g key={datum.label}>
                {barHeight > 0 ? (
                  <path
                    className={isActive ? 'lm-chart__bar lm-chart__bar--active' : 'lm-chart__bar'}
                    d={columnPath(centerX - barWidth / 2, barY, barWidth, barHeight)}
                  />
                ) : null}
                {index === maxIndex ? (
                  <text className="lm-chart__value" x={centerX} y={barY - 6} textAnchor="middle">
                    {formatTick(datum.value)}
                  </text>
                ) : null}
                <text className="lm-chart__tick" x={centerX} y={HEIGHT - 8} textAnchor="middle">
                  {datum.label}
                </text>
                {/* Zona de hover/foco más grande que la columna */}
                <rect
                  className="lm-chart__hit"
                  x={PADDING.left + band * index}
                  y={PADDING.top}
                  width={band}
                  height={plotHeight}
                  tabIndex={0}
                  aria-label={`${datum.fullLabel}: ${formatValue(datum.value)}${datum.detail ? `, ${datum.detail}` : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  onBlur={() => setActiveIndex(null)}
                />
              </g>
            )
          })}
        </svg>

        {active && activeIndex !== null ? (
          <div
            className="lm-chart__tooltip"
            role="status"
            style={{
              left: `${((PADDING.left + band * activeIndex + band / 2) / WIDTH) * 100}%`,
              top: `${(yFor(active.value) / HEIGHT) * 100}%`,
            }}
          >
            <strong>{active.fullLabel}</strong>
            <span>{formatValue(active.value)}</span>
            {active.detail ? <small>{active.detail}</small> : null}
          </div>
        ) : null}
      </div>
    </figure>
  )
}
