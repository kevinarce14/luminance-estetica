import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AgendaFiltersBar } from '../components/admin/AgendaFiltersBar.tsx'
import { AgendaTable, type AgendaAction } from '../components/admin/AgendaTable.tsx'
import { MetricsCards } from '../components/admin/MetricsCards.tsx'
import { CancelAppointmentModal } from '../components/appointments/CancelAppointmentModal.tsx'
import { ConfirmModal } from '../components/common/ConfirmModal.tsx'
import { MessageBox, Spinner, type MessageVariant } from '../components/common/Feedback.tsx'
import { useAuth } from '../context/AuthContext.tsx'
import { useAsyncResource } from '../hooks/useAsyncResource.ts'
import {
  AGENDA_DAYS_AHEAD,
  getAdminAgenda,
  getDashboardMetrics,
  getUsers,
} from '../services/adminApi.ts'
import { cancelAppointment, updateAppointmentStatus } from '../services/appointmentsApi.ts'
import { createCashPayment } from '../services/paymentsApi.ts'
import type { AgendaFilters, AppointmentPatch } from '../types/admin.ts'
import { isApiError } from '../types/api.ts'
import { AppointmentStatus, type AppointmentWithDetails } from '../types/appointment.ts'
import type { User } from '../types/user.ts'
import { buildAgendaRows, filterAgendaRows } from '../utils/appointments.ts'
import { formatStudioLongDate, formatStudioTime, getStudioToday } from '../utils/studioTime.ts'
import './AdminDashboardPage.css'

const INITIAL_FILTERS: AgendaFilters = { date: '', status: 'all', search: '' }
const EMPTY_USERS: User[] = []

interface Feedback {
  variant: MessageVariant
  message: string
}

/** Acción que requiere confirmación en modal (la cancelación usa su propio modal con motivo). */
interface PendingConfirmation {
  action: Extract<AgendaAction, 'confirm-cash' | 'complete'>
  appointment: AppointmentWithDetails
}

function describe(appointment: AppointmentWithDetails): string {
  return `#${appointment.id} · ${appointment.user.full_name} · ${appointment.service.name} — ${formatStudioLongDate(appointment.appointment_date)}, ${formatStudioTime(appointment.appointment_date)}`
}

export function AdminDashboardPage() {
  const { user } = useAuth()
  const metrics = useAsyncResource('admin-metrics', getDashboardMetrics)
  const agenda = useAsyncResource('admin-agenda', getAdminAgenda)
  // Sin la lista de usuarios el buscador funciona igual, solo por nombre.
  const users = useAsyncResource('admin-users', () => getUsers())

  const [filters, setFilters] = useState<AgendaFilters>(INITIAL_FILTERS)
  const [sessionPatches, setSessionPatches] = useState<ReadonlyMap<number, AppointmentPatch>>(
    () => new Map(),
  )
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null)
  const [cancelTarget, setCancelTarget] = useState<AppointmentWithDetails | null>(null)
  const [busyAppointmentId, setBusyAppointmentId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const rows = buildAgendaRows(
    agenda.data?.appointments ?? [],
    users.data ?? EMPTY_USERS,
    sessionPatches,
  )
  const filteredRows = filterAgendaRows(rows, filters)

  const applyPatch = (appointmentId: number, patch: AppointmentPatch) => {
    setSessionPatches((previous) => {
      const next = new Map(previous)
      next.set(appointmentId, { ...previous.get(appointmentId), ...patch })
      return next
    })
  }

  /**
   * Ejecuta un cambio de estado. Ante un 500 se avisa que el cambio pudo haberse guardado:
   * el backend legado valida "fecha futura" también al responder y falla con turnos pasados.
   */
  const runAction = async (
    appointment: AppointmentWithDetails,
    request: () => Promise<AppointmentPatch>,
    successMessage: string,
  ) => {
    setBusyAppointmentId(appointment.id)
    setFeedback(null)

    try {
      const patch = await request()
      applyPatch(appointment.id, patch)
      setFeedback({ variant: 'success', message: successMessage })
    } catch (error) {
      if (isApiError(error) && error.status >= 500) {
        setFeedback({
          variant: 'warning',
          message:
            'El servidor respondió con un error, pero el cambio puede haberse guardado (problema conocido del backend con turnos de fecha pasada). Se recargó la agenda para verificar.',
        })
        agenda.retry()
      } else {
        setFeedback({
          variant: 'error',
          message: isApiError(error) ? error.message : 'No se pudo completar la acción.',
        })
      }
    } finally {
      setBusyAppointmentId(null)
      metrics.retry()
    }
  }

  const handleAction = (action: AgendaAction, appointment: AppointmentWithDetails) => {
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
        async () => {
          const payment = await createCashPayment(appointment.id)
          return { status: AppointmentStatus.CONFIRMED, payment }
        },
        `✅ Turno #${appointment.id} confirmado con pago en efectivo.`,
      )
    } else {
      void runAction(
        appointment,
        async () => {
          await updateAppointmentStatus(appointment.id, AppointmentStatus.COMPLETED)
          return { status: AppointmentStatus.COMPLETED }
        },
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
      async () => {
        await cancelAppointment(appointment.id, reason)
        return { status: AppointmentStatus.CANCELLED }
      },
      `✅ Turno #${appointment.id} cancelado.`,
    )
  }

  const renderAgenda = () => {
    if (!agenda.data) {
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
      return <Spinner label="Cargando agenda..." size="large" />
    }

    return (
      <>
        {agenda.data.isPartial ? (
          <MessageBox variant="warning">
            Una de las fuentes de la agenda no respondió (los turnos de hoy ya pasados pueden no
            aparecer por un problema conocido del backend).
          </MessageBox>
        ) : null}
        <AgendaFiltersBar
          filters={filters}
          resultCount={filteredRows.length}
          onChange={setFilters}
        />
        {filteredRows.length === 0 ? (
          <p className="admin-empty">No hay turnos que coincidan con los filtros.</p>
        ) : (
          <AgendaTable
            rows={filteredRows}
            busyAppointmentId={busyAppointmentId}
            onAction={handleAction}
          />
        )}
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
          body: 'El turno pasará a estado "Completado" y dejará de aparecer en la agenda activa.',
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
            Turnos pendientes y confirmados de hoy y los próximos {AGENDA_DAYS_AHEAD} días. Los que
            completes o canceles en esta sesión se siguen mostrando con su nuevo estado. Los turnos
            presenciales se registran desde la turnera (pago en efectivo automático; anotá el
            nombre del cliente en las notas).
          </p>
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
