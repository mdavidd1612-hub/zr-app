'use client'

import { useEffect } from 'react'

// Bug real de producción (reportado por el coordinador, oct. 2026): alguien
// que ya tenía la app instalada no veía las funciones nuevas (ej. Notas) ni
// los arreglos del tutorial después de un despliegue, aunque ya estuvieran en
// producción -- el teléfono seguía corriendo el JavaScript que tenía cargado
// en memoria. Cuando el navegador activa un Service Worker nuevo, dispara
// `controllerchange` -- se usa esa señal para recargar la página una sola
// vez y que la persona quede en la versión nueva sin tener que desinstalar
// ni reabrir la app a mano. El resguardo en sessionStorage evita un bucle de
// recargas si `controllerchange` dispara más de una vez en la misma visita.
const BANDERA_RECARGA_SW = 'zr_sw_recargado'

export function useServiceWorker() {
  useEffect(() => {
    // Solo en el navegador y si es HTTPS (o localhost para desarrollo)
    if (typeof window === 'undefined') return
    if (!navigator.serviceWorker) return
    if (!window.location.hostname.includes('localhost') && window.location.protocol !== 'https:')
      return

    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      console.error('Error registrando Service Worker:', err)
    })

    function alCambiarControlador() {
      try {
        if (sessionStorage.getItem(BANDERA_RECARGA_SW) === '1') return
        sessionStorage.setItem(BANDERA_RECARGA_SW, '1')
      } catch {
        // Modo privado: sin el resguardo, pero mejor recargar una vez de más
        // que dejar a alguien atascado en una versión vieja.
      }
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', alCambiarControlador)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', alCambiarControlador)
  }, [])
}
