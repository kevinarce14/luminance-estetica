import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { LoginRequiredModal } from '../components/common/LoginRequiredModal.tsx'
import { LogoutModal } from '../components/common/LogoutModal.tsx'
import { buildWhatsappUrl, WHATSAPP_MESSAGES } from '../constants/contact.ts'
import { useAuth } from '../context/AuthContext.tsx'
import { useReserveService } from '../hooks/useReserveService.ts'
import type { MainLayoutOutletContext } from '../types/navigation.ts'
import './MainLayout.css'

const SCROLL_SHADOW_THRESHOLD = 100

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  isActive ? 'site-nav__link site-nav__link--active' : 'site-nav__link'

const mobileLinkClass = ({ isActive }: { isActive: boolean }): string =>
  isActive
    ? 'site-mobile-nav__link site-mobile-nav__link--active'
    : 'site-mobile-nav__link'

export function MainLayout() {
  const { isAuthenticated, isAdmin, user, logout } = useAuth()
  const { reserveService, isLoginModalOpen, closeLoginModal } =
    useReserveService()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [subnavContainer, setSubnavContainer] = useState<HTMLDivElement | null>(
    null,
  )

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > SCROLL_SHADOW_THRESHOLD)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMenuOpen])

  const closeMenu = () => setIsMenuOpen(false)

  const handleReserve = () => {
    closeMenu()
    reserveService()
  }

  const requestLogout = () => {
    closeMenu()
    setIsLogoutModalOpen(true)
  }

  const confirmLogout = () => {
    logout()
    setIsLogoutModalOpen(false)
  }

  const greeting = `Hola, ${user?.full_name ?? 'Usuario'}`
  const outletContext: MainLayoutOutletContext = { subnavContainer }

  return (
    <div className="app-shell">
      <header
        className={
          isScrolled ? 'site-header site-header--scrolled' : 'site-header'
        }
      >
        <div className="site-header__bar">
          <Link to="/" className="site-logo" aria-label="Luminance - Inicio">
            <span className="site-logo__text">
              Luminance<span className="site-logo__dot">.</span>
            </span>
            <span className="site-logo__subtitle">
              by Cande | Estética Profesional
            </span>
          </Link>

          <nav className="site-nav" aria-label="Principal">
            <ul className="site-nav__links">
              <li>
                <NavLink to="/studio" className={navLinkClass}>
                  Studio
                </NavLink>
              </li>
              <li>
                <button
                  type="button"
                  className="btn btn-rosa site-nav__cta"
                  onClick={handleReserve}
                >
                  <i className="fas fa-calendar-check" aria-hidden="true" />
                  Reservar Turno
                </button>
              </li>
              {isAuthenticated ? (
                <li>
                  <Link to="/mis-turnos" className="btn btn-violeta site-nav__cta">
                    <i className="fas fa-calendar-alt" aria-hidden="true" />
                    Mis Turnos
                  </Link>
                </li>
              ) : null}
            </ul>

            <div className="site-auth">
              {isAuthenticated ? (
                <>
                  <span className="site-auth__greeting">{greeting}</span>
                  <button
                    type="button"
                    className="site-auth__logout"
                    onClick={requestLogout}
                  >
                    🚪 Salir
                  </button>
                  {isAdmin ? (
                    <Link to="/admin" className="site-auth__admin">
                      <i className="fas fa-user-shield" aria-hidden="true" />
                      Admin
                    </Link>
                  ) : null}
                </>
              ) : (
                <Link to="/login" className="site-auth__login">
                  👤 Iniciar Sesión
                </Link>
              )}
            </div>
          </nav>

          <button
            type="button"
            className="site-menu-toggle"
            aria-label="Abrir menú"
            aria-expanded={isMenuOpen}
            aria-controls="site-mobile-menu"
            onClick={() => setIsMenuOpen(true)}
          >
            <i className="fas fa-bars" aria-hidden="true" />
          </button>
        </div>

        {/* Slot para la sub-navegación propia de cada página (ver StudioPage). */}
        <div ref={setSubnavContainer} className="site-header__subnav" />
      </header>

      <div
        className={
          isMenuOpen ? 'site-overlay site-overlay--active' : 'site-overlay'
        }
        onClick={closeMenu}
        aria-hidden="true"
      />
      <aside
        id="site-mobile-menu"
        className={
          isMenuOpen
            ? 'site-mobile-menu site-mobile-menu--active'
            : 'site-mobile-menu'
        }
        aria-label="Menú"
        inert={!isMenuOpen}
      >
        <div className="site-mobile-menu__header">
          <div>
            <span className="site-logo__text">
              Luminance<span className="site-logo__dot">.</span>
            </span>
            <span className="site-logo__subtitle">by Cande</span>
          </div>
          <button
            type="button"
            className="site-mobile-menu__close"
            aria-label="Cerrar menú"
            onClick={closeMenu}
          >
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        </div>

        <div className="site-mobile-auth">
          {isAuthenticated ? (
            <>
              <div className="site-mobile-auth__user">
                <div className="site-mobile-auth__row">
                  <p className="site-mobile-auth__name">{greeting}</p>
                  <button
                    type="button"
                    className="site-mobile-auth__logout"
                    onClick={requestLogout}
                  >
                    Salir
                  </button>
                </div>
                <p className="site-mobile-auth__email">{user?.email ?? ''}</p>
              </div>
              {isAdmin ? (
                <Link
                  to="/admin"
                  className="site-mobile-auth__link site-mobile-auth__link--admin"
                  onClick={closeMenu}
                >
                  <i className="fas fa-user-shield" aria-hidden="true" /> Panel
                  Admin
                </Link>
              ) : null}
              <Link
                to="/mis-turnos"
                className="site-mobile-auth__link site-mobile-auth__link--turnos"
                onClick={closeMenu}
              >
                <i className="fas fa-calendar-check" aria-hidden="true" /> Mis
                Turnos
              </Link>
              <button
                type="button"
                className="site-mobile-auth__link site-mobile-auth__link--reservar"
                onClick={handleReserve}
              >
                <i className="fas fa-calendar-plus" aria-hidden="true" />{' '}
                Reservar Turno
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="btn btn-rosa site-mobile-auth__login"
              onClick={closeMenu}
            >
              <i className="fas fa-sign-in-alt" aria-hidden="true" /> Iniciar
              sesión
            </Link>
          )}
        </div>

        <ul className="site-mobile-nav">
          <li>
            <NavLink to="/" end className={mobileLinkClass} onClick={closeMenu}>
              Inicio
            </NavLink>
          </li>
          <li>
            <NavLink to="/studio" className={mobileLinkClass} onClick={closeMenu}>
              Studio
            </NavLink>
          </li>
        </ul>

        <a
          href={buildWhatsappUrl(WHATSAPP_MESSAGES.general)}
          className="btn btn-rosa site-mobile-menu__whatsapp"
          target="_blank"
          rel="noreferrer"
        >
          <i className="fab fa-whatsapp" aria-hidden="true" /> WhatsApp Directo
        </a>
      </aside>

      <main className="site-main">
        <Outlet context={outletContext} />
      </main>

      <LogoutModal
        open={isLogoutModalOpen}
        onCancel={() => setIsLogoutModalOpen(false)}
        onConfirm={confirmLogout}
      />
      <LoginRequiredModal open={isLoginModalOpen} onClose={closeLoginModal} />
    </div>
  )
}
