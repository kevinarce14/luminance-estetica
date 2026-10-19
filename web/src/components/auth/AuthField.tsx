import type { ChangeEvent, HTMLInputAutoCompleteAttribute } from 'react'

interface AuthFieldProps {
  id: string
  name: string
  label: string
  type: 'text' | 'email' | 'tel' | 'password'
  value: string
  placeholder?: string
  autoComplete?: HTMLInputAutoCompleteAttribute
  hint?: string
  error?: string
  disabled?: boolean
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

export function AuthField({
  id,
  name,
  label,
  type,
  value,
  placeholder,
  autoComplete,
  hint,
  error,
  disabled,
  onChange,
}: AuthFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={onChange}
      />
      {error ? (
        <small id={errorId} className="auth-field__error">
          {error}
        </small>
      ) : null}
      {hint && !error ? (
        <small id={hintId} className="auth-field__hint">
          {hint}
        </small>
      ) : null}
    </div>
  )
}
