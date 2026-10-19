import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.ts'
import { formatStudioLongDate, getStudioToday } from '../utils/studioTime.ts'
import '../pages/AdminDashboardPage.css'

interface AdminSection {
  to: string
  label: string
  icon: string
  end?: boolean
}

/** Secciones del panel (mismas que el menú lateral de admin-dashboard.html). */
const ADMIN_SECTIONS: AdminSection[] = [
  { to: '/admin', label: 'Agenda', icon: 'fas fa-chart-line', end: true },
  { to: '/admin/servicios', label: 'Servicios', icon: 'fas fa-spa' },
  { to: '/admin/pagos', label: 'Pagos', icon: 'fas fa-dollar-sign' },
  { to: '/admin/clientes', label: 'Clientes', icon: 'fas fa-users' },
  { to: '/admin/disponibilidad', label: 'Disponibilidad', icon: 'fas fa-clock' },
  { to: '/admin/reportes', label: 'Reportes', icon: 'fas fa-file-alt' },
]

const sectionClass = ({ isActive }: { isActive: boolean }): string =>
  isActive ? 'admin-nav__link admin-nav__link--active' : 'admin-nav__link'

export function AdminLayout() {
  const { user } = useAuth()

  return (
    <div className="admin-page">
      <div className="admin-container">
        <div className="admin-topbar">
          <div>
            <h1>Bienvenida, {user?.full_name ?? 'Admin'} 👋</h1>
            <p>{formatStudioLongDate(getStudioToday())}</p>
          </div>
          <Link to="/turnera" className="btn btn-rosa">
            <i className="fas fa-plus" aria-hidden="true" /> Registrar turno presencial
          </Link>
        </div>

        <nav className="admin-nav" aria-label="Secciones del panel">
          {ADMIN_SECTIONS.map((section) => (
            <NavLink key={section.to} to={section.to} end={section.end} className={sectionClass}>
              <i className={section.icon} aria-hidden="true" /> {section.label}
            </NavLink>
          ))}
        </nav>

        <Outlet />
      </div>
    </div>
  )
}
