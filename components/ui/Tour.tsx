'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { PasoTour } from '@/lib/tour-pasos'

/**
 * Tour guiado genérico, para todos los roles menos super_admin (pedido
 * explícito del coordinador, oct. 2026 — ver lib/tour-pasos.ts y
 * lib/useTour.ts). Generalizado de TourEstudiante.tsx, que era solo de
 * estudiante; la lógica de resaltar un elemento de la pantalla y acomodar
 * la tarjeta sin salirse de ningún tamaño de pantalla es la misma, ya
 * probada en producción.
 *
 * `pasos` son solo los que FALTAN (los ya vistos no llegan aquí, los filtró
 * useTour) — este componente agrega al principio una tarjeta de bienvenida
 * sintética: "¡Bienvenido!" la primera vez, o "Aprende a usar las nuevas
 * funciones de ZR App" si ya había visto el tour antes y esto es solo lo
 * nuevo (`incremental`). Esa tarjeta de bienvenida no se guarda como paso
 * propio -- el primer paso real es a donde "Siguiente" te lleva directo.
 *
 * Cada paso apunta a un id real de esa pantalla. Si el elemento tarda en
 * aparecer (la página todavía está cargando sus datos) se reintenta unos
 * segundos antes de rendirse y mostrar la tarjeta sin resaltar nada.
 */

interface Props {
  pasos: PasoTour[]
  incremental: boolean
  onTerminado: () => void | Promise<void>
}

interface Rect { top: number; left: number; width: number; height: number }

