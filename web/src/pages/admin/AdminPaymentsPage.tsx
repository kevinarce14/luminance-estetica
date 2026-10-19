import { useState } from 'react'
import { ManualPaymentModal } from '../../components/admin/ManualPaymentModal.tsx'
import { PaymentBadge, AppointmentStatusBadge } from '../../components/appointments/StatusBadge.tsx'
import { ConfirmModal } from '../../components/common/ConfirmModal.tsx'
import { MessageBox, Spinner, type MessageVariant } from '../../components/common/Feedback.tsx'
import { PromptModal } from '../../components/common/PromptModal.tsx'
import { useAsyncResource } from '../../hooks/useAsyncResource.ts'
import { useDebouncedValue } from '../../hooks/useDebouncedValue.ts'
import { getAdminAppointments, getAdminPayments } from '../../services/adminApi.ts'
import { createManualPayment, updatePaymentStatus } from '../../services/paymentsApi.ts'
import type {
  AdminPaymentsQuery,
  ManualPaymentPayload,
  PaymentAdminView,
  PaymentMethodFilter,
  PaymentStatusFilter,
} from '../../types/admin.ts'
import { isApiError } from '../../types/api.ts'
import { AppointmentStatus, type AdminAppointment } from '../../types/appointment.ts'
import { PaymentMethod, PaymentStatus } from '../../types/payment.ts'
import { formatPrice } from '../../utils/formatters.ts'
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '../../utils/payments.ts'
import { formatStudioLongDate, formatStudioTime } from '../../utils/studioTime.ts'

const SEARCH_DEBOUNCE_MS = 300
const LIST_LIMIT = 300

interface Feedback {
  variant: MessageVariant
  message: string
}

const STATUS_OPTIONS: { value: PaymentStatusFilter; label: string }[] = [
  { value: PaymentStatus.PENDING, label: 'Pendientes' },
  { value: 'all', label: 'Todos los estados' },
  ...Object.values(PaymentStatus)
    .filter((status) => status !== PaymentStatus.PENDING)
    .map((status) => ({ value: status, label: PAYMENT_STATUS_LABELS[status] })),
]

const METHOD_OPTIONS: { value: PaymentMethodFilter; label: string }[] = [
  { value: 'all', label: 'Todos los medios' },
  ...Object.values(PaymentMethod).map((method) => ({ value: method, label: PAYMENT_METHOD_LABELS[method] })),
]

function describeAppointment(appointment: { id: number; appointment_date: string; service: { name: string } }): string {
  return `Turno #${appointment.id} · ${appointment.service.name} — ${formatStudioLongDate(appointment.appointment_date)}, ${formatStudioTime(appointment.appointment_date)}`
}

/** Un turno pendiente "necesita pago" si no tiene uno aprobado ni uno en curso en MercadoPago. */
function needsManualPayment(appointment: AdminAppointment): boolean {
  return appointment.payment === null || appointment.payment.status !== PaymentStatus.PENDING
}

function errorMessage(error: unknown, fallback: string): string {
  return isApiError(error) ? error.message : fallback
}

