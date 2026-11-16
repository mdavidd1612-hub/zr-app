'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Cuando la laptop o el teléfono se suspenden (se cierra la tapa, se apaga
 * la pantalla) y luego se despiertan, el navegador cree que su conexión de
 * red sigue viva pero en realidad está muerta. Cualquier petición a
 * Supabase que dependa de esa conexión se queda esperando para siempre —
 * sin error, sin timeout — y la pantalla se queda en "Cargando…" hasta que
 * alguien recarga a mano.
 *
 * No hay forma confiable de "revivir" esa conexión desde JavaScript: la
 * solución que de verdad funciona es recargar la página cuando vuelve a
 * estar visible después de haber estado oculta un buen rato. Un rato corto
 * (cambiar de pestaña un momento) no debe recargar nada — solo cuando el
 * tiempo oculto sugiere una suspensión real.
 *
 * EXCEPCIÓN (pedido del coordinador, nov 2026): si la persona estaba
 * escribiendo algo (un examen, un texto, una tarea) NO se recarga -- antes,
 * salir un momento a otra ventana y volver borraba todo lo que había escrito.
 * Se detecta con el evento `input` (cualquier campo o editor); el aviso se
 * apaga al cambiar de pantalla, porque lo escrito en la anterior ya se guardó
 * o se descartó a propósito.
 */
const UMBRAL_MS = 60_000

export function useRecargarAlVolver() {
  const pathname = usePathname()
  const hayEscritura = useRef(false)

  useEffect(() => {
    hayEscritura.current = false
  }, [pathname])

  useEffect(() => {
    let ocultaDesde: number | null = null

    function alEscribir() {
      hayEscritura.current = true
    }

    function alCambiarVisibilidad() {
      if (document.hidden) {
        ocultaDesde = Date.now()
        return
      }

      if (ocultaDesde !== null && Date.now() - ocultaDesde > UMBRAL_MS && !hayEscritura.current) {
        window.location.reload()
      }
      ocultaDesde = null
    }

    document.addEventListener('visibilitychange', alCambiarVisibilidad)
    document.addEventListener('input', alEscribir, true)
    return () => {
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
      document.removeEventListener('input', alEscribir, true)
    }
  }, [])
}
