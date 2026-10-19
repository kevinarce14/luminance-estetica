import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import './Auth.css'

interface AuthCardProps {
  title: string
  subtitle: string
  children: ReactNode
}

/** Tarjeta de dos columnas de login.html: marca a la izquierda, formulario a la derecha. */
export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Link to="/" className="auth-brand__back">
            ← Volver al inicio
          </Link>
          <div className="auth-brand__content">
            <div className="auth-brand__logo">Luminance</div>
            <div className="auth-brand__tagline">STUDIO BY CANDE</div>
          </div>
        </div>

        <div className="auth-form-side">
          <h1>{title}</h1>
          <p className="auth-form-side__subtitle">{subtitle}</p>
          {children}
        </div>
      </div>
    </main>
  )
}
