import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AuthCard } from '../components/auth/AuthCard.tsx'
import { AuthField } from '../components/auth/AuthField.tsx'
import { requestPasswordReset } from '../services/authApi.ts'
import { isApiError } from '../types/api.ts'
import type { PasswordResetLocationState } from '../types/navigation.ts'
import { validateEmail } from '../utils/validators.ts'

/** Paso 1 de "Recuperar contraseña" (login.html): pedir el código por email. */
export function ForgotPasswordPage() {
  const location = useLocation()
  const locationState = location.state as PasswordResetLocationState | null

  const [email, setEmail] = useState(locationState?.email ?? '')
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)
    const error = validateEmail(email)
    setFieldError(error)
    if (error) {
      return
    }

    setIsSubmitting(true)
    try {
      await requestPasswordReset(email.trim())
      setSentTo(email.trim())
    } catch (requestError) {
      setSubmitError(
        isApiError(requestError) ? requestError.message : 'Error al enviar. Intentá de nuevo.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetState: PasswordResetLocationState = { email: sentTo ?? email.trim() }

  return (
    <AuthCard title="Recuperar" subtitle="Te enviaremos un código para restablecer tu contraseña">
      {sentTo ? (
        <>
          <div className="auth-alert auth-alert--success" role="status">
            ✅ Si existe una cuenta con <strong>{sentTo}</strong>, vas a recibir las
            instrucciones en unos minutos. Revisá también la carpeta de spam. El código vence en
            1 hora.
          </div>
          <Link to="/reset-password" state={resetState} className="auth-submit auth-submit--link">
            Ya tengo el código
          </Link>
          <button
            type="button"
            className="auth-text-button"
            onClick={() => setSentTo(null)}
          >
            Enviar a otro email
          </button>
        </>
      ) : (
        <>
          {submitError ? (
            <div className="auth-alert auth-alert--error" role="alert">
              {submitError}
            </div>
          ) : null}
          <form onSubmit={(event) => void handleSubmit(event)} noValidate>
            <AuthField
              id="forgot-email"
              name="email"
              label="Email de tu cuenta"
              type="email"
              value={email}
              placeholder="tu@email.com"
              autoComplete="email"
              error={fieldError}
              disabled={isSubmitting}
              onChange={(event) => {
                setEmail(event.target.value)
                setFieldError(undefined)
              }}
            />
            <button type="submit" className="auth-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando...' : 'Enviar instrucciones'}
            </button>
          </form>
        </>
      )}

      <div className="auth-footer">
        <Link to="/login" state={{ email: email.trim() || undefined }}>
          ← Volver al inicio de sesión
        </Link>
      </div>
    </AuthCard>
  )
}
