import { Link, Navigate } from 'react-router-dom'
import {
  DEMO_DISCLAIMER,
  WHATSAPP_DISPLAY_SHORT,
} from '../constants/contact.ts'
import { useAuth } from '../hooks/useAuth.ts'
import './Home.css'

const whatsappUrl =
  'https://wa.me/5491130601712?text=Hola%20Cande!%20Vi%20tu%20página%20de%20bienvenida%20y%20quisiera%20consultarte...'

export function Home() {
  const { isAuthenticated } = useAuth()

  // Igual que index.html del legado: con sesión iniciada se va directo al Studio.
  if (isAuthenticated) {
    return <Navigate to="/studio" replace />
  }

  return (
    <main className="home-page">
      <div className="home-background" aria-hidden="true">
        <span className="home-background__shape home-background__shape--one" />
        <span className="home-background__shape home-background__shape--two" />
        <span className="home-background__shape home-background__shape--three" />
      </div>

      <Link to="/login" className="home-login" aria-label="Iniciar sesión">
        <i className="fas fa-user" aria-hidden="true" />
        <span>Iniciar Sesión</span>
      </Link>

      <header className="home-header">
        <div className="home-logo">
          <span className="home-logo__glow" aria-hidden="true" />
          <span className="home-logo__text">
            Luminance<span className="home-logo__dot">.</span>
          </span>
        </div>
        <p className="home-subtitle">by Cande | Estética Profesional</p>
        <div className="home-tagline">
          <h1>Belleza Natural, Resultados Extraordinarios</h1>
          <p>
            5 años de experiencia especializada en pestañas, cejas y
            tratamientos estéticos de vanguardia
          </p>
        </div>
      </header>

      <section className="home-options" aria-label="Elegí cómo continuar">
        <div className="home-options__grid">
          <article className="home-option-card">
            <div className="home-option-card__icon">
              <i className="fas fa-spa" aria-hidden="true" />
            </div>
            <div className="home-option-card__content">
              <h2>Conocé Mi Trabajo</h2>
              <p>
                Explorá mi portafolio completo de servicios profesionales,
                desde <strong>lifting de pestañas</strong> hasta tratamientos
                corporales con la más avanzada aparatología.
              </p>
              <p>
                Descubrí testimonios reales de clientas, información detallada
                sobre mis cursos de formación y mi trayectoria profesional de
                5 años en el sector de la estética.
              </p>
            </div>
            <Link to="/studio" className="home-option-button home-option-button--pink">
              <i className="fas fa-home" aria-hidden="true" />
              <span>Ingresar al Sitio Principal</span>
            </Link>
          </article>

          <article className="home-option-card">
            <div className="home-option-card__icon">
              <i className="fas fa-calendar-alt" aria-hidden="true" />
            </div>
            <div className="home-option-card__content">
              <h2>Reservá Tu Turno</h2>
              <p>
                Agendá tu cita online de forma rápida y segura. Elegí el
                servicio, fecha y horario que mejor se adapte a tus necesidades.
              </p>
              <p>
                Beneficios exclusivos:{' '}
                <strong>disponibilidad en tiempo real</strong>, recordatorios
                automáticos, confirmación inmediata y seguimiento personalizado
                de tu reserva.
              </p>
            </div>
            <Link
              to="/turnera"
              className="home-option-button home-option-button--lilac"
            >
              <i className="fas fa-calendar-check" aria-hidden="true" />
              <span>Reservar Turno Online</span>
            </Link>
          </article>
        </div>
      </section>

      <section className="home-info" aria-label="Sobre Luminance Studio">
        <div className="home-info__grid">
          <article className="home-info-card">
            <div className="home-info-card__icon">
              <i className="fas fa-award" aria-hidden="true" />
            </div>
            <div>
              <h2>5 Años de Experiencia</h2>
              <p>
                Especialista certificada en técnicas de vanguardia con
                formación continua
              </p>
            </div>
          </article>
          <article className="home-info-card">
            <div className="home-info-card__icon">
              <i className="fas fa-graduation-cap" aria-hidden="true" />
            </div>
            <div>
              <h2>Formación Continua</h2>
              <p>
                Actualmente cursando la Tecnicatura en Cosmetología para
                brindar los mejores tratamientos
              </p>
            </div>
          </article>
          <article className="home-info-card">
            <div className="home-info-card__icon">
              <i className="fas fa-heart" aria-hidden="true" />
            </div>
            <div>
              <h2>Pasión por la Belleza</h2>
              <p>
                Cada tratamiento es realizado con dedicación y atención al
                detalle
              </p>
            </div>
          </article>
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-footer__content">
          <p>© 2024 Luminance Studio by Cande. Todos los derechos reservados.</p>
          <p className="home-footer__disclaimer">{DEMO_DISCLAIMER}</p>
          <p>
            Especialista en belleza natural con{' '}
            <strong>resultados profesionales garantizados</strong>
          </p>
          <p>
            WhatsApp: <strong>{WHATSAPP_DISPLAY_SHORT}</strong>
          </p>
          <nav className="home-social-links" aria-label="Redes sociales">
            <a
              href="#"
              className="home-social-link"
              aria-label="Instagram"
              target="_blank"
              rel="noreferrer"
            >
              <i className="fab fa-instagram" aria-hidden="true" />
            </a>
            <a
              href="#"
              className="home-social-link"
              aria-label="Facebook"
              target="_blank"
              rel="noreferrer"
            >
              <i className="fab fa-facebook-f" aria-hidden="true" />
            </a>
            <a
              href="#"
              className="home-social-link"
              aria-label="TikTok"
              target="_blank"
              rel="noreferrer"
            >
              <i className="fab fa-tiktok" aria-hidden="true" />
            </a>
          </nav>
        </div>
      </footer>

      <a
        href={whatsappUrl}
        className="home-whatsapp"
        target="_blank"
        rel="noreferrer"
        aria-label="Contactar a Cande por WhatsApp"
      >
        <span className="home-whatsapp__pulse" aria-hidden="true" />
        <i className="fab fa-whatsapp" aria-hidden="true" />
      </a>
    </main>
  )
}
