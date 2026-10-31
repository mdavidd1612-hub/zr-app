/**
 * Mismo cálculo que `public.unit_effective_status()` en la base (migración
 * 174) -- aquí es solo para PINTAR el estado en pantallas de profesor
 * (nunca para decidir qué puede ver el estudiante; eso lo decide RLS). Las
 * dos pantallas que lo usaban antes (unidades-docente/page.tsx y
 * unidades-docente/[unitId]/page.tsx) lo reimplementaban cada una por su
 * cuenta y una de las dos olvidó `manual_status` -- el profesor veía
 * "Programada" en una pantalla y "Abierta" en la otra para la MISMA unidad
 * (bug real encontrado en verificación, 31-oct-2026). Un solo lugar evita
 * que se repita.
 */
export type TonoEstadoUnidad = 'exito' | 'aviso' | 'neutro'

export function estadoUnidad(
  openAt: string | null,
  closeAt: string | null,
  manualStatus: 'abierta' | 'cerrada' | null,
): { texto: string; tono: TonoEstadoUnidad } {
  const ahora = Date.now()
  if (manualStatus === 'cerrada') return { texto: 'Cerrada · repaso', tono: 'neutro' }
  if (manualStatus === 'abierta') return { texto: 'Abierta', tono: 'exito' }
  if (!openAt) return { texto: 'Borrador', tono: 'neutro' }
  if (new Date(openAt).getTime() > ahora) return { texto: 'Programada', tono: 'aviso' }
  if (closeAt && new Date(closeAt).getTime() < ahora) return { texto: 'Cerrada · repaso', tono: 'neutro' }
  return { texto: 'Abierta', tono: 'exito' }
}
