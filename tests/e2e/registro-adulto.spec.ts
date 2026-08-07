import { test, expect } from '@playwright/test'

/**
 * spec/05_PRUEBAS.md §3 · registro-adulto.spec.ts
 *
 * Un mayor de edad va directo al carnet, sin consentimiento — y debe ser
 * rápido: menos de 60 segundos es el criterio explícito del spec.
 */

function cedulaAlAzar() {
  return `V-9${Math.floor(Math.random() * 10_000_000).toString().padStart(7, '0')}`
}

test('un mayor de edad se registra directo, sin pasar por consentimiento, en menos de 60s', async ({ page }) => {
  const inicio = Date.now()
  const cedula = cedulaAlAzar()

  await page.goto('/registro')

  await page.getByLabel('Nombre completo').fill('Estudiante Mayor De Prueba')
  await page.getByLabel('Cédula').fill(cedula)
  await page.getByLabel('Fecha de nacimiento').fill('2000-05-20') // claramente mayor de edad
  await page.getByLabel('Correo de contacto').fill('mayor-e2e@correo.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('Prueba123!')
  await page.getByLabel('Repetir contraseña').fill('Prueba123!')

  await page.getByRole('button', { name: 'Crear cuenta' }).click()

  // Va directo a inicio — nunca pasa por /registro/consentimiento.
  await expect(page).toHaveURL('/', { timeout: 15_000 })
  await expect(page).not.toHaveURL(/consentimiento/)

  const segundos = (Date.now() - inicio) / 1000
  expect(segundos).toBeLessThan(60)
})
