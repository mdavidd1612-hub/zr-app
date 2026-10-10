'use client'

import { RegistrarEvaluacion } from '@/components/notas/RegistrarEvaluacion'

/** El profesor registra las evaluaciones de los módulos que da (migración 144). */
export default function Pagina() {
  return <RegistrarEvaluacion modo="profesor" />
}
