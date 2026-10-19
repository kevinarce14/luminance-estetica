import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AgendaFiltersBar } from '../components/admin/AgendaFiltersBar.tsx'
import { AgendaTable, type AgendaAction } from '../components/admin/AgendaTable.tsx'
import { MetricsCards } from '../components/admin/MetricsCards.tsx'
import { CancelAppointmentModal } from '../components/appointments/CancelAppointmentModal.tsx'
import { ConfirmModal } from '../components/common/ConfirmModal.tsx'
import { MessageBox, Spinner, type MessageVariant } from '../components/common/Feedback.tsx'
import { DEFAULT_AGENDA_FILTERS } from '../constants/admin.ts'
import { useAuth } from '../hooks/useAuth.ts'
import { useAsyncResource } from '../hooks/useAsyncResource.ts'
import { useDebouncedValue } from '../hooks/useDebouncedValue.ts'
import {
  AGENDA_LIMIT,
  buildAgendaQuery,
  getAdminAppointments,
  getDashboardMetrics,
} from '../services/adminApi.ts'
import { cancelAppointment, updateAppointmentStatus } from '../services/appointmentsApi.ts'
import { createCashPayment } from '../services/paymentsApi.ts'
import type { AgendaFilters } from '../types/admin.ts'
import { isApiError } from '../types/api.ts'
import { AppointmentStatus, type AdminAppointment } from '../types/appointment.ts'
import { formatStudioLongDate, formatStudioTime, getStudioToday } from '../utils/studioTime.ts'
import './AdminDashboardPage.css'

const SEARCH_DEBOUNCE_MS = 300

interface Feedback {
  variant: MessageVariant
  message: string
}

/** Acción que requiere confirmación en modal (la cancelación usa su propio modal con motivo). */
interface PendingConfirmation {
  action: Extract<AgendaAction, 'confirm-cash' | 'complete'>
  appointment: AdminAppointment
}

function describe(appointment: AdminAppointment): string {
  return `#${appointment.id} · ${appointment.user.full_name} · ${appointment.service.name} — ${formatStudioLongDate(appointment.appointment_date)}, ${formatStudioTime(appointment.appointment_date)}`
}

