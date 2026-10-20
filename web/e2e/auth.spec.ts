import { API_URL, ADMIN, expect, headerGreeting, registerClient, signIn, stubGoogle, test, uniqueEmail } from './support.ts'

test.describe('Autenticación', () => {
  test('registro con auto-login, sesión en el header y logout con confirmación', async ({ page }) => {
    const email = uniqueEmail('registro')
    await page.goto('/register')
    await page.getByLabel('Nombre Completo').fill('Lucía Prueba')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Teléfono (opcional)').fill('+54 11 4444-7788')
    await page.getByLabel('Contraseña').fill('debil')
    await page.getByRole('button', { name: 'Registrarse' }).click()
    await expect(page.getByText('La contraseña debe tener')).toBeVisible()

    await page.getByLabel('Contraseña').fill('Clave1234')
    await page.getByRole('button', { name: 'Registrarse' }).click()
    await expect(page).toHaveURL(/\/studio$/)
    await expect(headerGreeting(page, 'Lucía Prueba')).toBeVisible()

    await page.getByRole('button', { name: /Salir/ }).first().click()
    await page.getByRole('button', { name: 'Sí, salir' }).click()
    await expect(page.getByRole('link', { name: /Iniciar Sesión/ }).first()).toBeVisible()
  })

  test('login con credenciales inválidas y válidas', async ({ page, request }) => {
    const user = await registerClient(request)
    await page.goto('/login')
    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Contraseña').fill('Incorrecta1')
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
    await expect(page.getByRole('alert')).toHaveText('Email o contraseña incorrectos')

    await page.getByLabel('Contraseña').fill(user.password)
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
    await expect(page).toHaveURL(/\/studio$/)
  })

  test('login con Google crea la cuenta', async ({ page }) => {
    await stubGoogle(page, uniqueEmail('google'), 'Valentina Google')
    await page.goto('/login')
    await expect(page.getByText('o continuá con')).toBeVisible()
    await page.getByRole('button', { name: 'Continuar con Google' }).click()
    await expect(page).toHaveURL(/\/studio$/)
    await expect(headerGreeting(page, 'Valentina Google')).toBeVisible()
  })

  test('recuperar contraseña desde el link del email', async ({ page, request }) => {
    const user = await registerClient(request)
    await page.goto('/login')
    await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click()
    await expect(page).toHaveURL(/\/forgot-password$/)
    await page.getByLabel('Email de tu cuenta').fill(user.email)
    await page.getByRole('button', { name: 'Enviar instrucciones' }).click()
    await expect(page.getByText('vas a recibir las instrucciones')).toBeVisible()

    const { token } = await (await request.get(`${API_URL}/__e2e__/reset-token`, { params: { email: user.email } })).json()
    // El link del email apunta a la URL del legado: /login.html?token=…
    await page.goto(`/login.html?token=${encodeURIComponent(token)}`)
    await expect(page).toHaveURL(/\/reset-password$/)
    await expect(page.getByLabel('Código de verificación')).toHaveValue(token)

    await page.getByLabel('Nueva contraseña').fill('NuevaClave9')
    await page.getByLabel('Confirmar contraseña').fill('OtraClave9')
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click()
    await expect(page.getByText('Las contraseñas no coinciden')).toBeVisible()

    await page.getByLabel('Confirmar contraseña').fill('NuevaClave9')
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByText('¡Contraseña actualizada!')).toBeVisible()

    await page.getByLabel('Email').fill(user.email)
    await page.getByLabel('Contraseña').fill('NuevaClave9')
    await page.getByRole('button', { name: 'Iniciar Sesión' }).click()
    await expect(page).toHaveURL(/\/studio$/)
  })

  test('rutas protegidas según la sesión y el rol', async ({ page, request }) => {
    await page.goto('/mis-turnos')
    await expect(page).toHaveURL(/\/login$/)

    const user = await registerClient(request)
    await signIn(page, request, user.email, user.password)
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/studio$/)
  })

  test('el admin ve el acceso al panel', async ({ page, request }) => {
    await signIn(page, request, ADMIN.email, ADMIN.password)
    await page.goto('/studio')
    await expect(page.getByRole('link', { name: /Admin/ }).first()).toBeVisible()
  })
})