export function Tour({ pasos, incremental, onTerminado }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [paso, setPaso] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [guardando, setGuardando] = useState(false)

  // La bienvenida (o "funciones nuevas") es un paso sintético, sin id propio
  // -- "Siguiente" desde ahí navega directo al primer paso real.
  const PASOS: PasoTour[] = [
    {
      id: '__intro__',
      ruta: pasos[0]?.ruta ?? '/',
      targetId: null,
      titulo: incremental ? 'Aprende a usar las nuevas funciones de ZR App' : '¡Bienvenido a ZR App!',
      texto: incremental
        ? 'Te mostramos rapidito las funciones nuevas que agregamos. Toca "Siguiente" para verlas, u "Omitir" si ya las conoces.'
        : 'Te mostramos rapidito cómo se usa. Puedes tocar "Siguiente" para seguir, o "Omitir" si ya la conoces.',
    },
    ...pasos,
  ]

  const actual = PASOS[paso]
  const esUltimo = paso === PASOS.length - 1
  // La bienvenida/"funciones nuevas" (paso 0) se muestra donde sea que la
  // persona esté cuando se activa el tour -- nunca sabemos de antemano en
  // qué pantalla va a estar (sobre todo en el caso incremental: "tienes
  // funciones nuevas" puede avisar en cualquier pantalla, no solo en el
  // inicio del rol). Del paso 1 en adelante sí hace falta estar en la ruta
  // de ESE paso -- si no, "Siguiente" todavía está navegando para allá.
  const enRutaCorrecta = paso === 0 || pathname === actual.ruta

  // Bug real de producción (sept. 2026, TourEstudiante): bloquear el scroll
  // sin condición alguna dejaba /completar-perfil con el scroll trabado,
  // porque el tour se monta apenas la persona queda validada, que es
  // exactamente cuando podría estar completando su perfil todavía. Solo se
  // bloquea cuando el tour de verdad se está mostrando en la ruta actual.
  useEffect(() => {
    if (!enRutaCorrecta) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [enRutaCorrecta])

  useEffect(() => {
    if (!enRutaCorrecta) {
      setRect(null)
      return
    }
    if (!actual.targetId) {
      setRect(null)
      return
    }

    let cancelado = false
    let intentos = 0

    // Bug real de producción (oct. 2026, "Muévete por la app" en
    // computadora): algunos targets existen dos veces en el DOM -- una
    // versión para teléfono y otra para escritorio, mostrando siempre solo
    // una según el ancho de pantalla (`lg:hidden`/`lg:flex`), nunca
    // desmontada (ver BarraFlotante.tsx y BarraLateral.tsx). Buscar por
    // `id` encuentra cualquiera de las dos sin importar cuál se ve de
    // verdad -- si toca la oculta, su rectángulo mide 0x0 en la esquina
    // superior izquierda y el tour lo resaltaba ahí, "sin seleccionar
    // nada". `buscarVisible` revisa TODOS los elementos que comparten ese
    // id o ese `data-tour-target` y se queda con el primero que de verdad
    // ocupa espacio en pantalla.
    function buscarVisible(targetId: string): HTMLElement | null {
      const candidatos = document.querySelectorAll<HTMLElement>(
        `#${CSS.escape(targetId)}, [data-tour-target="${CSS.escape(targetId)}"]`
      )
      for (const candidato of candidatos) {
        const r = candidato.getBoundingClientRect()
        if (r.width > 0 && r.height > 0) return candidato
      }
      return null
    }

    function medir(el: HTMLElement) {
      const r = el.getBoundingClientRect()
      // Bug real de producción (TourEstudiante, "La malla curricular"): un
      // elemento mucho más alto que la pantalla deja casi nada de alto
      // libre para la tarjeta -- se acota el rectángulo a lo visible, y si
      // eso deja menos de ~170 px libres arriba o abajo, se renuncia al
      // recuadro: la tarjeta cae al mismo respaldo centrado que ya usan la
      // bienvenida y el cierre.
      const top = Math.max(r.top, 0)
      const bottom = Math.min(r.bottom, window.innerHeight)
      const height = Math.max(bottom - top, 0)
      const espacioLibre = Math.max(top, window.innerHeight - bottom)
      if (espacioLibre < 170) {
        setRect(null)
        return
      }
      setRect({ top, left: r.left, width: r.width, height })
    }

    // Si la página recién se montó (venimos de navegar a otra ruta del
    // tour), sus datos pueden tardar en llegar y el elemento todavía no
    // existe — se reintenta unos segundos antes de rendirse.
    function intentar() {
      if (cancelado) return
      const el = buscarVisible(actual.targetId as string)
      if (el) {
        el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
        requestAnimationFrame(() => { if (!cancelado) medir(el) })
        return
      }
      if (intentos < 30) {
        intentos += 1
        setTimeout(intentar, 150)
      } else {
        setRect(null)
      }
    }
    intentar()

    function medirDeNuevo() {
      // Al rotar o redimensionar la ventana puede cambiar CUÁL de las dos
      // versiones (teléfono/escritorio) es la visible -- se vuelve a
      // elegir, no solo a remedir la misma.
      const el = actual.targetId ? buscarVisible(actual.targetId) : null
      if (el) medir(el)
    }
    window.addEventListener('resize', medirDeNuevo)
    return () => {
      cancelado = true
      window.removeEventListener('resize', medirDeNuevo)
    }
  }, [actual.targetId, actual.ruta, paso, enRutaCorrecta])

  async function terminar() {
    setGuardando(true)
    await onTerminado()
    setGuardando(false)
  }

  function siguiente() {
    if (esUltimo) {
      void terminar()
      return
    }
    const proximo = PASOS[paso + 1]
    setPaso(paso + 1)
    if (proximo.ruta !== pathname) {
      router.push(proximo.ruta)
    }
  }

  // Mientras la navegación a la ruta del paso que sigue todavía no termina,
  // no se dibuja nada encima de la pantalla vieja.
  if (!enRutaCorrecta) return null

  const pad = 8
  const arriba = rect ? rect.top < window.innerHeight / 2 : false

  const tarjeta = (
    <>
      <div className="flex gap-1.5">
        {PASOS.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i <= paso ? 'bg-zr-blue' : 'bg-zr-border'}`}
          />
        ))}
      </div>

      <div>
        <p className="zr-display text-lg text-zr-text">{actual.titulo}</p>
        <p className="mt-2 text-sm leading-relaxed text-zr-text-muted">{actual.texto}</p>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          onClick={terminar}
          disabled={guardando}
          className="text-sm font-semibold text-zr-text-muted disabled:opacity-50"
        >
          Omitir
        </button>
        <button
          onClick={siguiente}
          disabled={guardando}
          className="min-h-12 rounded-lg bg-zr-blue px-6 text-sm font-bold text-white disabled:opacity-50"
        >
          {esUltimo ? (guardando ? 'Un momento…' : 'Empezar') : 'Siguiente'}
        </button>
      </div>
    </>
  )

  return (
    <div className="fixed inset-0 z-[200]">
      {rect ? (
        <>
          <div
            className="absolute rounded-xl transition-all duration-300"
            style={{
              top: rect.top - pad,
              left: rect.left - pad,
              width: rect.width + pad * 2,
              height: rect.height + pad * 2,
              boxShadow: '0 0 0 9999px rgba(6,10,20,0.82)',
              border: '2px solid rgba(59,130,246,0.9)',
            }}
          />
          <div
            className="absolute left-1/2 w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 space-y-4 overflow-y-auto rounded-xl border border-zr-border bg-zr-surface p-6 shadow-2xl"
            style={
              // `bottom` (caso "arriba") o `top` solo (caso "abajo") dejan
              // que el navegador acomode la altura de la tarjeta él solo,
              // creciendo desde ese borde — a diferencia de un
              // top+translate(-100%), que necesita saber de antemano cuánto
              // mide la tarjeta para no salirse por arriba. maxHeight +
              // overflow-y-auto es el respaldo final: si de verdad no cabe
              // (teléfono muy bajo), la tarjeta scrollea en vez de salirse
              // de ningún tamaño de pantalla.
              arriba
                ? (() => {
                    const top = Math.min(rect.top + rect.height + pad * 2 + 12, window.innerHeight - 120)
                    return { top, maxHeight: window.innerHeight - top - 16 }
                  })()
                : (() => {
                    const espacioArriba = Math.max(rect.top - pad - 12, 120)
                    return { bottom: window.innerHeight - espacioArriba, maxHeight: espacioArriba - 16 }
                  })()
            }
          >
            {tarjeta}
          </div>
        </>
      ) : (
        // Sin elemento que resaltar (bienvenida, pasos sin targetId, cierre,
        // o el elemento no apareció a tiempo): la tarjeta se centra con
        // flexbox, no con top:50%+transform — así nunca se sale del
        // viewport ni se desfigura contra los bordes, sea cual sea el
        // tamaño de pantalla.
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(6,10,20,0.86)] p-5">
          <div className="max-h-full w-full max-w-sm space-y-4 overflow-y-auto rounded-xl border border-zr-border bg-zr-surface p-6 shadow-2xl">
            {tarjeta}
          </div>
        </div>
      )}
    </div>
  )
}
