import { useState } from 'react'
import { AppointmentStatusBadge, PaymentBadge } from '../../components/appointments/StatusBadge.tsx'
import { ConfirmModal } from '../../components/common/ConfirmModal.tsx'
import { MessageBox, Spinner, type MessageVariant } from '../../components/common/Feedback.tsx'
import { useAsyncResource } from '../../hooks/useAsyncResource.ts'
import { useDebouncedValue } from '../../hooks/useDebouncedValue.ts'
import { getClientAppointments, getClients, toggleUserActive } from '../../services/adminApi.ts'
import type { ClientSummary } from '../../types/admin.ts'
import { isApiError } from '../../types/api.ts'
import { formatPrice } from '../../utils/formatters.ts'
import { formatStudioLongDate, formatStudioTime } from '../../utils/studioTime.ts'

const SEARCH_DEBOUNCE_MS = 300

interface Feedback {
  variant: MessageVariant
  message: string
}

interface ClientHistoryProps {
  client: ClientSummary
  onClose: () => void
}

/** Historial de turnos de un cliente (GET /admin/appointments?user_id=). */
function ClientHistory({ client, onClose }: ClientHistoryProps) {
  const history = useAsyncResource(`client-history-${client.id}`, () => getClientAppointments(client.id))

  return (
    <section className="admin-section admin-client-history" aria-labelledby="client-history-title">
      <div className="admin-section__header">
        <h2 id="client-history-title" className="admin-section__title">
          <i className="fas fa-history" aria-hidden="true" /> Historial de {client.full_name}
        </h2>
        <button type="button" className="admin-chip" onClick={onClose}>
          <i className="fas fa-times" aria-hidden="true" /> Cerrar
        </button>
      </div>
      <p className="admin-section__hint">
        {client.email}
        {client.phone ? ` · ${client.phone}` : ''} · Cliente desde {formatStudioLongDate(client.created_at)}
      </p>
      {history.status === 'error' ? (
        <MessageBox variant="error">No se pudo cargar el historial.</MessageBox>
      ) : !history.data ? (
        <Spinner label="Cargando historial..." />
      ) : history.data.length === 0 ? (
        <p className="admin-empty">Todavía no reservó turnos.</p>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Turno</th>
                <th scope="col">Fecha y hora</th>
                <th scope="col">Servicio</th>
                <th scope="col">Estado</th>
                <th scope="col">Pago</th>
              </tr>
            </thead>
            <tbody>
              {history.data.map((appointment) => (
                <tr key={appointment.id}>
                  <td data-label="Turno">#{appointment.id}</td>
                  <td data-label="Fecha y hora">
                    {formatStudioLongDate(appointment.appointment_date)}
                    <br />
                    <strong>{formatStudioTime(appointment.appointment_date)}</strong>
                  </td>
                  <td data-label="Servicio">
                    {appointment.service.name}
                    {appointment.cancellation_reason ? (
                      <small className="admin-table__contact">Motivo: {appointment.cancellation_reason}</small>
                    ) : null}
                  </td>
                  <td data-label="Estado">
                    <AppointmentStatusBadge status={appointment.status} />
                  </td>
                  <td data-label="Pago">
                    <PaymentBadge status={appointment.payment?.status} method={appointment.payment?.payment_method} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function AdminClientsPage() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)
  const clients = useAsyncResource(`clients-${debouncedSearch.trim()}`, () => getClients(debouncedSearch), {
    keepPreviousData: true,
  })
  const [selected, setSelected] = useState<ClientSummary | null>(null)
  const [toggleTarget, setToggleTarget] = useState<ClientSummary | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const handleToggle = async () => {
    if (!toggleTarget) {
      return
    }
    const client = toggleTarget
    setToggleTarget(null)
    setBusyId(client.id)
    setFeedback(null)
    try {
      const updated = await toggleUserActive(client.id)
      setFeedback({
        variant: 'success',
        message: updated.is_active
          ? `✅ Cuenta de ${updated.full_name} reactivada.`
          : `Cuenta de ${updated.full_name} desactivada: ya no puede iniciar sesión.`,
      })
      clients.retry()
    } catch (error) {
      setFeedback({ variant: 'error', message: isApiError(error) ? error.message : 'No se pudo actualizar la cuenta.' })
    } finally {
      setBusyId(null)
    }
  }

  const renderTable = () => {
    if (clients.status === 'error') {
      return (
        <MessageBox variant="error">
          Error al cargar los clientes.{' '}
          <button type="button" className="admin-link-button" onClick={clients.retry}>
            Reintentar
          </button>
        </MessageBox>
      )
    }
    if (!clients.data) {
      return <Spinner label="Cargando clientes..." size="large" />
    }
    if (clients.data.length === 0) {
      return <p className="admin-empty">No hay clientes que coincidan con la búsqueda.</p>
    }
    return (
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Cliente</th>
              <th scope="col">Contacto</th>
              <th scope="col">Turnos</th>
              <th scope="col">Último turno</th>
              <th scope="col">Total pagado</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clients.data.map((client) => (
              <tr key={client.id} aria-busy={busyId === client.id || undefined}>
                <td data-label="Cliente">
                  <strong>{client.full_name}</strong>
                  <small className="admin-table__contact">Desde {formatStudioLongDate(client.created_at)}</small>
                </td>
                <td data-label="Contacto">
                  <a href={`mailto:${client.email}`}>{client.email}</a>
                  {client.phone ? <small className="admin-table__contact">{client.phone}</small> : null}
                </td>
                <td data-label="Turnos">
                  {client.appointments_count}
                  <small className="admin-table__contact">
                    {client.completed_count} completados · {client.cancelled_count} cancelados
                  </small>
                </td>
                <td data-label="Último turno">
                  {client.last_appointment_date ? formatStudioLongDate(client.last_appointment_date) : '—'}
                </td>
                <td data-label="Total pagado">{formatPrice(client.total_paid)}</td>
                <td data-label="Estado">
                  <span className={client.is_active ? 'lm-badge lm-badge--confirmed' : 'lm-badge lm-badge--cancelled'}>
                    {client.is_active ? 'Activa' : 'Desactivada'}
                  </span>
                </td>
                <td data-label="Acciones">
                  <div className="admin-table__actions">
                    <button type="button" className="admin-btn admin-btn--info" onClick={() => setSelected(client)}>
                      Ver historial
                    </button>
                    <button
                      type="button"
                      className={client.is_active ? 'admin-btn admin-btn--warning' : 'admin-btn admin-btn--success'}
                      disabled={busyId !== null}
                      onClick={() => setToggleTarget(client)}
                    >
                      {client.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <>
      {feedback ? <MessageBox variant={feedback.variant}>{feedback.message}</MessageBox> : null}

      <section className="admin-section" aria-labelledby="admin-clients-title">
        <h2 id="admin-clients-title" className="admin-section__title">
          <i className="fas fa-users" aria-hidden="true" /> Clientes
        </h2>
        <div className="admin-filters admin-filters--compact">
          <div className="admin-filters__field admin-filters__field--search">
            <label htmlFor="clients-search">Buscar cliente</label>
            <div className="admin-filters__search">
              <i className="fas fa-search" aria-hidden="true" />
              <input
                id="clients-search"
                type="search"
                value={search}
                maxLength={100}
                placeholder="Nombre, email o teléfono"
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          {clients.data ? (
            <span className="admin-filters__count" aria-live="polite">
              {clients.data.length} {clients.data.length === 1 ? 'cliente' : 'clientes'}
            </span>
          ) : null}
        </div>
        {renderTable()}
      </section>

      {selected ? <ClientHistory key={selected.id} client={selected} onClose={() => setSelected(null)} /> : null}

      <ConfirmModal
        open={toggleTarget !== null}
        icon={toggleTarget?.is_active ? '🔒' : '🔓'}
        title={toggleTarget?.is_active ? '¿Desactivar cuenta?' : '¿Reactivar cuenta?'}
        confirmLabel={toggleTarget?.is_active ? 'Sí, desactivar' : 'Sí, reactivar'}
        onConfirm={() => void handleToggle()}
        onCancel={() => setToggleTarget(null)}
      >
        {toggleTarget?.is_active
          ? `${toggleTarget.full_name} no podrá iniciar sesión ni reservar turnos. Su historial se conserva.`
          : `${toggleTarget?.full_name ?? ''} podrá volver a iniciar sesión y reservar.`}
      </ConfirmModal>
    </>
  )
}
