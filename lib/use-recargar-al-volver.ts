'use client'

import { useEffect } from 'react'

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
 */
const UMBRAL_MS = 60_000

export function useRecargarAlVolver() {
  useEffect(() => {
    let ocultaDesde: number | null = null

    function alCambiarVisibilidad() {
      if (document.hidden) {
        ocultaDesde = Date.now()
        return
      }

      if (ocultaDesde !== null && Date.now() - ocultaDesde > UMBRAL_MS) {
        window.location.reload()
      }
      ocultaDesde = null
    }

    document.addEventListener('visibilitychange', alCambiarVisibilidad)
    return () => document.removeEventListener('visibilitychange', alCambiarVisibilidad)
  }, [])
}
