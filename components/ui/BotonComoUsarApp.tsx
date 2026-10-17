'use client'

import { useRouter } from 'next/navigation'
import { pedirTourCompleto } from '@/lib/useTour'
import { IconoDuda } from '@/components/ui/Iconos'

/**
 * "Cómo usar la app" (pedido explícito del coordinador, oct. 2026): vive en
 * el perfil de cada rol con tutorial (todos menos super_admin, que no tiene
 * — lib/tour-pasos.ts). Vuelve a mostrar el tour COMPLETO desde el
 * principio, sin importar qué pasos ya había visto -- `pedirTourCompleto()`
 * deja una bandera que el layout de ese rol lee al llegar a su pantalla de
 * inicio (useTour.ts).
 */
export function BotonComoUsarApp({ inicioDelRol }: { inicioDelRol: string }) {
  const router = useRouter()
  return (
    <button
      onClick={() => {
        pedirTourCompleto()
        router.push(inicioDelRol)
      }}
      className="zr-card zr-card-interactive flex w-full items-center justify-between gap-3 p-5 text-left"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zr-border text-zr-blue">
          <IconoDuda size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-zr-text">Cómo usar la app</p>
          <p className="mt-0.5 text-sm text-zr-text-muted">Vuelve a ver el recorrido guiado</p>
        </div>
      </div>
      <span className="shrink-0 text-zr-text-muted">›</span>
    </button>
  )
}
