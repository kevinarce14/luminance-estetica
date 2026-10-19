import { AppointmentStatus } from '../../types/appointment.ts'
import type { AgendaFilters, AgendaStatusFilter } from '../../types/admin.ts'
import { APPOINTMENT_STATUS_LABELS } from '../../utils/payments.ts'
import { getStudioToday } from '../../utils/studioTime.ts'

const STATUS_OPTIONS: { value: AgendaStatusFilter; label: string }[] = [
  { value: 'all', label: 'Todos los estados' },
  ...Object.values(AppointmentStatus).map((status) => ({
    value: status,
    label: APPOINTMENT_STATUS_LABELS[status],
  })),
]

function isStatusFilter(value: string): value is AgendaStatusFilter {
  return STATUS_OPTIONS.some((option) => option.value === value)
}

interface AgendaFiltersBarProps {
  filters: AgendaFilters
  resultCount: number
  onChange: (filters: AgendaFilters) => void
}

export function AgendaFiltersBar({ filters, resultCount, onChange }: AgendaFiltersBarProps) {
  const update = (patch: Partial<AgendaFilters>) => onChange({ ...filters, ...patch })
  const today = getStudioToday()

  return (
    <div className="admin-filters">
      <div className="admin-filters__field admin-filters__field--search">
        <label htmlFor="agenda-search">Buscar cliente</label>
        <div className="admin-filters__search">
          <i className="fas fa-search" aria-hidden="true" />
          <input
            id="agenda-search"
            type="search"
            value={filters.search}
            placeholder="Nombre, email, teléfono, servicio o #ID"
            onChange={(event) => update({ search: event.target.value })}
          />
        </div>
      </div>

      <div className="admin-filters__field">
        <label htmlFor="agenda-date">Fecha</label>
        <input
          id="agenda-date"
          type="date"
          value={filters.date}
          onChange={(event) => update({ date: event.target.value })}
        />
      </div>

      <div className="admin-filters__field">
        <label htmlFor="agenda-status">Estado</label>
        <select
          id="agenda-status"
          value={filters.status}
          onChange={(event) => {
            const { value } = event.target
            if (isStatusFilter(value)) {
              update({ status: value })
            }
          }}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="admin-filters__quick">
        <button
          type="button"
          className={filters.date === today ? 'admin-chip admin-chip--active' : 'admin-chip'}
          onClick={() => update({ date: filters.date === today ? '' : today })}
        >
          Hoy
        </button>
        <button
          type="button"
          className="admin-chip"
          onClick={() => onChange({ date: '', status: 'all', search: '' })}
        >
          Limpiar filtros
        </button>
        <span className="admin-filters__count" aria-live="polite">
          {resultCount} {resultCount === 1 ? 'turno' : 'turnos'}
        </span>
      </div>
    </div>
  )
}