export function AdminDashboardPage() {
  const { user } = useAuth()
  const [filters, setFilters] = useState<AgendaFilters>(DEFAULT_AGENDA_FILTERS)
  const debouncedSearch = useDebouncedValue(filters.search, SEARCH_DEBOUNCE_MS)
  const agendaQuery = buildAgendaQuery({ ...filters, search: debouncedSearch })

  const metrics = useAsyncResource('admin-metrics', getDashboardMetrics)
  const agenda = useAsyncResource(
    JSON.stringify(agendaQuery),
    () => getAdminAppointments(agendaQuery),
    { keepPreviousData: true },
  )

  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null)
  const [cancelTarget, setCancelTarget] = useState<AdminAppointment | null>(null)
  const [busyAppointmentId, setBusyAppointmentId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const runAction = async (
    appointment: AdminAppointment,
    request: () => Promise<unknown>,
    successMessage: string,
  ) => {
    setBusyAppointmentId(appointment.id)
    setFeedback(null)
    try {
      await request()
      setFeedback({ variant: 'success', message: successMessage })
      agenda.retry()
      metrics.retry()
    } catch (error) {
      setFeedback({
        variant: 'error',
        message: isApiError(error) ? error.message : 'No se pudo completar la acción.',
      })
    } finally {
      setBusyAppointmentId(null)
    }
  }

  const handleAction = (action: AgendaAction, appointment: AdminAppointment) => {
    if (action === 'cancel') {
      setCancelTarget(appointment)
    } else {
      setPendingConfirmation({ action, appointment })
    }
  }

  const handleConfirmPending = () => {
    if (!pendingConfirmation) {
      return
    }
    const { action, appointment } = pendingConfirmation
    setPendingConfirmation(null)

    if (action === 'confirm-cash') {
      void runAction(
        appointment,
        () => createCashPayment(appointment.id),
        `✅ Turno #${appointment.id} confirmado con pago en efectivo.`,
      )
    } else {
      void runAction(
        appointment,
        () => updateAppointmentStatus(appointment.id, AppointmentStatus.COMPLETED),
        `✅ Turno #${appointment.id} marcado como completado.`,
      )
    }
  }

  const handleConfirmCancel = (reason: string) => {
    if (!cancelTarget) {
      return
    }
    const appointment = cancelTarget
    setCancelTarget(null)
    void runAction(
      appointment,
      () => cancelAppointment(appointment.id, reason),
      `✅ Turno #${appointment.id} cancelado.`,
    )
  }

  const renderAgenda = () => {
    if (agenda.status === 'error') {
      return (
        <MessageBox variant="error">
          Error al cargar la agenda.{' '}
          <button type="button" className="admin-link-button" onClick={agenda.retry}>
            Reintentar
          </button>
        </MessageBox>
      )
    }

    if (!agenda.data) {
      return <Spinner label="Cargando agenda..." size="large" />
    }

    if (agenda.data.length === 0) {
      return <p className="admin-empty">No hay turnos que coincidan con los filtros.</p>
    }

    return (
      <>
        <AgendaTable
          appointments={agenda.data}
          busyAppointmentId={busyAppointmentId}
          onAction={handleAction}
        />
        {agenda.data.length >= AGENDA_LIMIT ? (
          <p className="admin-section__hint">
            Se muestran los primeros {AGENDA_LIMIT} turnos: usá los filtros para acotar la búsqueda.
          </p>
        ) : null}
      </>
    )
  }

  const confirmationCopy =
    pendingConfirmation?.action === 'confirm-cash'
      ? {
          icon: '💵',
          title: '¿Confirmar pago en efectivo?',
          confirmLabel: 'Sí, confirmar',
          body: 'Se registrará el pago en efectivo como aprobado y el turno quedará confirmado.',
        }
      : {
          icon: '★',
          title: '¿Marcar como completado?',
          confirmLabel: 'Sí, completar',
          body: 'El turno pasará a estado "Completado".',
        }

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="admin-topbar">
          <div>
            <h1>Bienvenida, {user?.full_name ?? 'Admin'} 👋</h1>
            <p>{formatStudioLongDate(getStudioToday())}</p>
          </div>
          <Link to="/turnera" className="btn btn-rosa">
            <i className="fas fa-plus" aria-hidden="true" /> Registrar turno presencial
          </Link>
        </div>

        {feedback ? <MessageBox variant={feedback.variant}>{feedback.message}</MessageBox> : null}

        <section className="admin-section" aria-labelledby="admin-metrics-title">
          <h2 id="admin-metrics-title" className="admin-section__title">
            <i className="fas fa-chart-line" aria-hidden="true" /> Resumen
          </h2>
          <MetricsCards status={metrics.status} metrics={metrics.data} onRetry={metrics.retry} />
          {metrics.data && metrics.data.popular_services.length > 0 ? (
            <div className="admin-popular">
              <h3>Servicios más reservados del mes</h3>
              <ol>
                {metrics.data.popular_services.map((service) => (
                  <li key={service.name}>
                    <span>{service.name}</span>
                    <strong>{service.count}</strong>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </section>

        <section className="admin-section" aria-labelledby="admin-agenda-title">
          <div className="admin-section__header">
            <h2 id="admin-agenda-title" className="admin-section__title">
              <i className="fas fa-calendar-alt" aria-hidden="true" /> Agenda de turnos
            </h2>
            <button
              type="button"
              className="admin-chip"
              onClick={agenda.retry}
              disabled={agenda.status === 'loading'}
            >
              <i
                className={agenda.status === 'loading' ? 'fas fa-sync fa-spin' : 'fas fa-sync'}
                aria-hidden="true"
              />{' '}
              Actualizar
            </button>
          </div>
          <p className="admin-section__hint">
            Los turnos presenciales se registran desde la turnera (pago en efectivo automático;
            anotá el nombre del cliente en las notas).
          </p>
          <AgendaFiltersBar
            filters={filters}
            resultCount={agenda.data ? agenda.data.length : null}
            onChange={setFilters}
          />
          {renderAgenda()}
        </section>
      </div>

      <ConfirmModal
        open={pendingConfirmation !== null}
        icon={confirmationCopy.icon}
        title={confirmationCopy.title}
        confirmLabel={confirmationCopy.confirmLabel}
        onConfirm={handleConfirmPending}
        onCancel={() => setPendingConfirmation(null)}
      >
        {pendingConfirmation ? `${describe(pendingConfirmation.appointment)}. ` : ''}
        {confirmationCopy.body}
      </ConfirmModal>

      <CancelAppointmentModal
        key={cancelTarget?.id ?? 'closed'}
        appointmentLabel={cancelTarget ? describe(cancelTarget) : null}
        isSubmitting={false}
        onConfirm={handleConfirmCancel}
        onClose={() => setCancelTarget(null)}
      />
    </div>
  )
}
