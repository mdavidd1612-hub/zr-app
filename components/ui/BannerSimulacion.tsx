'use client'

import Link from 'next/link'

/**
 * A pedido explícito del coordinador (transcripción de audio,
 * docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md): que super_admin pueda recorrer
 * la app como la ve cada rol, sin crear cuentas de prueba. El primer
 * intento (solo Ventas) no tenía forma de volver — esto le agrega un
 * botón de salida siempre visible, fijo arriba de cada pantalla.
 */
export function BannerSimulacion({ etiqueta }: { etiqueta: string }) {
  return (
    <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-zr-warning/40 bg-zr-warning/15 px-4 py-2.5 text-xs font-bold text-zr-warning">
      <span>Vista de recorrido: así se ve la app para {etiqueta} · sigues siendo tú (super_admin)</span>
      <Link href="/panel" className="shrink-0 underline underline-offset-2">
        Salir a mi panel
      </Link>
    </div>
  )
}
