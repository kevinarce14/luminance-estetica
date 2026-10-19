import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthCard } from '../components/auth/AuthCard.tsx'
import { AuthField } from '../components/auth/AuthField.tsx'
import { confirmPasswordReset } from '../services/authApi.ts'
import { isApiError } from '../types/api.ts'
import type { FieldErrors, ResetPasswordFormValues } from '../types/auth.ts'
import type { LoginLocationState, PasswordResetLocationState } from '../types/navigation.ts'
import {
  hasFieldErrors,
  normalizeResetToken,
  PASSWORD_HINT,
  validateResetPassword,
} from '../utils/validators.ts'

/**
 * Paso 2 de "Recuperar contraseña": código + nueva contraseña.
 * El código puede llegar en el link del email (?token=) o pegarse a mano.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const locationState = location.state as PasswordResetLocationState | null
  const tokenFromLink = searchParams.get('token') ?? locationState?.token ?? ''

  const [values, setValues] = useState<ResetPasswordFormValues>({
    token: tokenFromLink,
    password: '',
    confirmPassword: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<ResetPasswordFormValues>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // El código no queda visible en la barra de direcciones ni en el historial.
  useEffect(() => {
    if (searchParams.has('token')) {
      const state: PasswordResetLocationState = { ...locationState, token: searchParams.get('token') ?? '' }
      navigate('/reset-password', { replace: true, state })
    }
  }, [searchParams, locationState, navigate])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as keyof ResetPasswordFormValues
    const { value } = event.target
    setValues((previous) => ({ ...previous, [field]: value }))
    setFieldErrors((previous) => ({ ...previous, [field]: undefined }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)
    const errors = validateResetPassword(values)
    setFieldErrors(errors)
    if (hasFieldErrors(errors)) {
      return
    }

    setIsSubmitting(true)
    try {
      await confirmPasswordReset({
        token: normalizeResetToken(values.token),
        new_password: values.password,
      })
      const loginState: LoginLocationState = {
        email: locationState?.email,
        notice: '✅ ¡Contraseña actualizada! Iniciá sesión con tu nueva contraseña.',
      }
      navigate('/login', { replace: true, state: loginState })
    } catch (error) {
      setSubmitError(
        isApiError(error) ? error.message : 'No se pudo cambiar la contraseña. Intentá de nuevo.',
      )
      setIsSubmitting(false)
    }
  }

  const forgotState: PasswordResetLocationState = { email: locationState?.email }

  return (
    <AuthCard title="Nueva contraseña" subtitle="Ingresá el código que recibiste por email">
      {submitError ? (
        <div className="auth-alert auth-alert--error" role="alert">
          {submitError}{' '}
          <Link to="/forgot-password" state={forgotState}>
            Solicitar un código nuevo
          </Link>
        </div>
      ) : null}

      <form onSubmit={(event) => void handleSubmit(event)} noValidate>
        <AuthField
          id="reset-token"
          name="token"
          label="Código de verificación"
          type="text"
          value={values.token}
          placeholder="Pegá el código del email"
          autoComplete="one-time-code"
          hint={tokenFromLink ? 'Completado desde el link del email' : undefined}
          error={fieldErrors.token}
          disabled={isSubmitting}
          onChange={handleChange}
        />
        <AuthField
          id="reset-password"
          name="password"
          label="Nueva contraseña"
          type="password"
          value={values.password}
          placeholder="••••••••"
          autoComplete="new-password"
          hint={PASSWORD_HINT}
          error={fieldErrors.password}
          disabled={isSubmitting}
          onChange={handleChange}
        />
        <AuthField
          id="reset-password-confirm"
          name="confirmPassword"
          label="Confirmar contraseña"
          type="password"
          value={values.confirmPassword}
          placeholder="••••••••"
          autoComplete="new-password"
          error={fieldErrors.confirmPassword}
          disabled={isSubmitting}
          onChange={handleChange}
        />

        <button type="submit" className="auth-submit" disabled={isSubmitting}>
          {isSubmitting ? 'Cambiando contraseña...' : 'Cambiar contraseña'}
        </button>
      </form>

      <div className="auth-footer">
        <Link to="/login">← Volver al inicio de sesión</Link>
      </div>
    </AuthCard>
  )
}
