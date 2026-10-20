import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test'
import { addDays, formatStudioLongDate, getStudioToday, getWeekday } from '../src/utils/studioTime.ts'

/** Backend de E2E (tests/e2e_server.py), el mismo que levanta playwright.config.ts. */
export const API_URL = 'http://127.0.0.1:8800'
export const ADMIN = { email: 'admin@example.com', password: 'Admin1234' }
export const MP_CHECKOUT = 'https://mercadopago.test/checkout'

export interface TestUser {
  id: number
  email: string
  password: string
  fullName: string
  phone: string
  token: string
}

/** Próximo día con atención (no domingo), a partir de mañana en hora del studio. */
export function bookingDate(): string {
  let day = addDays(getStudioToday(), 1)
  while (getWeekday(day) === 0) {
    day = addDays(day, 1)
  }
  return day
}

export function longDate(day: string): string {
  return formatStudioLongDate(day)
}

let sequence = 0
export function uniqueEmail(prefix: string): string {
  sequence += 1
  return `${prefix}.${Date.now()}${sequence}@example.com`
}

/**
 * Fixture base: falla el test si el navegador registra errores de consola o si el
 * backend responde 5xx. Los 4xx esperados (login inválido, validaciones) no cuentan.
 * También bloquea las llamadas a Google para que la suite no dependa de internet.
 */
export const test = base.extend<{ guard: void }>({
  guard: [
    async ({ page }, use) => {
      // Suite hermética: nunca se carga el Google Identity Services real (stubGoogle lo simula).
      await page.route('https://accounts.google.com/**', (route) => route.abort())
      // GIS inerte por defecto; stubGoogle lo reemplaza con un botón funcional.
      await page.addInitScript(() => {
        window.google ??= {
          accounts: { id: { initialize: () => {}, renderButton: () => {}, disableAutoSelect: () => {} } },
        }
      })
      const problems: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
          problems.push(`consola: ${message.text()}`)
        }
      })
      page.on('pageerror', (error) => problems.push(`excepción: ${error.message}`))
      page.on('response', (response) => {
        if (response.status() >= 500) {
          problems.push(`HTTP ${response.status()} ${response.request().method()} ${response.url()}`)
        }
      })
      await use()
      expect(problems, 'sin errores en el navegador ni respuestas 5xx').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

// ---------------------------------------------------------------------------
// Helpers de API (preparan datos sin pasar por la UI)
// ---------------------------------------------------------------------------

export async function apiLogin(request: APIRequestContext, email: string, password: string): Promise<string> {
  const response = await request.post(`${API_URL}/api/auth/login`, { form: { username: email, password } })
  expect(response.status(), await response.text()).toBe(200)
  return (await response.json()).access_token as string
}

export async function registerClient(
  request: APIRequestContext,
  overrides: Partial<Pick<TestUser, 'fullName' | 'phone' | 'password'>> = {},
): Promise<TestUser> {
  const user = {
    email: uniqueEmail('cliente'),
    password: overrides.password ?? 'Clave1234',
    fullName: overrides.fullName ?? 'Lucía Prueba',
    phone: overrides.phone ?? '11 4444-7788',
  }
  const response = await request.post(`${API_URL}/api/auth/register`, {
    data: { email: user.email, full_name: user.fullName, phone: user.phone, password: user.password },
  })
  expect(response.status(), await response.text()).toBe(201)
  const { id } = (await response.json()) as { id: number }
  return { ...user, id, token: await apiLogin(request, user.email, user.password) }
}

export function bearer(token: string) {
  return { Authorization: `Bearer ${token}` }
}

export async function book(
  request: APIRequestContext,
  token: string,
  { serviceId, time }: { serviceId: number; time: string },
): Promise<{ id: number }> {
  const response = await request.post(`${API_URL}/api/appointments/`, {
    headers: bearer(token),
    data: { service_id: serviceId, appointment_date: `${bookingDate()}T${time}:00-03:00` },
  })
  expect(response.status(), await response.text()).toBe(201)
  return (await response.json()) as { id: number }
}

export async function moveToPast(request: APIRequestContext, appointmentId: number): Promise<void> {
  const response = await request.post(`${API_URL}/__e2e__/appointments/${appointmentId}/move-to-past`)
  expect(response.ok()).toBe(true)
}

export async function createPreference(request: APIRequestContext, token: string, appointmentId: number): Promise<void> {
  const response = await request.post(`${API_URL}/api/payments/create-preference`, {
    headers: bearer(token),
    data: { appointment_id: appointmentId, amount: 10000, currency: 'ARS', payment_method: 'mercadopago' },
  })
  expect(response.status(), await response.text()).toBe(200)
}

/** Sesión iniciada sin pasar por el formulario (para tests que no prueban el login). */
export async function signIn(page: Page, request: APIRequestContext, email: string, password: string): Promise<void> {
  const token = await apiLogin(request, email, password)
  const me = await request.get(`${API_URL}/api/users/me`, { headers: bearer(token) })
  const user = await me.json()
  await page.addInitScript(
    ([storedToken, storedUser]) => {
      window.localStorage.setItem('auth_token', storedToken)
      window.localStorage.setItem('user_data', storedUser)
    },
    [token, JSON.stringify(user)] as const,
  )
}

/** Simula Google Identity Services: el botón devuelve un credential que el backend de E2E acepta. */
export async function stubGoogle(page: Page, email: string, name: string): Promise<void> {
  await page.addInitScript(
    ([credential]) => {
      let callback: ((response: { credential: string }) => void) | null = null
      window.google = {
        accounts: {
          id: {
            initialize: (config) => {
              callback = config.callback
            },
            renderButton: (parent) => {
              const button = document.createElement('button')
              button.type = 'button'
              button.textContent = 'Continuar con Google'
              button.addEventListener('click', () => callback?.({ credential }))
              parent.appendChild(button)
            },
            disableAutoSelect: () => {},
          },
        },
      }
    },
    [`google:${email}:${name}`] as const,
  )
}

/** Saludo del header (el menú móvil oculto repite el texto). */
export function headerGreeting(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Principal' }).getByText(`Hola, ${name}`)
}
