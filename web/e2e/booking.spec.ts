import {
  API_URL,
  MP_CHECKOUT,
  bearer,
  book,
  bookingDate,
  expect,
  longDate,
  registerClient,
  signIn,
  test,
} from './support.ts'

/** Combinaciones servicio/hora: Lifting (UI, primer horario libre) y servicio 2 a las 15:00/16:00. */
test.describe('Reservas', () => {
  test('turnera → pago con MercadoPago → retorno al sitio', async ({ page, request }) => {
    const user = await registerClient(request)
    await signIn(page, request, user.email, user.password)
    await page.route(`${MP_CHECKOUT}**`, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<h1>Checkout de Mercado Pago (simulado)</h1>' }),
    )

    await page.goto('/turnera')
    await expect(page.getByRole('region', { name: 'Paso 2: Seleccioná un Servicio' })).toHaveAttribute('aria-disabled', 'true')
    await page.getByRole('button', { name: new RegExp(`^${longDate(bookingDate())}`) }).click()
    await page.getByRole('radio', { name: /Lifting de Pestañas/ }).click()

    const firstSlot = page.locator('.booking-slot').first()
    await expect(firstSlot).toBeVisible()
    const slotLabel = (await firstSlot.textContent())?.trim() ?? ''
    await firstSlot.click()
    await expect(page.locator('.booking-summary')).toContainText('Lifting de Pestañas')
    await expect(page.locator('.booking-summary')).toContainText(slotLabel)

    await page.getByRole('button', { name: /Confirmar Reserva/ }).click()
    await expect(page).toHaveURL(/\/pago\?appointment_id=\d+/)
    const appointmentId = Number(new URL(page.url()).searchParams.get('appointment_id'))
    await expect(page.getByText('Pendiente de Pago').first()).toBeVisible()
    await expect(page.getByText(slotLabel)).toBeVisible()

    await page.getByRole('radio', { name: /Mercado Pago/ }).click()
    await page.getByRole('button', { name: /Confirmar Pago/ }).click()
    await expect(page.getByRole('heading', { name: /Checkout de Mercado Pago/ })).toBeVisible()

    // MercadoPago notifica el pago aprobado y redirige a la back_url del backend (URL del legado)
    const webhook = await request.post(`${API_URL}/api/payments/webhook`, {
      data: { type: 'payment', data: { id: `mp-${appointmentId}` } },
    })
    expect((await webhook.json()).status).toBe('ok')
    await page.goto(`/pago-exitoso.html?collection_status=approved&external_reference=${appointmentId}&collection_id=mp-${appointmentId}`)
    await expect(page).toHaveURL(/\/pago\/exitoso/)
    await expect(page.getByRole('heading', { name: /Pago Exitoso/ })).toBeVisible()
    await expect(page.getByText('Lifting de Pestañas')).toBeVisible()

    await page.goto('/mis-turnos')
    await expect(page.getByText('Pagado · Mercado Pago')).toBeVisible()
  })

  test('mis turnos: próximos, historial y cancelación con motivo', async ({ page, request }) => {
    const user = await registerClient(request)
    const toCancel = await book(request, user.token, { serviceId: 2, time: '15:00' })
    await book(request, user.token, { serviceId: 2, time: '16:00' })
    await signIn(page, request, user.email, user.password)

    await page.goto('/mis-turnos')
    await expect(page.getByRole('tab', { name: /Próximos\s*2/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Pagar/ }).first()).toHaveAttribute('href', /\/pago\?appointment_id=\d+/)

    await page.locator('.turno-card').filter({ hasText: '15:00 hs' }).getByRole('button', { name: /Cancelar/ }).click()
    await page.getByLabel('Motivo de la cancelación').fill('no')
    await page.getByRole('button', { name: 'Sí, cancelar' }).click()
    await expect(page.getByText('al menos 5 caracteres')).toBeVisible()
    await page.getByLabel('Motivo de la cancelación').fill('Surgió un imprevisto')
    await page.getByRole('button', { name: 'Sí, cancelar' }).click()
    await expect(page.getByText('Turno cancelado exitosamente')).toBeVisible()

    await page.getByRole('tab', { name: /Historial/ }).click()
    await expect(page.getByText('✗ Cancelado')).toBeVisible()
    await expect(page.getByText('Surgió un imprevisto')).toBeVisible()

    const detail = await request.get(`${API_URL}/api/appointments/${toCancel.id}`, { headers: bearer(user.token) })
    expect((await detail.json()).status).toBe('cancelled')
  })

  test('las rutas de la SPA cargan al entrar directo', async ({ page }) => {
    for (const path of ['/studio', '/login', '/register', '/forgot-password']) {
      const response = await page.goto(path)
      expect(response?.status(), path).toBe(200)
    }
  })
})
