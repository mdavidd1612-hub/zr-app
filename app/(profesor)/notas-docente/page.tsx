'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { ContextoDocente, type ContextoSel } from '@/components/ui/ContextoDocente'

/**
 * Índice de `/notas`: el profesor elige primero el programa (si da clase en más
 * de uno) y luego el módulo (solo los de ese programa); con uno solo de cada
 * entra directo. Un módulo ya cursado o que aún no empieza se abre igual, y la
 * pantalla de notas lo muestra bloqueado.
 */

function IrANotas({ ctx }: { ctx: ContextoSel }) {
  const router = useRouter()
  useEffect(() => {
    router.replace(`/notas/${ctx.cohortId}?modulo=${ctx.moduleId}`)
  }, [router, ctx.cohortId, ctx.moduleId])
  return <PantallaEsqueleto />
}

export default function NotasIndice() {
  return (
    <ContextoDocente sobretitulo="Notas" titulo="Tus programas">
      {(ctx) => <IrANotas ctx={ctx} />}
    </ContextoDocente>
  )
}
