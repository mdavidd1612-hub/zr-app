/**
 * Version visible de la app (barra lateral y cinta de entorno de prueba).
 * REGLA (coordinador, 17-nov-2026): se SUBE en cada cambio, aunque sea chico
 * (commit, migracion, ajuste), para saber a simple vista que el telefono o la
 * computadora ya tiene lo ultimo. Esta es la unica fuente del numero.
 */
export const APP_VERSION = '2.00'

/**
 * Pantalla de "actualización obligatoria" del estudiante (21-nov-2026, pedido
 * del coordinador). Es solo una presentación: la app ya está actualizada; la
 * pantalla prepara al estudiante y lo lleva al tutorial sin poder omitirlo.
 * Sale UNA vez por estudiante por cada valor de esta clave (se guarda en
 * profiles.tour_pasos_vistos como 'actualizacion:<clave>').
 * REGLA: al pasar a producción una actualización que el estudiante deba notar,
 * cambia esta clave (p. ej. 'prod-2026-12') para que la vuelvan a ver.
 */
export const ACTUALIZACION_OBLIGATORIA = 'prod-2026-11'
