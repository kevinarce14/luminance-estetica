import { useCallback, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MessageBox } from '../components/common/Feedback.tsx'
import { AdminBookingSuccess } from '../components/turnera/AdminBookingSuccess.tsx'
import { BookingCalendar } from '../components/turnera/BookingCalendar.tsx'
import { BookingSection } from '../components/turnera/BookingSection.tsx'
import { BookingStepper } from '../components/turnera/BookingStepper.tsx'
import { BookingSummary } from '../components/turnera/BookingSummary.tsx'
import { ServiceSelector } from '../components/turnera/ServiceSelector.tsx'
import { TimeSlotPicker } from '../components/turnera/TimeSlotPicker.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import { useAsyncResource } from '../hooks/useAsyncResource.ts'
import { useAvailableSlots } from '../hooks/useAvailableSlots.ts'
import {
  createAppointment,
  getBookedSlots,
} from '../services/appointmentsApi.ts'
import { createCashPayment } from '../services/paymentsApi.ts'
import { getActiveServices } from '../services/servicesApi.ts'
import { isApiError } from '../types/api.ts'
import type { PublicBookedSlot } from '../types/appointment.ts'
import type { AdminBookingResult, BookingStep } from '../types/booking.ts'
import type { TurneraLocationState } from '../types/navigation.ts'
import type { Service } from '../types/service.ts'
import { countBookedSlotsByDay } from '../utils/availability.ts'
import { formatStudioLongDate, toStudioIsoDateTime } from '../utils/studioTime.ts'
import './TurneraPage.css'

const SCROLL_DELAY_MS = 100
/** `notes` de AppointmentCreate: max_length=1000. */
const MAX_NOTES_LENGTH = 1000
// Referencias estables para no recalcular derivados mientras no hay datos.
const EMPTY_SERVICES: Service[] = []
const EMPTY_BOOKED_SLOTS: PublicBookedSlot[] = []

