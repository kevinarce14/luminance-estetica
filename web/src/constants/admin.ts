import type { AgendaFilters } from '../types/admin.ts'

/** Filtros iniciales de la agenda del panel admin: turnos de hoy en adelante. */
export const DEFAULT_AGENDA_FILTERS: AgendaFilters = {
  scope: 'upcoming',
  date: '',
  status: 'all',
  search: '',
}
