import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthCard } from '../components/auth/AuthCard.tsx'
import { AuthField } from '../components/auth/AuthField.tsx'
import { useAuth } from '../context/AuthContext.tsx'
import type {
  FieldErrors,
  RegisterFormValues,
  RegisterPayload,
} from '../types/auth.ts'
import type {
  AuthRedirectState,
  LoginLocationState,
} from '../types/navigation.ts'
import { getRegisterErrorMessage } from '../utils/authErrors.ts'
import {
  hasFieldErrors,
  PASSWORD_HINT,
  validateRegister,
} from '../utils/validators.ts'

type RegisterStatus = 'idle' | 'registering' | 'logging-in'

const INITIAL_VALUES: RegisterFormValues = {
  full_name: '',
  email: '',
  phone: '',
  password: '',
}

const SUBMIT_LABELS: Record<RegisterStatus, string> = {
  idle: 'Registrarse',
  registering: 'Registrando...',
  'logging-in': 'Iniciando sesión...',
}

export function RegisterPage() {
  const { register, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectState = location.state as AuthRedirectState | null

  const [values, setValues] = useState<RegisterFormValues>(INITIAL_VALUES)
  const [fieldErrors, setFieldErrors] = useState<
    FieldErrors<RegisterFormValues>
  >({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [status, setStatus] = useState<RegisterStatus>('idle')
  const isSubmitting = status !== 'idle'

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as keyof RegisterFormValues
    const { value } = event.target
    setValues((previous) => ({ ...previous, [field]: value }))
    setFieldErrors((previous) => ({ ...previous, [field]: undefined }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError(null)

    const errors = validateRegister(values)
    setFieldErrors(errors)
    if (hasFieldErrors(errors)) {
      return
    }

    const payload: RegisterPayload = {
      full_name: values.full_name.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      password: values.password,
    }

    setStatus('registering')
    try {
      await register(payload)
    } catch (error) {
      setSubmitError(getRegisterErrorMessage(error))
      setStatus('idle')
      return
    }

    // Auto-login tras el registro (igual que el legado). Si funciona, GuestRoute redirige.
    setStatus('logging-in')
    try {
      await login({ email: payload.email, password: payload.password })
    } catch {
      const loginState: LoginLocationState = {
        from: redirectState?.from,
        email: payload.email,
        notice: '¡Tu cuenta fue creada! Iniciá sesión para continuar.',
      }
      navigate('/login', { replace: true, state: loginState })
    }
  }

  const loginState: AuthRedirectState = { from: redirectState?.from }

  return (
    <AuthCard title="Crear Cuenta" subtitle="Únete a Luminance Studio">
      {submitError ? (
        <div className="auth-alert auth-alert--error" role="alert">
          {submitError}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <AuthField
          id="register-name"
          name="full_name"
          label="Nombre Completo"
          type="text"
          value={values.full_name}
          placeholder="María García"
          autoComplete="name"
          error={fieldErrors.full_name}
          disabled={isSubmitting}
          onChange={handleChange}
        />
        <AuthField
          id="register-email"
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
          id="register-phone"
          name="phone"
          label="Teléfono (opcional)"
          type="tel"
          value={values.phone}
          placeholder="+54 11 1234-5678"
          autoComplete="tel"
          error={fieldErrors.phone}
          disabled={isSubmitting}
          onChange={handleChange}
        />
        <AuthField
          id="register-password"
          name="password"
          label="Contraseña"
          type="password"
          value={values.password}
          placeholder="••••••••"
          autoComplete="new-password"
          hint={PASSWORD_HINT}
          error={fieldErrors.password}
          disabled={isSubmitting}
          onChange={handleChange}
        />

        <button type="submit" className="auth-submit" disabled={isSubmitting}>
          {SUBMIT_LABELS[status]}
        </button>
      </form>

      <div className="auth-footer">
        ¿Ya tienes cuenta?{' '}
        <Link to="/login" state={loginState}>
          Inicia sesión aquí
        </Link>
      </div>
    </AuthCard>
  )
}
