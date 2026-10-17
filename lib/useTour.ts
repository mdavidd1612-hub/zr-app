'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PasoTour } from '@/lib/tour-pasos'

/**
 * Señal para el botón "Cómo usar la app" (perfil de cada rol): como el tour
 * vive en el layout y el botón en una pantalla aparte, no comparten árbol de
 * React -- se avisan con un evento del navegador. El botón lo dispara y
 * navega al inicio del rol; el layout lo escucha y, al recibirlo, muestra el
 * tour COMPLETO (no solo lo nuevo) sin importar qué ya haya visto.
 *
 * No basta con volver a correr la revisión normal en cada navegación: el
 * layout de cada rol no se remonta al navegar entre sus propias rutas (así
 * sobrevive el progreso del tour mientras está abierto), así que revisar en
 * cada cambio de ruta interrumpiría un tour que ya está a mitad de camino
 * -- a la segunda pantalla, "ya vistos" en la base todavía no incluye los
 * pasos que se están mostrando ahora mismo (eso se guarda al final), pero sí
 * incluiría TODO lo de antes, y el tour se cerraría solo de la nada.
 */
const EVENTO_MANUAL = 'zr-tour-manual'
// sessionStorage es el respaldo para cuando SÍ hay recarga completa (poco
// común aquí: el botón siempre navega dentro del mismo rol) -- se revisa una
// sola vez, al montar.
const BANDERA_MANUAL = 'zr_tour_manual'

export function pedirTourCompleto() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(EVENTO_MANUAL))
  try {
    sessionStorage.setItem(BANDERA_MANUAL, '1')
  } catch {
    // sessionStorage puede fallar en modo privado; no es crítico -- el
    // evento ya cubre el caso real (navegación sin recarga).
  }
}

interface EstadoTour {
  cargando: boolean
  /** null = no hay nada que mostrar ahora mismo. */
  pasos: PasoTour[] | null
  /** true: ya había visto el tour antes y esto es solo lo nuevo. */
  incremental: boolean
}

/**
 * Resuelve qué pasos del tutorial de este rol le faltan a la persona, o si
 * pidió verlo completo de nuevo ("Cómo usar la app"). `activo` apaga todo
 * el hook de una vez -- para cuando quien está mirando la pantalla no es en
 * realidad ese rol.
 *
 * `soloManual` (bug real de producción, oct. 2026, reportado por el
 * coordinador): en vista de recorrido, el tour SÍ tiene que poder abrirse
 * ("Cómo usar la app"), pero NO debe aparecer solo cada vez que Dirección
 * Académica/super_admin eligen un programa y módulo para inspeccionar --
 * eso tapaba la pantalla que justo estaban tratando de ver ("le doy al
 * botón y no pasa nada": sí pasaba, pero el tour se montaba encima tapando
 * el contenido). Con `soloManual` en true se salta la revisión automática
 * de pasos pendientes al entrar, pero el evento de "Cómo usar la app"
 * sigue funcionando igual.
 */
export function useTour(pasosDelRol: PasoTour[], activo: boolean, soloManual = false) {
  const [estado, setEstado] = useState<EstadoTour>({ cargando: true, pasos: null, incremental: false })
  // Mientras el tour ya está abierto, una revisión disparada por otra causa
  // (p. ej. `activo` cambiando de valor) no debe pisarlo a mitad de camino.
  const abiertoRef = useRef(false)

  // Bug real de producción (oct. 2026, reportado por el coordinador): si
  // quien llama pasa un arreglo nuevo en cada render (p. ej. `grupo ?
  // PASOS_POR_ROL[x] : []` -- ese `[]` suelto es una referencia distinta
  // cada vez), los efectos de abajo, que dependían de `pasosDelRol`
  // directo, se disparaban sin fin ("Maximum update depth exceeded"),
  // dejando la pantalla congelada -- un botón se podía tocar, pero no
  // pasaba nada. Se depende de esta CLAVE (el contenido, no la referencia)
  // en vez del arreglo -- así el hook no se rompe aunque quien lo llama se
  // equivoque y pase un arreglo nuevo cada vez.
  const clavePasos = pasosDelRol.map((p) => p.id).join('|')

  const revisarPendientes = useCallback(async () => {
    if (!activo || pasosDelRol.length === 0) {
      setEstado({ cargando: false, pasos: null, incremental: false })
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setEstado({ cargando: false, pasos: null, incremental: false })
      return
    }

    const { data: perfil } = await supabase
      .from('profiles').select('tour_pasos_vistos').eq('id', user.id).maybeSingle()
    const vistos = new Set(perfil?.tour_pasos_vistos ?? [])
    const pendientes = pasosDelRol.filter((p) => !vistos.has(p.id))

    if (pendientes.length === 0) {
      setEstado({ cargando: false, pasos: null, incremental: false })
      return
    }

    // Incremental: ya había visto ALGO (si no hubiera visto nada, le faltan
    // TODOS los pasos) -- "Aprende a usar las nuevas funciones" en vez de
    // la bienvenida completa.
    abiertoRef.current = true
    setEstado({ cargando: false, pasos: pendientes, incremental: pendientes.length < pasosDelRol.length })
    // El lint de "falta pasosDelRol como dependencia" es a propósito: se
    // depende del CONTENIDO (clavePasos), no de la referencia -- ver nota
    // de clavePasos arriba sobre por qué.
  }, [clavePasos, activo]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (abiertoRef.current) return // ver nota de abiertoRef arriba
    let manual = false
    try {
      manual = sessionStorage.getItem(BANDERA_MANUAL) === '1'
      if (manual) sessionStorage.removeItem(BANDERA_MANUAL)
    } catch {
      // ver nota de pedirTourCompleto()
    }
    if (manual && activo && pasosDelRol.length > 0) {
      abiertoRef.current = true
      setEstado({ cargando: false, pasos: pasosDelRol, incremental: false })
      return
    }
    // `soloManual`: ver nota de la función arriba -- en vista de recorrido
    // no se revisan pendientes solos, solo se atiende la bandera/evento
    // manual de "Cómo usar la app" (ya resuelto arriba).
    if (soloManual) {
      setEstado({ cargando: false, pasos: null, incremental: false })
      return
    }
    revisarPendientes()
  }, [revisarPendientes, activo, clavePasos, soloManual]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function alPedirCompleto() {
      if (!activo || pasosDelRol.length === 0) return
      abiertoRef.current = true
      setEstado({ cargando: false, pasos: pasosDelRol, incremental: false })
    }
    window.addEventListener(EVENTO_MANUAL, alPedirCompleto)
    return () => window.removeEventListener(EVENTO_MANUAL, alPedirCompleto)
  }, [activo, clavePasos]) // eslint-disable-line react-hooks/exhaustive-deps

  async function terminar() {
    const pasosVistos = estado.pasos
    abiertoRef.current = false
    setEstado({ cargando: false, pasos: null, incremental: false })
    if (!pasosVistos || pasosVistos.length === 0) return
    await createClient().rpc('fn_marcar_pasos_tour_vistos', { p_pasos: pasosVistos.map((p) => p.id) })
  }

  return { ...estado, terminar }
}
