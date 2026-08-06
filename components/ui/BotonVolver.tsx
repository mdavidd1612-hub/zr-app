'use client'

import { useRouter } from 'next/navigation'
import { IconoFlechaAtras } from '@/components/ui/Iconos'

interface Props {
  /**
   * A dónde ir si no hay historial previo (llegaron por un enlace directo,
   * o abrieron la pestaña ya en esta pantalla). Sin esto, router.back() en
   * una pestaña nueva no hace nada — el botón se vería roto.
   */
  href?: string
  texto?: string
}

/** Va arriba de toda pantalla que NO sea una de las 4 pestañas principales:
 *  una ficha, un formulario, un detalle. Las 4 pestañas no lo necesitan —
 *  para eso está la barra flotante. */
export function BotonVolver({ href, texto = 'Volver' }: Props) {
  const router = useRouter()

  function volver() {
    if (href) {
      router.push(href)
      return
    }
    // window.history.length > 1 es la señal de que hay algo a donde volver
    // dentro de esta pestaña; si no, empujar hacia atrás no haría nada.
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
  }

  return (
    <button
      onClick={volver}
      className="-ml-1 flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-zr-text-muted transition-colors active:text-zr-text"
    >
      <IconoFlechaAtras size={18} />
      {texto}
    </button>
  )
}
