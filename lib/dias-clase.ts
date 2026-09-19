/**
 * Días de clase de una cohorte. `cohorts.days` es texto libre ("Sábados",
 * "Sábados y domingos"); si no se reconoce ningún día se asume sábado, que
 * es la regla de la academia (AGENTS.md §1).
 *
 * Existe porque dos pantallas creaban la "sesión de hoy" en cualquier día de
 * la semana: un martes de prueba quedó como una fecha más en la hoja de
 * asistencia, sin que nadie tuviera clase.
 */

const DIAS: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
}

/** Fecha de hoy en la hora LOCAL (YYYY-MM-DD). `toISOString()` da la fecha UTC,
 *  que a partir de las 8 p. m. en Venezuela ya es "mañana". */
export function hoyLocalISO(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

export function esDiaDeClase(diasTexto: string | null | undefined, fechaISO: string): boolean {
  const normal = (diasTexto ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const dias = Object.entries(DIAS).filter(([nombre]) => normal.includes(nombre)).map(([, n]) => n)
  const validos = dias.length > 0 ? dias : [6]
  return validos.includes(new Date(`${fechaISO}T12:00:00`).getDay())
}
