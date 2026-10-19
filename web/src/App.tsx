import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminRoute } from './components/common/AdminRoute.tsx'
import { GuestRoute } from './components/common/GuestRoute.tsx'
import { LegacyRedirect } from './components/common/LegacyRedirect.tsx'
import { ProtectedRoute } from './components/common/ProtectedRoute.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { MainLayout } from './layouts/MainLayout.tsx'
import { AdminDashboardPage } from './pages/AdminDashboardPage.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { Home } from './pages/Home.tsx'
import { MisTurnosPage } from './pages/MisTurnosPage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { PagoExitosoPage } from './pages/PagoExitosoPage.tsx'
import { PagoFallidoPage } from './pages/PagoFallidoPage.tsx'
import { PagoPage } from './pages/PagoPage.tsx'
import { RegisterPage } from './pages/RegisterPage.tsx'
import { StudioPage } from './pages/StudioPage.tsx'
import { TurneraPage } from './pages/TurneraPage.tsx'

/** URLs del frontend legado que siguen llegando (back_urls de MercadoPago, links viejos). */
const LEGACY_ROUTES: { path: string; to: string }[] = [
  { path: '/studio.html', to: '/studio' },
  { path: '/login.html', to: '/login' },
  { path: '/turnera.html', to: '/turnera' },
  { path: '/mis-turnos.html', to: '/mis-turnos' },
  { path: '/pago.html', to: '/pago' },
  { path: '/pago-exitoso.html', to: '/pago/exitoso' },
  { path: '/pago-fallido.html', to: '/pago/fallido' },
  { path: '/admin-dashboard.html', to: '/admin' },
]

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/index.html" element={<Navigate to="/" replace />} />
          {LEGACY_ROUTES.map(({ path, to }) => (
            <Route key={path} path={path} element={<LegacyRedirect to={to} />} />
          ))}
          <Route
            path="/login"
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />
          <Route
            path="/register"
            element={
              <GuestRoute>
                <RegisterPage />
              </GuestRoute>
            }
          />
          <Route element={<MainLayout />}>
            <Route path="/studio" element={<StudioPage />} />
            <Route
              path="/turnera"
              element={
                <ProtectedRoute>
                  <TurneraPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/mis-turnos"
              element={
                <ProtectedRoute>
                  <MisTurnosPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pago"
              element={
                <ProtectedRoute>
                  <PagoPage />
                </ProtectedRoute>
              }
            />
            <Route path="/pago/exitoso" element={<PagoExitosoPage />} />
            <Route path="/pago/fallido" element={<PagoFallidoPage />} />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboardPage />
                </AdminRoute>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
