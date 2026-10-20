import { useState, type ChangeEvent, type FormEvent } from 'react'
import { SERVICE_CATEGORY_META, SERVICE_CATEGORY_ORDER } from '../../data/studioContent.ts'
import type { FieldErrors } from '../../types/auth.ts'
import {
  ServiceCategory,
  type ServiceAdmin,
  type ServiceFormValues,
  type ServicePayload,
} from '../../types/service.ts'
import { Modal } from '../common/Modal.tsx'

// Límites de ServiceCreate/ServiceUpdate en el backend.
const MIN_NAME = 3
const MAX_NAME = 255
const MAX_DURATION = 480
const MAX_IMAGE_URL = 500

function toFormValues(service: ServiceAdmin | null): ServiceFormValues {
  return {
    name: service?.name ?? '',
    description: service?.description ?? '',
    duration_minutes: service ? String(service.duration_minutes) : '60',
    price: service ? String(service.price) : '',
    category: service?.category ?? ServiceCategory.PESTANAS,
    image_url: service?.image_url ?? '',
  }
}

function isServiceCategory(value: string): value is ServiceCategory {
  return (SERVICE_CATEGORY_ORDER as string[]).includes(value)
}

function validate(values: ServiceFormValues): FieldErrors<ServiceFormValues> {
  const errors: FieldErrors<ServiceFormValues> = {}
  const name = values.name.trim()
  if (name.length < MIN_NAME || name.length > MAX_NAME) {
    errors.name = `El nombre debe tener entre ${MIN_NAME} y ${MAX_NAME} caracteres`
  }
  const duration = Number(values.duration_minutes)
  if (!Number.isInteger(duration) || duration < 1 || duration > MAX_DURATION) {
    errors.duration_minutes = `La duración debe ser un número entero entre 1 y ${MAX_DURATION} minutos`
  }
  const price = Number(values.price)
  if (!Number.isFinite(price) || price <= 0) {
    errors.price = 'El precio debe ser mayor a 0'
  }
  const imageUrl = values.image_url.trim()
  if (imageUrl && (imageUrl.length > MAX_IMAGE_URL || !/^https?:\/\//.test(imageUrl))) {
    errors.image_url = 'Ingresá una URL válida (http:// o https://)'
  }
  return errors
}

function toPayload(values: ServiceFormValues): ServicePayload {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    duration_minutes: Number(values.duration_minutes),
    price: Number(values.price),
    category: values.category,
    image_url: values.image_url.trim() || null,
  }
}

interface ServiceFormModalProps {
  /** Servicio a editar; null = alta. */
  service: ServiceAdmin | null
  isSubmitting: boolean
  submitError: string | null
  onSubmit: (payload: ServicePayload) => void
  onClose: () => void
}

/** Alta/edición de servicio. Montarlo con `key` para reiniciar el formulario. */
export function ServiceFormModal({
  service,
  isSubmitting,
  submitError,
  onSubmit,
  onClose,
}: ServiceFormModalProps) {
  const [values, setValues] = useState<ServiceFormValues>(() => toFormValues(service))
  const [errors, setErrors] = useState<FieldErrors<ServiceFormValues>>({})

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const field = event.target.name as keyof ServiceFormValues
    const { value } = event.target
    if (field === 'category') {
      if (isServiceCategory(value)) {
        setValues((previous) => ({ ...previous, category: value }))
      }
      return
    }
    setValues((previous) => ({ ...previous, [field]: value }))
    setErrors((previous) => ({ ...previous, [field]: undefined }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validation = validate(values)
    setErrors(validation)
    if (Object.values(validation).some(Boolean)) {
      return
    }
    onSubmit(toPayload(values))
  }

  const fieldError = (field: keyof ServiceFormValues) =>
    errors[field] ? (
      <small id={`service-${field}-error`} className="admin-form__error">
        {errors[field]}
      </small>
    ) : null

  return (
    <Modal open onClose={onClose} labelledBy="service-form-title" size="wide">
      <h2 id="service-form-title">{service ? 'Editar servicio' : 'Nuevo servicio'}</h2>
      <form className="admin-form" onSubmit={handleSubmit} noValidate>
        {submitError ? (
          <p className="admin-form__submit-error" role="alert">
            {submitError}
          </p>
        ) : null}

        <label htmlFor="service-name">Nombre</label>
        <input
          id="service-name"
          name="name"
          value={values.name}
          maxLength={MAX_NAME}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? 'service-name-error' : undefined}
          onChange={handleChange}
        />
        {fieldError('name')}

        <label htmlFor="service-category">Categoría</label>
        <select id="service-category" name="category" value={values.category} onChange={handleChange}>
          {SERVICE_CATEGORY_ORDER.map((category) => (
            <option key={category} value={category}>
              {SERVICE_CATEGORY_META[category].title}
            </option>
          ))}
        </select>

        <div className="admin-form__row">
          <div>
            <label htmlFor="service-duration">Duración (minutos)</label>
            <input
              id="service-duration"
              name="duration_minutes"
              type="number"
              min={1}
              max={MAX_DURATION}
              value={values.duration_minutes}
              aria-invalid={errors.duration_minutes ? true : undefined}
              aria-describedby={errors.duration_minutes ? 'service-duration_minutes-error' : undefined}
              onChange={handleChange}
            />
            {fieldError('duration_minutes')}
          </div>
          <div>
            <label htmlFor="service-price">Precio (ARS)</label>
            <input
              id="service-price"
              name="price"
              type="number"
              min={1}
              step="any"
              value={values.price}
              aria-invalid={errors.price ? true : undefined}
              aria-describedby={errors.price ? 'service-price-error' : undefined}
              onChange={handleChange}
            />
            {fieldError('price')}
          </div>
        </div>

        <label htmlFor="service-description">Descripción</label>
        <textarea
          id="service-description"
          name="description"
          value={values.description}
          onChange={handleChange}
        />

        <label htmlFor="service-image">URL de imagen (opcional)</label>
        <input
          id="service-image"
          name="image_url"
          type="url"
          value={values.image_url}
          maxLength={MAX_IMAGE_URL}
          placeholder="https://…"
          aria-invalid={errors.image_url ? true : undefined}
          aria-describedby={errors.image_url ? 'service-image_url-error' : undefined}
          onChange={handleChange}
        />
        {fieldError('image_url')}

        <div className="lm-modal__actions">
          <button
            type="button"
            className="lm-modal__btn lm-modal__btn--cancel"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button type="submit" className="lm-modal__btn lm-modal__btn--confirm" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : service ? 'Guardar cambios' : 'Crear servicio'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
