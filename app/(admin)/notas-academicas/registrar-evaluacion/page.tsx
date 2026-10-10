'use client'

import { RegistrarEvaluacion } from '@/components/notas/RegistrarEvaluacion'

/**
 * "Registrar Evaluación" -- Dirección Académica. La pantalla vive en
 * components/notas/RegistrarEvaluacion.tsx porque el profesor usa la misma
 * (reunión oct. 2026).
 */
export default function Pagina() {
  return <RegistrarEvaluacion modo="direccion" />
}
