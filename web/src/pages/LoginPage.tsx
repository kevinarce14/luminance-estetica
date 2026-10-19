import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { AuthCard } from '../components/auth/AuthCard.tsx'
import { AuthField } from '../components/auth/AuthField.tsx'
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton.tsx'
import { useAuth } from '../hooks/useAuth.ts'
import type { FieldErrors, LoginCredentials } from '../types/auth.ts'
import type {
  AuthRedirectState,
  LoginLocationState,
  PasswordResetLocationState,
} from '../types/navigation.ts'
import { getGoogleLoginErrorMessage, getLoginErrorMessage } from '../utils/authErrors.ts'
import { hasFieldErrors, validateLogin } from '../utils/validators.ts'

export function LoginPage() {
  const { login, loginWithGoogle } = useAuth()
  const location = useLocation()
  const locationState = location.state as LoginLocationState | null
  const [searchParams] = useSearchParams()
  // Link del email de recuperación (login.html?token=… del backend)
  const resetToken = searchParams.get('token')

  const [values, setValues] = useState<LoginCredentials>({
    email: locationState?.email ?? '',
    password: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<LoginCredentials>>(
    {},
  )
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as keyof LoginCredentials
    const { value } = event.target
    setValues((previous) => ({ ...previous, [field]: value }))
    setFieldErrors((previous) => ({ ...previous, [field]: undefined }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    const errors = validateLogin(values)
    setFieldErrors(errors)
    if (hasFieldErrors(errors)) {
      return
    }

    setIsSubmitting(true)
    try {
      await login({ email: values.email.trim(), password: values.password })
      // La redirección la resuelve GuestRoute al cambiar el estado de sesión.
    } catch (error) {
      setSubmitError(getLoginErrorMessage(error))
      setIsSubmitting(false)
    }
  }

  const handleGoogleCredential = async (credential: string) => {
    setSubmitError(null)
    setIsSubmitting(true)
    try {
      await loginWithGoogle(credential)
    } catch (error) {
      setSubmitError(getGoogleLoginErrorMessage(error))
      setIsSubmitting(false)
    }
  }

  const registerState: AuthRedirectState = { from: locationState?.from }
  const forgotState: PasswordResetLocationState = { email: values.email.trim() || undefined }

  if (resetToken) {
    const resetState: PasswordResetLocationState = { token: resetToken }
    return <Navigate to="/reset-password" replace state={resetState} />
  }

  return (
    <AuthCard title="Bienvenida" subtitle="Ingresa a tu cuenta">
      {locationState?.notice && !submitError ? (
        <div className="auth-alert auth-alert--success" role="status">
          {locationState.notice}
        </div>
      ) : null}
      {submitError ? (
        <div className="auth-alert auth-alert--error" role="alert">
          {submitError}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <AuthField
          id="login-email"
          name="email"
          label="Email"
          type="email"
          value={values.email}
          placeholder="tu@email.com"
          autoComplete="email"
          error={fieldErrors.email}
          disabled={isSubmitting}
          onChange={handleChange}
        />
        <AuthField
          id="login-password"
          name="password"
          label="Contraseña"
          type="password"
          value={values.password}
          placeholder="••••••••"
          autoComplete="current-password"
          error={fieldErrors.password}
          disabled={isSubmitting}
          onChange={handleChange}
        />

        <button type="submit" className="auth-submit" disabled={isSubmitting}>
          {isSubmitting ? 'Iniciando sesión...' : 'Iniciar Sesión'}
        </button>
      </form>

      <div className="auth-footer auth-footer--forgot">
        <Link to="/forgot-password" state={forgotState}>
          ¿Olvidaste tu contraseña?
        </Link>
      </div>

      <GoogleSignInButton
        text="continue_with"
        dividerLabel="o continuá con"
        disabled={isSubmitting}
        onCredential={(credential) => void handleGoogleCredential(credential)}
      />

      <div className="auth-footer">
        ¿No tienes cuenta?{' '}
        <Link to="/register" state={registerState}>
          Regístrate aquí
        </Link>
      </div>
    </AuthCard>
  )
}
