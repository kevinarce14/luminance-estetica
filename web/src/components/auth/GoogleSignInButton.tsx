import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useAsyncResource } from '../../hooks/useAsyncResource.ts'
import { getGoogleAuthConfig } from '../../services/authApi.ts'

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
const BUTTON_WIDTH = 320

let googleScriptPromise: Promise<void> | null = null

/** Carga Google Identity Services una sola vez por página. */
function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id) {
    return Promise.resolve()
  }
  googleScriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GOOGLE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => {
      googleScriptPromise = null
      reject(new Error('No se pudo cargar Google Identity Services'))
    }
    document.head.appendChild(script)
  })
  return googleScriptPromise
}

interface GoogleSignInButtonProps {
  /** Texto del botón oficial de Google. */
  text: 'continue_with' | 'signup_with'
  dividerLabel: string
  disabled?: boolean
  onCredential: (credential: string) => void
}

/**
 * Botón oficial "Continuar con Google". Solo se muestra si el backend tiene
 * GOOGLE_CLIENT_ID configurado (GET /auth/google/config).
 */
export function GoogleSignInButton({
  text,
  dividerLabel,
  disabled = false,
  onCredential,
}: GoogleSignInButtonProps) {
  const config = useAsyncResource('google-auth-config', getGoogleAuthConfig)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scriptFailed, setScriptFailed] = useState(false)
  const handleCredential = useEffectEvent(onCredential)
  const clientId = config.data?.enabled ? config.data.client_id : null

  useEffect(() => {
    if (!clientId) {
      return
    }

    let cancelled = false
    loadGoogleScript()
      .then(() => {
        const container = containerRef.current
        const googleId = window.google?.accounts.id
        if (cancelled || !container || !googleId) {
          return
        }
        googleId.initialize({
          client_id: clientId,
          callback: (response) => handleCredential(response.credential),
          cancel_on_tap_outside: true,
        })
        container.replaceChildren()
        googleId.renderButton(container, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'pill',
          logo_alignment: 'left',
          width: BUTTON_WIDTH,
          locale: 'es',
        })
      })
      .catch(() => {
        if (!cancelled) {
          setScriptFailed(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [clientId, text])

  if (!clientId) {
    return null
  }

  return (
    <div className="auth-google">
      <div className="auth-divider">{dividerLabel}</div>
      {scriptFailed ? (
        <p className="auth-google__error" role="alert">
          No se pudo cargar el inicio de sesión con Google. Recargá la página.
        </p>
      ) : (
        <div
          ref={containerRef}
          className={disabled ? 'auth-google__button auth-google__button--disabled' : 'auth-google__button'}
          aria-disabled={disabled || undefined}
        />
      )}
    </div>
  )
}