export function AdminPaymentsPage() {
  const [statusFilter, setStatusFilter] = useState<PaymentStatusFilter>(PaymentStatus.PENDING)
  const [methodFilter, setMethodFilter] = useState<PaymentMethodFilter>('all')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)

  const query: AdminPaymentsQuery = {
    limit: LIST_LIMIT,
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(methodFilter !== 'all' ? { method: methodFilter } : {}),
    ...(debouncedSearch.trim() ? { search: debouncedSearch.trim() } : {}),
  }
  const payments = useAsyncResource(JSON.stringify(query), () => getAdminPayments(query), {
    keepPreviousData: true,
  })
  const unpaid = useAsyncResource('admin-unpaid-appointments', () =>
    getAdminAppointments({ status: AppointmentStatus.PENDING, order: 'asc', limit: LIST_LIMIT }),
  )
  const appointmentsWithoutPayment = (unpaid.data ?? []).filter(needsManualPayment)

  const [manualTarget, setManualTarget] = useState<AdminAppointment | null>(null)
  const [approveTarget, setApproveTarget] = useState<PaymentAdminView | null>(null)
  const [rejectTarget, setRejectTarget] = useState<PaymentAdminView | null>(null)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const refreshAll = () => {
    payments.retry()
    unpaid.retry()
  }

  const run = async (request: () => Promise<unknown>, successMessage: string, fallback: string) => {
    setBusy(true)
    setFeedback(null)
    try {
      await request()
      setFeedback({ variant: 'success', message: successMessage })
      refreshAll()
    } catch (error) {
      setFeedback({ variant: 'error', message: errorMessage(error, fallback) })
    } finally {
      setBusy(false)
    }
  }

  const handleManualPayment = async (payload: ManualPaymentPayload) => {
    const methodLabel = PAYMENT_METHOD_LABELS[payload.payment_method].toLowerCase()
    await run(
      () => createManualPayment(payload),
      `✅ Pago en ${methodLabel} registrado: el turno #${payload.appointment_id} quedó confirmado.`,
      'No se pudo registrar el pago.',
    )
    setManualTarget(null)
  }

  const handleApprove = () => {
    if (!approveTarget) {
      return
    }
    const payment = approveTarget
    setApproveTarget(null)
    void run(
      () => updatePaymentStatus(payment.id, { status: PaymentStatus.APPROVED, notes: 'Aprobado manualmente por el admin' }),
      `✅ Pago #${payment.id} aprobado: el turno #${payment.appointment_id} quedó confirmado.`,
      'No se pudo aprobar el pago.',
    )
  }

  const handleReject = (reason: string) => {
    if (!rejectTarget) {
      return
    }
    const payment = rejectTarget
    setRejectTarget(null)
    void run(
      () => updatePaymentStatus(payment.id, { status: PaymentStatus.REJECTED, ...(reason ? { notes: reason } : {}) }),
      `Pago #${payment.id} rechazado. El turno sigue pendiente de pago.`,
      'No se pudo rechazar el pago.',
    )
  }

  const renderUnpaid = () => {
    if (unpaid.status === 'error') {
      return <MessageBox variant="error">No se pudieron cargar los turnos pendientes.</MessageBox>
    }
    if (!unpaid.data) {
      return <Spinner label="Cargando turnos pendientes..." />
    }
    if (appointmentsWithoutPayment.length === 0) {
      return <p className="admin-empty">No hay turnos pendientes sin pago. 🎉</p>
    }
    return (
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Turno</th>
              <th scope="col">Cliente</th>
              <th scope="col">Servicio</th>
              <th scope="col">Monto</th>
              <th scope="col">Pago</th>
              <th scope="col">Acción</th>
            </tr>
          </thead>
          <tbody>
            {appointmentsWithoutPayment.map((appointment) => (
              <tr key={appointment.id}>
                <td data-label="Turno">
                  #{appointment.id}
                  <small className="admin-table__contact">
                    {formatStudioLongDate(appointment.appointment_date)} · {formatStudioTime(appointment.appointment_date)}
                  </small>
                </td>
                <td data-label="Cliente">
                  {appointment.user.full_name}
                  <small className="admin-table__contact">{appointment.user.email}</small>
                </td>
                <td data-label="Servicio">{appointment.service.name}</td>
                <td data-label="Monto">{formatPrice(appointment.service.price)}</td>
                <td data-label="Pago">
                  <PaymentBadge status={appointment.payment?.status} method={appointment.payment?.payment_method} />
                </td>
                <td data-label="Acción">
                  <button type="button" className="admin-btn admin-btn--success" disabled={busy} onClick={() => setManualTarget(appointment)}>
                    Registrar pago
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderPayments = () => {
    if (payments.status === 'error') {
      return (
        <MessageBox variant="error">
          Error al cargar los pagos.{' '}
          <button type="button" className="admin-link-button" onClick={payments.retry}>
            Reintentar
          </button>
        </MessageBox>
      )
    }
    if (!payments.data) {
      return <Spinner label="Cargando pagos..." size="large" />
    }
    if (payments.data.length === 0) {
      return <p className="admin-empty">No hay pagos que coincidan con los filtros.</p>
    }
    return (
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Pago</th>
              <th scope="col">Cliente</th>
              <th scope="col">Turno</th>
              <th scope="col">Monto</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {payments.data.map((payment) => (
              <tr key={payment.id}>
                <td data-label="Pago">
                  #{payment.id}
                  <small className="admin-table__contact">
                    {formatStudioLongDate(payment.created_at)} · {PAYMENT_METHOD_LABELS[payment.payment_method]}
                  </small>
                </td>
                <td data-label="Cliente">
                  {payment.user.full_name}
                  <small className="admin-table__contact">
                    {payment.user.email}
                    {payment.user.phone ? ` · ${payment.user.phone}` : ''}
                  </small>
                </td>
                <td data-label="Turno">
                  #{payment.appointment.id} · {payment.appointment.service.name}
                  <small className="admin-table__contact">
                    {formatStudioLongDate(payment.appointment.appointment_date)} · {formatStudioTime(payment.appointment.appointment_date)}
                  </small>
                  <AppointmentStatusBadge status={payment.appointment.status} />
                </td>
                <td data-label="Monto">{formatPrice(payment.amount)}</td>
                <td data-label="Estado">
                  <PaymentBadge status={payment.status} />
                  {payment.error_message || payment.payment_details ? (
                    <small className="admin-table__contact">
                      {payment.error_message ?? payment.payment_details}
                    </small>
                  ) : null}
                </td>
                <td data-label="Acciones">
                  {payment.status === PaymentStatus.PENDING ? (
                    <div className="admin-table__actions">
                      <button type="button" className="admin-btn admin-btn--success" disabled={busy} onClick={() => setApproveTarget(payment)}>
                        Aprobar
                      </button>
                      <button type="button" className="admin-btn admin-btn--danger" disabled={busy} onClick={() => setRejectTarget(payment)}>
                        Rechazar
                      </button>
                    </div>
                  ) : (
                    <span className="admin-table__contact">—</span>
                  )}
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

      <section className="admin-section" aria-labelledby="admin-unpaid-title">
        <h2 id="admin-unpaid-title" className="admin-section__title">
          <i className="fas fa-hourglass-half" aria-hidden="true" /> Turnos pendientes sin pago
        </h2>
        <p className="admin-section__hint">
          Reservas que todavía no tienen un pago aprobado ni un checkout de Mercado Pago en curso.
          Registrá acá los pagos en efectivo o por transferencia: el turno queda confirmado y la
          clienta recibe el email de confirmación.
        </p>
        {renderUnpaid()}
      </section>

      <section className="admin-section" aria-labelledby="admin-payments-title">
        <h2 id="admin-payments-title" className="admin-section__title">
          <i className="fas fa-dollar-sign" aria-hidden="true" /> Pagos
        </h2>
        <div className="admin-filters admin-filters--compact">
          <div className="admin-filters__field admin-filters__field--search">
            <label htmlFor="payments-search">Buscar</label>
            <div className="admin-filters__search">
              <i className="fas fa-search" aria-hidden="true" />
              <input
                id="payments-search"
                type="search"
                value={search}
                maxLength={100}
                placeholder="Cliente, email, teléfono, servicio o #turno"
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          <div className="admin-filters__field">
            <label htmlFor="payments-status">Estado</label>
            <select
              id="payments-status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as PaymentStatusFilter)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-filters__field">
            <label htmlFor="payments-method">Medio</label>
            <select
              id="payments-method"
              value={methodFilter}
              onChange={(event) => setMethodFilter(event.target.value as PaymentMethodFilter)}
            >
              {METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {renderPayments()}
      </section>

      {manualTarget ? (
        <ManualPaymentModal
          key={manualTarget.id}
          appointmentId={manualTarget.id}
          description={describeAppointment(manualTarget)}
          amount={manualTarget.service.price}
          isSubmitting={busy}
          onConfirm={(payload) => void handleManualPayment(payload)}
          onClose={() => !busy && setManualTarget(null)}
        />
      ) : null}

      <ConfirmModal
        open={approveTarget !== null}
        icon="✅"
        title="¿Aprobar pago?"
        confirmLabel="Sí, aprobar"
        onConfirm={handleApprove}
        onCancel={() => setApproveTarget(null)}
      >
        {approveTarget
          ? `${formatPrice(approveTarget.amount)} de ${approveTarget.user.full_name} (${describeAppointment(approveTarget.appointment)}). El turno quedará confirmado.`
          : ''}
      </ConfirmModal>

      {rejectTarget ? (
        <PromptModal
          key={rejectTarget.id}
          icon="⚠️"
          title="Rechazar pago"
          description={`${formatPrice(rejectTarget.amount)} de ${rejectTarget.user.full_name}. El turno seguirá pendiente de pago.`}
          label="Motivo (se guarda en el pago)"
          placeholder="Ej: comprobante ilegible"
          confirmLabel="Rechazar pago"
          onConfirm={handleReject}
          onClose={() => setRejectTarget(null)}
        />
      ) : null}
    </>
  )
}
