// Orden de prioridad para listar cohortes/programas en cualquier selector de
// la app — a pedido explícito del coordinador (sept. 2026): primero todas las
// de PTMA, después todas las de PFTA, y dentro de cada sede el corte más
// reciente primero (así el programa que está activo ahora mismo, hoy
// PTMA-2026-II, siempre aparece de primero sin tener que tocar código cuando
// arranque un corte nuevo).
//
// No hace falta traer `start_date` ni `code_number` aparte: el nombre ya
// sigue el formato SIGLAS-AÑO-ROMANO (migración 060), y comparado como texto
// en orden descendente el año más alto siempre gana antes de llegar al
// número de corte — funciona con solo el campo `name` que cada pantalla ya
// pedía. Única cuenta pendiente: con más de 8 cortes en un mismo año para la
// misma sede, el orden de los romanos deja de ser exacto (p. ej. "IX" antes
// que "V") — no es el caso hoy, y si algún día lo fuera, se cambia por
// `code_number` en vez de reinventar esto a mano en cada pantalla.
const ORDEN_SIGLAS = ['PTMA', 'PFTA']

function prioridadDeSiglas(siglas: string): number {
  const i = ORDEN_SIGLAS.indexOf(siglas)
  return i === -1 ? ORDEN_SIGLAS.length : i
}

export function ordenarCohortesPorPrioridad<T extends { name: string }>(cohortes: T[]): T[] {
  return [...cohortes].sort((a, b) => {
    const prioridadA = prioridadDeSiglas(a.name.split('-')[0])
    const prioridadB = prioridadDeSiglas(b.name.split('-')[0])
    if (prioridadA !== prioridadB) return prioridadA - prioridadB
    // Descendente dentro del grupo: el corte más nuevo primero.
    if (a.name === b.name) return 0
    return a.name > b.name ? -1 : 1
  })
}

// Mismo criterio para la lista de PROGRAMAS (no cohortes): PTMA antes que
// PFTA. A diferencia de una cohorte, un programa ya trae su sigla real en su
// propia columna (`programs.siglas`, migración 067) — no hay que adivinarla
// partiendo el nombre.
export function ordenarProgramasPorPrioridad<T extends { siglas: string }>(programas: T[]): T[] {
  return [...programas].sort((a, b) => prioridadDeSiglas(a.siglas) - prioridadDeSiglas(b.siglas))
}
