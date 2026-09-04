/**
 * Interruptores de producto — no de infraestructura. No hay dos entornos
 * separados (se decidió no montarlos, tomaría demasiado tiempo antes de la
 * demo); esto es lo que existe en su lugar: apagar una función para todo el
 * mundo sin tocar la base de datos ni el código que la sostiene.
 */

// "Casos" (el caso de hoy del estudiante, "Casos" del profesor): los genera
// la IA y todavía nadie de la academia los ha revisado uno por uno para
// descartar alucinaciones — el coordinador lo pidió explícitamente apagado
// hasta que los profesores puedan revisarlos bien. La base, el cron semanal
// (migración 076) y la Edge Function generar-casos siguen corriendo exactos
// igual; solo se deja de mostrar en la interfaz. Se reactiva cambiando esto
// a `true` y desplegando — nada más.
export const CASOS_HABILITADO = false
