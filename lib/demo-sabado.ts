/**
 * PRUEBA TEMPORAL — Fase 0 (docs/14_FASE0_PLAN_SPRINTS.md).
 *
 * Interruptor físico en Perfil que simula "hoy es sábado" para poder probar
 * el flujo de asistencia sin esperar al sábado real. Vive en localStorage
 * (por teléfono, no en la base) y se quita del todo cuando la academia lo
 * pida — no es una función real del producto.
 */

const CLAVE = 'zr_demo_sabado'

export function leerSimulacionSabado(): boolean {
  try {
    return localStorage.getItem(CLAVE) === '1'
  } catch {
    return false
  }
}

export function guardarSimulacionSabado(activo: boolean) {
  try {
    if (activo) localStorage.setItem(CLAVE, '1')
    else localStorage.removeItem(CLAVE)
  } catch {
    // localStorage puede fallar en modo privado; no es crítico para la demo.
  }
}
