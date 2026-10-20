import { useState } from 'react'
import { ServiceFormModal } from '../../components/admin/ServiceFormModal.tsx'
import { ConfirmModal } from '../../components/common/ConfirmModal.tsx'
import { MessageBox, Spinner, type MessageVariant } from '../../components/common/Feedback.tsx'
import { SERVICE_CATEGORY_META } from '../../data/studioContent.ts'
import { useAsyncResource } from '../../hooks/useAsyncResource.ts'
import {
  createService,
  deleteService,
  getAllServicesAdmin,
  toggleServiceActive,
  updateService,
} from '../../services/servicesApi.ts'
import { isApiError } from '../../types/api.ts'
import type { ServiceAdmin, ServicePayload } from '../../types/service.ts'
import { formatPrice } from '../../utils/formatters.ts'

interface Feedback {
  variant: MessageVariant
  message: string
}

/** Formulario abierto: `service` null = alta. */
interface FormState {
  service: ServiceAdmin | null
}

function errorMessage(error: unknown, fallback: string): string {
  return isApiError(error) ? error.message : fallback
}

export function AdminServicesPage() {
  const services = useAsyncResource('admin-services', getAllServicesAdmin)
  const [form, setForm] = useState<FormState | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ServiceAdmin | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const openForm = (service: ServiceAdmin | null) => {
    setFormError(null)
    setForm({ service })
  }

  const handleSubmit = async (payload: ServicePayload) => {
    if (!form) {
      return
    }
    setIsSaving(true)
    setFormError(null)
    try {
      const saved = form.service
        ? await updateService(form.service.id, payload)
        : await createService(payload)
      setFeedback({
        variant: 'success',
        message: `✅ Servicio "${saved.name}" ${form.service ? 'actualizado' : 'creado'}.`,
      })
      setForm(null)
      services.retry()
    } catch (error) {
      setFormError(errorMessage(error, 'No se pudo guardar el servicio.'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggle = async (service: ServiceAdmin) => {
    setBusyId(service.id)
    setFeedback(null)
    try {
      const updated = await toggleServiceActive(service.id)
      setFeedback({
        variant: 'success',
        message: `✅ "${updated.name}" ${updated.is_active ? 'activado: vuelve a aparecer en la web y la turnera' : 'desactivado: ya no se puede reservar'}.`,
      })
      services.retry()
    } catch (error) {
      setFeedback({ variant: 'error', message: errorMessage(error, 'No se pudo cambiar el estado.') })
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) {
      return
    }
    const service = deleteTarget
    setDeleteTarget(null)
    setBusyId(service.id)
    setFeedback(null)
    try {
      await deleteService(service.id)
      setFeedback({ variant: 'success', message: `✅ Servicio "${service.name}" eliminado.` })
      services.retry()
    } catch (error) {
      // El backend impide borrar servicios con turnos: se sugiere desactivarlo.
      setFeedback({ variant: 'warning', message: errorMessage(error, 'No se pudo eliminar el servicio.') })
    } finally {
      setBusyId(null)
    }
  }

  const renderTable = () => {
    if (services.status === 'error') {
      return (
        <MessageBox variant="error">
          Error al cargar los servicios.{' '}
          <button type="button" className="admin-link-button" onClick={services.retry}>
            Reintentar
          </button>
        </MessageBox>
      )
    }
    if (!services.data) {
      return <Spinner label="Cargando servicios..." size="large" />
    }
    if (services.data.length === 0) {
      return <p className="admin-empty">Todavía no hay servicios cargados.</p>
    }

    const sorted = [...services.data].sort(
      (a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name),
    )

    return (
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Servicio</th>
              <th scope="col">Categoría</th>
              <th scope="col">Duración</th>
              <th scope="col">Precio</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((service) => {
              const disabled = busyId !== null
              return (
                <tr key={service.id} aria-busy={busyId === service.id || undefined}>
                  <td data-label="Servicio">
                    <strong>{service.name}</strong>
                    {service.description ? (
                      <small className="admin-table__contact">{service.description}</small>
                    ) : null}
                  </td>
                  <td data-label="Categoría">
                    {SERVICE_CATEGORY_META[service.category]?.title ?? service.category}
                  </td>
                  <td data-label="Duración">{service.duration_minutes} min</td>
                  <td data-label="Precio">{formatPrice(service.price)}</td>
                  <td data-label="Estado">
                    <span className={service.is_active ? 'lm-badge lm-badge--confirmed' : 'lm-badge lm-badge--no-payment'}>
                      {service.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td data-label="Acciones">
                    <div className="admin-table__actions">
                      <button type="button" className="admin-btn admin-btn--info" disabled={disabled} onClick={() => openForm(service)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className={service.is_active ? 'admin-btn admin-btn--warning' : 'admin-btn admin-btn--success'}
                        disabled={disabled}
                        onClick={() => void handleToggle(service)}
                      >
                        {service.is_active ? 'Desactivar' : 'Activar'}
                      </button>
                      <button type="button" className="admin-btn admin-btn--danger" disabled={disabled} onClick={() => setDeleteTarget(service)}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <>
      {feedback ? <MessageBox variant={feedback.variant}>{feedback.message}</MessageBox> : null}
      <section className="admin-section" aria-labelledby="admin-services-title">
        <div className="admin-section__header">
          <h2 id="admin-services-title" className="admin-section__title">
            <i className="fas fa-spa" aria-hidden="true" /> Servicios
          </h2>
          <button type="button" className="btn btn-rosa" onClick={() => openForm(null)}>
            <i className="fas fa-plus" aria-hidden="true" /> Nuevo servicio
          </button>
        </div>
        <p className="admin-section__hint">
          Los servicios inactivos no se muestran en la web ni en la turnera. Un servicio con turnos
          no se puede eliminar: desactivalo para conservar el historial.
        </p>
        {renderTable()}
      </section>

      {form ? (
        <ServiceFormModal
          key={form.service?.id ?? 'new'}
          service={form.service}
          isSubmitting={isSaving}
          submitError={formError}
          onSubmit={(payload) => void handleSubmit(payload)}
          onClose={() => !isSaving && setForm(null)}
        />
      ) : null}

      <ConfirmModal
        open={deleteTarget !== null}
        icon="🗑️"
        title="¿Eliminar servicio?"
        confirmLabel="Sí, eliminar"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      >
        {deleteTarget ? `"${deleteTarget.name}" se eliminará definitivamente.` : ''}
      </ConfirmModal>
    </>
  )
}
