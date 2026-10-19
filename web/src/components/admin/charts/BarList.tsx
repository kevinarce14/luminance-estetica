import './charts.css'

export interface BarDatum {
  label: string
  value: number
  /** Texto secundario al lado del valor (ej. "$45.000"). */
  detail?: string
}

interface BarListProps {
  title: string
  data: BarDatum[]
  formatValue: (value: number) => string
  emptyMessage: string
}

/**
 * Ranking en barras horizontales de una sola serie, con el valor en la punta.
 * Barras finas (≤24px) con extremo redondeado, creciendo desde una misma base.
 */
export function BarList({ title, data, formatValue, emptyMessage }: BarListProps) {
  const maxValue = Math.max(0, ...data.map((datum) => datum.value))

  return (
    <figure className="lm-chart">
      <figcaption className="lm-chart__title">{title}</figcaption>
      {data.length === 0 || maxValue === 0 ? (
        <p className="lm-chart__empty">{emptyMessage}</p>
      ) : (
        <ol className="lm-barlist">
          {data.map((datum) => {
            const percent = (datum.value / maxValue) * 100
            return (
              <li key={datum.label} className="lm-barlist__row" title={`${datum.label}: ${formatValue(datum.value)}${datum.detail ? ` · ${datum.detail}` : ''}`}>
                <span className="lm-barlist__label">{datum.label}</span>
                <span className="lm-barlist__track" aria-hidden="true">
                  <span className="lm-barlist__bar" style={{ width: `${Math.max(percent, 1.5)}%` }} />
                </span>
                <span className="lm-barlist__value">
                  {formatValue(datum.value)}
                  {datum.detail ? <small>{datum.detail}</small> : null}
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </figure>
  )
}
