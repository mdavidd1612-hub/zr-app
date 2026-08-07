import { test, expect } from '@playwright/test'

/**
 * spec/05_PRUEBAS.md §3 · registro-menor.spec.ts
 *
 * Un menor de 15-17 años no puede saltarse el consentimiento parental — es
 * un requisito legal (LOPNNA), no una preferencia de producto. La prueba
 * verifica que la redirección es imposible de evitar y que el flujo cierra
 * con el carnet visible.
 */

function cedulaAlAzar() {
  return `V-9${Math.floor(Math.random() * 10_000_000).toString().padStart(7, '0')}`
}

test('un menor de edad no puede terminar el registro sin pasar por consentimiento', async ({ page }) => {
  const cedula = cedulaAlAzar()
  const hace16Anios = new Date()
  hace16Anios.setFullYear(hace16Anios.getFullYear() - 16)
  const nacimiento = hace16Anios.toISOString().slice(0, 10)

  await page.goto('/registro')

  await page.getByLabel('Nombre completo').fill('Estudiante Menor De Prueba')
  await page.getByLabel('Cédula').fill(cedula)
  await page.getByLabel('Fecha de nacimiento').fill(nacimiento)
  await page.getByLabel('Correo de contacto').fill('representante-e2e@correo.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('Prueba123!')
  await page.getByLabel('Repetir contraseña').fill('Prueba123!')

  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  // La redirección a consentimiento es obligatoria: intentar ir directo al
  // carnet no debe ser posible.
  await expect(page).toHaveURL(/\/registro\/consentimiento/, { timeout: 15_000 })

  await page.goto('/')
  await expect(page).toHaveURL(/\/registro\/consentimiento/)

  // Llenar el consentimiento con el método por defecto (físico).
  await page.getByLabel('Nombre completo').fill('Representante De Prueba')
  await page.getByLabel('Cédula').fill('V-12345678')
  await page.getByLabel('Correo').fill('representante-e2e@correo.test')

  await page.getByRole('button', { name: 'Guardar consentimiento' }).click()

  // Consentimiento registrado: ahora sí llega al carnet, con el QR visible.
  await expect(page).toHaveURL('/', { timeout: 15_000 })
  await expect(page.getByAltText(/[Cc]ódigo QR/)).toBeVisible({ timeout: 10_000 })
})
