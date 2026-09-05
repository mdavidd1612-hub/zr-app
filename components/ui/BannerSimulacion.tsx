'use client'

import { useRouter } from 'next/navigation'
import { salirDeVistaRecorrido } from '@/lib/vista-recorrido'

/**
 * A pedido explícito del coordinador: que administración, dirección
 * académica y super_admin puedan recorrer la app como la ve cada rol, sin
 * crear cuentas de prueba. El primer intento (solo Ventas) no tenía forma
 * de volver — esto le agrega un botón de salida siempre visible, fijo
 * arriba de cada pantalla.
 *
 * "Salir a mi panel" tiene que apagar la cookie zr_vista (no solo navegar)
 * — si no, la próxima vez que abran la app (o solo naveguen para atrás)
 * seguirían cayendo en esta misma vista de recorrido en vez de en su panel.
 */
export function BannerSimulacion({ etiqueta }: { etiqueta: string }) {
  const router = useRouter()

  function salir() {
    salirDeVistaRecorrido()
    router.push('/panel')
  }

  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-zr-warning/40 bg-zr-warning/15 px-4 py-2.5 text-xs font-bold text-zr-warning">
      <span>Vista de recorrido: así se ve la app para {etiqueta} · sigues siendo tú</span>
      <button onClick={salir} className="shrink-0 underline underline-offset-2">
        Salir a mi panel
      </button>
    </div>
  )
}
