import type {
  FieldErrors,
  LoginCredentials,
  RegisterFormValues,
} from '../types/auth.ts'

// Límites alineados con app/schemas/user.py (UserCreate) del backend.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_NAME_LENGTH = 2
const MAX_NAME_LENGTH = 255
const MIN_PASSWORD_LENGTH = 8
const MAX_PASSWORD_LENGTH = 100
const MIN_PHONE_DIGITS = 8
const MAX_PHONE_LENGTH = 50

export const PASSWORD_HINT =
  'Mínimo 8 caracteres, con mayúscula, minúscula y número'

/** Reglas de contraseña del backend (`validatePassword` del legado). */
export function getPasswordIssues(password: string): string[] {
  const issues: string[] = []

  if (password.length < MIN_PASSWORD_LENGTH) {
    issues.push('mínimo 8 caracteres')
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    issues.push('máximo 100 caracteres')
  }
  if (!/[A-Z]/.test(password)) {
    issues.push('al menos una mayúscula')
  }
  if (!/[a-z]/.test(password)) {
    issues.push('al menos una minúscula')
  }
  if (!/[0-9]/.test(password)) {
    issues.push('al menos un número')
  }

  return issues
}

function validateEmail(email: string): string | undefined {
  const value = email.trim()
  if (!value) {
    return 'Ingresá tu email'
  }
  if (!EMAIL_PATTERN.test(value)) {
    return 'Ingresá un email válido'
  }
  return undefined
}

/** Mismo criterio que `validate_phone`: sin espacios/guiones/paréntesis, solo dígitos y +. */
function validatePhone(phone: string): string | undefined {
  if (phone.length > MAX_PHONE_LENGTH) {
    return 'El teléfono es demasiado largo'
  }

  const cleaned = phone.replace(/[\s()-]/g, '')
  if (!/^\+?\d+$/.test(cleaned)) {
    return 'El teléfono debe contener solo números'
  }
  if (cleaned.length < MIN_PHONE_DIGITS) {
    return 'El teléfono debe tener al menos 8 dígitos'
  }
  return undefined
}

export function validateLogin(values: LoginCredentials): FieldErrors<LoginCredentials> {
  const errors: FieldErrors<LoginCredentials> = {}

  const emailError = validateEmail(values.email)
  if (emailError) {
    errors.email = emailError
  }
  if (!values.password) {
    errors.password = 'Ingresá tu contraseña'
  }

  return errors
}

export function validateRegister(
  values: RegisterFormValues,
): FieldErrors<RegisterFormValues> {
  const errors: FieldErrors<RegisterFormValues> = {}

  const fullName = values.full_name.trim()
  if (fullName.length < MIN_NAME_LENGTH) {
    errors.full_name = 'El nombre debe tener al menos 2 caracteres'
  } else if (fullName.length > MAX_NAME_LENGTH) {
    errors.full_name = 'El nombre es demasiado largo'
  }

  const emailError = validateEmail(values.email)
  if (emailError) {
    errors.email = emailError
  }

  const phone = values.phone.trim()
  const phoneError = phone ? validatePhone(phone) : undefined
  if (phoneError) {
    errors.phone = phoneError
  }

  const passwordIssues = getPasswordIssues(values.password)
  if (passwordIssues.length > 0) {
    errors.password = `La contraseña debe tener: ${passwordIssues.join(', ')}`
  }

  return errors
}

export function hasFieldErrors<T>(errors: FieldErrors<T>): boolean {
  return Object.values(errors).some(Boolean)
}
