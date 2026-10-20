import {
  ADMIN,
  API_URL,
  book,
  bookingDate,
  createPreference,
  expect,
  longDate,
  moveToPast,
  registerClient,
  signIn,
  test,
} from './support.ts'

/**
 * Panel de administración. Combinaciones servicio/hora (no chocan con otros specs):
 * servicio 3 a las 10:00/11:00, servicio 4 a las 12:00–13:00, servicio 5 a las 14:00, servicio 9 a las 17:00.
 */
test.describe('Panel admin', () => {
  test.beforeEach(async ({ page, request }) => {
    await signIn(page, request, ADMIN.email, ADMIN.password)
  })

  test('agenda: historial, filtros, completar un turno pasado y confirmar en efectivo', async ({ page, request }) => {
    const client = await registerClient(request, { phone: '11 5151-0001' })
    const past = await book(request, client.token, { serviceId: 3, time: '10:00' })
    const pending = await book(request, client.token, { serviceId: 3, time: '11:00' })
    await moveToPast(request, past.id)

    await page.goto('/admin')
    await expect(page.getByText('Turnos de hoy')).toBeVisible()
    const rows = page.locator('tbody tr')
    const row = (id: number) => rows.filter({ hasText: `#${id}` })

    await page.getByLabel('Buscar cliente').fill(client.email)
    await expect(row(pending.id)).toBeVisible()
    await expect(row(past.id)).toHaveCount(0)

    await page.getByRole('radio', { name: 'Historial completo' }).click()
    await expect(rows).toHaveCount(2)
    await page.getByLabel('Estado').selectOption('confirmed')
    await expect(rows).toHaveCount(1)
    await page.getByLabel('Estado').selectOption('all')

    await row(past.id).getByRole('button', { name: 'Completar' }).click()
    await page.getByRole('button', { name: 'Sí, completar' }).click()
    await expect(page.getByText(`Turno #${past.id} marcado como completado`)).toBeVisible()
    await expect(row(past.id)).toContainText('★ Completado')

    await row(pending.id).getByRole('button', { name: 'Confirmar (Efectivo)' }).click()
    await page.getByRole('button', { name: 'Sí, confirmar' }).click()
    await expect(row(pending.id)).toContainText('Pagado · Efectivo')
  })

  test('servicios: alta, edición, desactivar y eliminar', async ({ page, request }) => {
    const client = await registerClient(request)
    await book(request, client.token, { serviceId: 9, time: '17:00' })
    const name = `Masaje Descontracturante ${Date.now() % 100000}`

    await page.goto('/admin/servicios')
    await page.getByRole('button', { name: /Nuevo servicio/ }).click()
    await page.getByLabel('Nombre').fill(name)
    await page.getByLabel('Categoría').selectOption('corporal')
    await page.getByLabel('Duración (minutos)').fill('50')
    await page.getByLabel('Precio (ARS)').fill('9800')
    await page.getByRole('button', { name: 'Crear servicio' }).click()
    const row = page.locator('tbody tr').filter({ hasText: name })
    await expect(row).toContainText('$9.800')

    await row.getByRole('button', { name: 'Editar' }).click()
    await page.getByLabel('Precio (ARS)').fill('10500')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(row).toContainText('$10.500')

    await row.getByRole('button', { name: 'Desactivar' }).click()
    await expect(row).toContainText('Inactivo')
    const catalog = await (await request.get(`${API_URL}/api/services/?is_active=true`)).json()
    expect(catalog.map((service: { name: string }) => service.name)).not.toContain(name)

    // Un servicio con turnos no se elimina
    await page.locator('tbody tr').filter({ hasText: 'Pedicuría Spa' }).getByRole('button', { name: 'Eliminar' }).click()
    await page.getByRole('button', { name: 'Sí, eliminar' }).click()
    await expect(page.getByText('No se puede eliminar un servicio con turnos asociados')).toBeVisible()

    await row.getByRole('button', { name: 'Eliminar' }).click()
    await page.getByRole('button', { name: 'Sí, eliminar' }).click()
    await expect(row).toHaveCount(0)
  })

  test('pagos: aprobar, rechazar y registrar una transferencia', async ({ page, request }) => {
    const client = await registerClient(request)
    const toApprove = await book(request, client.token, { serviceId: 4, time: '12:00' })
    const toReject = await book(request, client.token, { serviceId: 4, time: '12:30' })
    const unpaid = await book(request, client.token, { serviceId: 4, time: '13:00' })
    await createPreference(request, client.token, toApprove.id)
    await createPreference(request, client.token, toReject.id)

    await page.goto('/admin/pagos')
    const paymentRow = (id: number) => page.locator('tbody tr').filter({ hasText: `#${id} ·` })
    await paymentRow(toApprove.id).getByRole('button', { name: 'Aprobar' }).click()
    await page.getByRole('button', { name: 'Sí, aprobar' }).click()
    await expect(page.getByText(`el turno #${toApprove.id} quedó confirmado`)).toBeVisible()

    await paymentRow(toReject.id).getByRole('button', { name: 'Rechazar' }).click()
    await page.getByLabel('Motivo (se guarda en el pago)').fill('Pago no acreditado')
    await page.getByRole('button', { name: 'Rechazar pago' }).click()
    await expect(page.getByText(/rechazado\. El turno sigue pendiente de pago/)).toBeVisible()

    const unpaidRow = page.locator('tbody tr').filter({ hasText: `#${unpaid.id}` }).first()
    await unpaidRow.getByRole('button', { name: 'Registrar pago' }).click()
    await page.getByLabel('Transferencia bancaria').check()
    await page.getByRole('button', { name: 'Registrar y confirmar turno' }).click()
    await expect(page.getByText('Ingresá el número de operación')).toBeVisible()
    await page.getByLabel('Nro. de operación / comprobante').fill('OP-445566')
    await page.getByRole('button', { name: 'Registrar y confirmar turno' }).click()
    await expect(page.getByText(`el turno #${unpaid.id} quedó confirmado`)).toBeVisible()

    await page.getByLabel('Estado').selectOption('all')
    await page.getByLabel('Medio').selectOption('transfer')
    await expect(page.getByText('Comprobante: OP-445566')).toBeVisible()
  })

  test('clientes: búsqueda, historial y desactivar la cuenta', async ({ page, request }) => {
    const client = await registerClient(request, { fullName: 'Marta Clienta', phone: '11 5151-0002' })
    await book(request, client.token, { serviceId: 5, time: '14:00' })

    await page.goto('/admin/clientes')
    await page.getByLabel('Buscar cliente').fill('51510002')
    const row = page.locator('tbody tr').filter({ hasText: 'Marta Clienta' })
    await expect(page.locator('tbody tr')).toHaveCount(1)

    await row.getByRole('button', { name: 'Ver historial' }).click()
    await expect(page.getByRole('heading', { name: 'Historial de Marta Clienta' })).toBeVisible()
    await expect(page.locator('.admin-client-history tbody tr')).toHaveCount(1)

    await row.getByRole('button', { name: 'Desactivar' }).click()
    await page.getByRole('button', { name: 'Sí, desactivar' }).click()
    await expect(row).toContainText('Desactivada')
    const blocked = await request.post(`${API_URL}/api/auth/login`, { form: { username: client.email, password: client.password } })
    expect(blocked.status()).toBe(403)
  })

  test('disponibilidad: horario semanal y fecha bloqueada', async ({ page, request }) => {
    await page.goto('/admin/disponibilidad')
    const sunday = page.locator('tbody tr').filter({ hasText: 'Domingo' })
    await sunday.getByRole('checkbox').check()
    await sunday.getByLabel('Apertura del domingo').fill('10:00')
    await sunday.getByLabel('Cierre del domingo').fill('13:00')
    await sunday.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Domingo: de 10:00 a 13:00')).toBeVisible()
    await sunday.getByRole('checkbox').uncheck()
    await sunday.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByText('Domingo: cerrado')).toBeVisible()

    const blocked = (() => {
      const [year, month, day] = bookingDate().split('-').map(Number)
      return new Date(Date.UTC(year, month - 1, day + 3)).toISOString().slice(0, 10)
    })()
    await page.getByLabel('Fecha', { exact: true }).fill(blocked)
    await page.getByRole('button', { name: 'Agregar fecha' }).click()
    const exception = page.locator('.admin-exception-list li').filter({ hasText: longDate(blocked) })
    await expect(exception).toContainText('Cerrado todo el día')
    const slots = await request.post(`${API_URL}/api/availability/available-slots`, { data: { service_id: 1, date: blocked } })
    expect((await slots.json()).available_slots).toEqual([])

    await exception.getByRole('button', { name: 'Quitar' }).click()
    await page.getByRole('button', { name: 'Sí, quitar' }).click()
    await expect(exception).toHaveCount(0)
  })

  test('reportes: totales, gráficos con tooltip y tabla mensual', async ({ page }) => {
    await page.goto('/admin/reportes')
    await expect(page.getByText('Ingresos por mes')).toBeVisible()
    await expect(page.locator('.lm-chart svg')).toHaveCount(2)
    const hits = page.locator('.lm-chart__hit')
    await expect(hits).toHaveCount(24)
    const currentMonth = new Date().getMonth()
    await hits.nth(currentMonth).hover()
    await expect(page.locator('.lm-chart__tooltip')).toContainText('pago')
    await page.getByText('Ver tabla por mes').click()
    await expect(page.locator('.admin-report-table tbody tr')).toHaveCount(12)
  })

  test('las secciones del panel cargan al entrar directo', async ({ page }) => {
    for (const path of ['/admin/servicios', '/admin/pagos', '/admin/clientes', '/admin/disponibilidad', '/admin/reportes']) {
      await page.goto(path)
      await expect(page.locator('.admin-nav__link--active')).toBeVisible()
    }
  })
})

test('el registro también ofrece Google', async ({ page }) => {
  await page.addInitScript(() => {
    window.google = {
      accounts: { id: { initialize: () => {}, renderButton: (parent) => { parent.textContent = 'Google' }, disableAutoSelect: () => {} } },
    }
  })
  await page.goto('/register')
  await expect(page.getByText('o registrate con')).toBeVisible()
})
