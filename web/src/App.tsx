import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminRoute } from './components/common/AdminRoute.tsx'
import { GuestRoute } from './components/common/GuestRoute.tsx'
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
            <Route path="/turnera" element={<TurneraPage />} />
            <Route
              path="/mis-turnos"
              element={
                <ProtectedRoute>
                  <MisTurnosPage />
                </ProtectedRoute>
              }
            />
            <Route path="/pago" element={<PagoPage />} />
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
            <Route path="/index.html" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