function scrollToSection(element: HTMLElement | null): void {
  window.setTimeout(() => {
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, SCROLL_DELAY_MS)
}

export function TurneraPage() {
  const { isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const preselectedServiceId =
    (location.state as TurneraLocationState | null)?.serviceId ?? null

  const serviceSectionRef = useRef<HTMLElement>(null)
  const timeSectionRef = useRef<HTMLElement>(null)
  const summarySectionRef = useRef<HTMLElement>(null)

  // ===== Catálogo de servicios =====
  const servicesResource = useAsyncResource('services', getActiveServices)
  const services = servicesResource.data ?? EMPTY_SERVICES

  // ===== Horarios ocupados (marcas del calendario) =====
  const bookedResource = useAsyncResource('booked-slots', getBookedSlots)
  const bookedSlots = bookedResource.data ?? EMPTY_BOOKED_SLOTS
  const refreshBooked = bookedResource.retry

  const busyDays = useMemo(() => countBookedSlotsByDay(bookedSlots), [bookedSlots])

  // ===== Selección del usuario =====
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(
    preselectedServiceId,
  )
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  // Un serviceId que no existe en el catálogo (o inactivo) se ignora.
  const selectedService = services.find((service) => service.id === selectedServiceId) ?? null
  const isPreselected =
    preselectedServiceId !== null && selectedService?.id === preselectedServiceId

  const availability = useAvailableSlots(selectedService?.id ?? null, selectedDate)

  // Si el horario elegido deja de estar disponible (ej. al refrescar), se descarta.
  const slotIsStillAvailable = availability.slots.some(
    (slot) => slot.start_time === selectedSlot,
  )
  const activeSlot = slotIsStillAvailable ? selectedSlot : null

  const currentStep: BookingStep =
    selectedDate === null ? 1 : selectedService === null ? 2 : activeSlot === null ? 3 : 4

  // ===== Confirmación =====
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [adminResult, setAdminResult] = useState<AdminBookingResult | null>(null)
  // Turnos presenciales: el backend crea el turno a nombre del admin, el cliente va en notas.
  const [adminNotes, setAdminNotes] = useState('')

  const handleSelectDate = (date: string) => {
    setSelectedDate(date)
    setSelectedSlot(null)
    setSubmitError(null)
    scrollToSection(selectedService ? timeSectionRef.current : serviceSectionRef.current)
  }

  const handleSelectService = (serviceId: number) => {
    setSelectedServiceId(serviceId)
    setSelectedSlot(null)
    setSubmitError(null)
    scrollToSection(timeSectionRef.current)
  }

  const handleSelectSlot = (slotStart: string) => {
    setSelectedSlot(slotStart)
    setSubmitError(null)
    scrollToSection(summarySectionRef.current)
  }

  const resetBooking = useCallback(() => {
    setSelectedDate(null)
    setSelectedServiceId(null)
    setSelectedSlot(null)
    setSubmitError(null)
    setAdminResult(null)
    setAdminNotes('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleConfirm = async () => {
    if (!selectedService || !selectedDate || !activeSlot) {
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    let appointmentId: number
    try {
      const appointment = await createAppointment({
        service_id: selectedService.id,
        appointment_date: toStudioIsoDateTime(activeSlot),
        ...(isAdmin && adminNotes.trim() ? { notes: adminNotes.trim() } : {}),
      })
      appointmentId = appointment.id
    } catch (error) {
      setSubmitError(
        isApiError(error)
          ? `Error al crear la reserva: ${error.message}`
          : 'Error al crear la reserva.',
      )
      setIsSubmitting(false)
      // El horario pudo ocuparse mientras tanto: se refresca la disponibilidad.
      availability.retry()
      refreshBooked()
      return
    }

    if (!isAdmin) {
      // Flujo normal: el turno queda "pendiente de pago" y se completa en /pago.
      navigate(`/pago?appointment_id=${appointmentId}`)
      return
    }

    // Flujo admin (igual que el legado): pago en efectivo aprobado automáticamente.
    let paymentConfirmed = true
    try {
      await createCashPayment(appointmentId)
    } catch (error) {
      console.error('Error confirmando el pago en efectivo:', error)
      paymentConfirmed = false
    }

    setAdminResult({
      appointmentId,
      serviceName: selectedService.name,
      date: selectedDate,
      slotStart: activeSlot,
      paymentConfirmed,
    })
    setIsSubmitting(false)
    refreshBooked()
    scrollToSection(summarySectionRef.current)
  }

  return (
    <div className="turnera-page">
      <div className="turnera-container">
        <div className="turnera-title">
          <h1>📅 Reserva tu Turno Online</h1>
          <p>Seguí los pasos para reservar tu turno</p>
        </div>

        <BookingStepper currentStep={adminResult ? 4 : currentStep} />

        {/* ===== PASO 1: FECHA ===== */}
        <BookingSection id="turnera-fecha" icon="fas fa-calendar" title="Paso 1: Seleccioná una Fecha">
          <MessageBox variant="info">
            Hacé click en el día que prefieras para tu turno. Los días con turnos confirmados se
            muestran en rojo.
          </MessageBox>
          <BookingCalendar
            selectedDate={selectedDate}
            busyDays={busyDays}
            onSelectDate={handleSelectDate}
          />
          {selectedDate ? (
            <p className="turnera-selected-date">
              <i className="fas fa-check-circle" aria-hidden="true" />{' '}
              {formatStudioLongDate(selectedDate)}
            </p>
          ) : null}
        </BookingSection>

        {/* ===== PASO 2: SERVICIO ===== */}
        <BookingSection
          ref={serviceSectionRef}
          id="turnera-servicio"
          icon="fas fa-spa"
          title="Paso 2: Seleccioná un Servicio"
          disabled={selectedDate === null}
        >
          {isPreselected ? (
            <MessageBox variant="success">
              Servicio pre-seleccionado desde la página principal. Podés cambiarlo si lo deseás.
            </MessageBox>
          ) : null}
          <ServiceSelector
            status={servicesResource.status}
            services={services}
            selectedServiceId={selectedService?.id ?? null}
            onSelect={handleSelectService}
            onRetry={servicesResource.retry}
          />
        </BookingSection>

        {/* ===== PASO 3: HORARIO ===== */}
        <BookingSection
          ref={timeSectionRef}
          id="turnera-horario"
          icon="fas fa-clock"
          title="Paso 3: Seleccioná un Horario"
          disabled={selectedDate === null || selectedService === null}
        >
          <TimeSlotPicker
            status={availability.status}
            date={selectedDate}
            slots={availability.slots}
            isDayClosed={availability.isDayClosed}
            selectedSlot={activeSlot}
            onSelect={handleSelectSlot}
            onRetry={availability.retry}
          />
        </BookingSection>

        {/* ===== PASO 4: RESUMEN Y CONFIRMACIÓN ===== */}
        <BookingSection
          ref={summarySectionRef}
          id="turnera-resumen"
          icon="fas fa-check-circle"
          title={adminResult ? '¡Reserva Confirmada!' : 'Paso 4: Resumen de tu Reserva'}
          disabled={!adminResult && currentStep < 4}
        >
          {adminResult ? (
            <AdminBookingSuccess result={adminResult} onCreateAnother={resetBooking} />
          ) : (
            <>
              {selectedService && selectedDate && activeSlot ? (
                <BookingSummary
                  service={selectedService}
                  date={selectedDate}
                  slotStart={activeSlot}
                />
              ) : (
                <p className="turnera-summary-placeholder">
                  Completá los pasos anteriores para ver el resumen.
                </p>
              )}

              <MessageBox variant="warning">
                <strong>Importante:</strong> Al confirmar se creará tu reserva con estado
                &quot;Pendiente de Pago&quot;. Deberás completar el pago para que tu turno quede
                confirmado.
              </MessageBox>

              {isAdmin ? (
                <div className="turnera-admin-notes">
                  <label htmlFor="turnera-admin-notes">
                    <i className="fas fa-user-edit" aria-hidden="true" /> Turno presencial: cliente
                    y notas (opcional)
                  </label>
                  <textarea
                    id="turnera-admin-notes"
                    value={adminNotes}
                    maxLength={MAX_NOTES_LENGTH}
                    placeholder="Ej: María Pérez — 11 5555-1234"
                    onChange={(event) => setAdminNotes(event.target.value)}
                  />
                  <small>
                    El turno queda registrado a tu nombre con pago en efectivo; estas notas se ven
                    en la agenda del panel.
                  </small>
                </div>
              ) : null}

              {submitError ? <MessageBox variant="error">{submitError}</MessageBox> : null}

              <button
                type="button"
                className="turnera-confirm"
                disabled={currentStep < 4 || isSubmitting}
                onClick={handleConfirm}
              >
                {isSubmitting ? (
                  <>
                    <i className="fas fa-spinner fa-spin" aria-hidden="true" /> Procesando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-calendar-check" aria-hidden="true" /> Confirmar Reserva
                  </>
                )}
              </button>
            </>
          )}
        </BookingSection>
      </div>
    </div>
  )
}
