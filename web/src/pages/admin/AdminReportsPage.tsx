import { useState } from 'react'
import { BarList } from '../../components/admin/charts/BarList.tsx'
import { ColumnChart, type ColumnDatum } from '../../components/admin/charts/ColumnChart.tsx'
import { MessageBox, Spinner } from '../../components/common/Feedback.tsx'
import { useAsyncResource } from '../../hooks/useAsyncResource.ts'
import { getYearlyReport } from '../../services/adminApi.ts'
import { AppointmentStatus } from '../../types/appointment.ts'
import { formatPrice } from '../../utils/formatters.ts'
import { APPOINTMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '../../utils/payments.ts'
import { getStudioToday } from '../../utils/studioTime.ts'

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const YEARS_BACK = 4

/** $0 / $950 / $12K / $1.2M para ejes y etiquetas. */
function formatCompactPrice(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M`
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}K`
  }
  return `$${Math.round(value)}`
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString('es-AR')
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

export function AdminReportsPage() {
  const currentYear = Number(getStudioToday().slice(0, 4))
  const [year, setYear] = useState(currentYear)
  const report = useAsyncResource(`yearly-report-${year}`, () => getYearlyReport(year), {
    keepPreviousData: true,
  })
  const years = Array.from({ length: YEARS_BACK + 1 }, (_, index) => currentYear - index)

  const renderReport = () => {
    if (report.status === 'error') {
      return (
        <MessageBox variant="error">
          Error al generar el reporte.{' '}
          <button type="button" className="admin-link-button" onClick={report.retry}>
            Reintentar
          </button>
        </MessageBox>
      )
    }
    if (!report.data) {
      return <Spinner label="Generando reporte..." size="large" />
    }

    const data = report.data
    const revenueByMonth: ColumnDatum[] = data.months.map((month) => ({
      label: MONTHS[month.month - 1].slice(0, 3),
      fullLabel: `${MONTHS[month.month - 1]} ${data.year}`,
      value: month.revenue,
      detail: plural(month.payments_count, 'pago aprobado', 'pagos aprobados'),
    }))
    const appointmentsByMonth: ColumnDatum[] = data.months.map((month) => ({
      label: MONTHS[month.month - 1].slice(0, 3),
      fullLabel: `${MONTHS[month.month - 1]} ${data.year}`,
      value: month.appointments_count,
      detail: `${month.completed_count} completados · ${month.cancelled_count} cancelados`,
    }))
    const completed = data.appointments_by_status[AppointmentStatus.COMPLETED] ?? 0

    return (
      <>
        <div className="admin-report-hero">
          <span className="admin-report-hero__label">Ingresos {data.year}</span>
          <span className="admin-report-hero__value">{formatPrice(data.total_revenue)}</span>
        </div>

        <div className="admin-stats">
          {[
            { label: 'Pagos aprobados', value: formatCount(data.total_payments) },
            { label: 'Ticket promedio', value: formatPrice(data.average_ticket) },
            { label: 'Turnos del año', value: formatCount(data.total_appointments), hint: `${completed} completados` },
            { label: 'Clientes nuevos', value: formatCount(data.new_clients) },
          ].map((tile) => (
            <div key={tile.label} className="admin-stat admin-stat--blue">
              <div>
                <div className="admin-stat__value">{tile.value}</div>
                <div className="admin-stat__label">{tile.label}</div>
                {tile.hint ? <div className="admin-stat__hint">{tile.hint}</div> : null}
              </div>
            </div>
          ))}
        </div>

        <div className="admin-report-grid">
          <ColumnChart
            title="Ingresos por mes"
            data={revenueByMonth}
            formatValue={formatPrice}
            formatTick={formatCompactPrice}
          />
          <ColumnChart
            title="Turnos por mes"
            data={appointmentsByMonth}
            formatValue={(value) => plural(value, 'turno', 'turnos')}
            formatTick={formatCount}
          />
        </div>

        <div className="admin-report-grid">
          <BarList
            title="Servicios más demandados"
            data={data.top_services.map((service) => ({
              label: service.name,
              value: service.appointments_count,
              detail: formatPrice(service.revenue),
            }))}
            formatValue={(value) => plural(value, 'turno', 'turnos')}
            emptyMessage="Sin turnos en el año."
          />
          <BarList
            title="Ingresos por medio de pago"
            data={[...data.payment_methods]
              .sort((a, b) => b.amount - a.amount)
              .map((method) => ({
                label: PAYMENT_METHOD_LABELS[method.method],
                value: method.amount,
                detail: plural(method.count, 'pago', 'pagos'),
              }))}
            formatValue={formatPrice}
            emptyMessage="Sin pagos aprobados en el año."
          />
        </div>

        <details className="admin-report-table">
          <summary>Ver tabla por mes</summary>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Mes</th>
                  <th scope="col">Ingresos</th>
                  <th scope="col">Pagos</th>
                  <th scope="col">Turnos</th>
                  <th scope="col">{APPOINTMENT_STATUS_LABELS[AppointmentStatus.COMPLETED]}</th>
                  <th scope="col">{APPOINTMENT_STATUS_LABELS[AppointmentStatus.CANCELLED]}</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((month) => (
                  <tr key={month.month}>
                    <td data-label="Mes">{MONTHS[month.month - 1]}</td>
                    <td data-label="Ingresos">{formatPrice(month.revenue)}</td>
                    <td data-label="Pagos">{month.payments_count}</td>
                    <td data-label="Turnos">{month.appointments_count}</td>
                    <td data-label="Completados">{month.completed_count}</td>
                    <td data-label="Cancelados">{month.cancelled_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </>
    )
  }

  return (
    <section className="admin-section" aria-labelledby="admin-reports-title">
      <div className="admin-section__header">
        <h2 id="admin-reports-title" className="admin-section__title">
          <i className="fas fa-file-alt" aria-hidden="true" /> Reportes
        </h2>
        <div className="admin-filters__field admin-report-year">
          <label htmlFor="report-year">Año</label>
          <select id="report-year" value={year} onChange={(event) => setYear(Number(event.target.value))}>
            {years.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="admin-section__hint">
        Ingresos según la fecha de aprobación del pago; turnos según su fecha. Meses en hora de
        Argentina.
      </p>
      {renderReport()}
    </section>
  )
}
