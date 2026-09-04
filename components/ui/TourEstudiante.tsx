'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Tour guiado del primer ingreso — solo estudiante, a pedido explícito del
 * coordinador (migración 084). Se muestra una sola vez, después de que
 * complete su perfil y acepte términos. Recorre las cinco secciones de la
 * barra de navegación, no solo Inicio: cada paso trae su propia ruta, y
 * "Siguiente" navega solo cuando el paso que sigue vive en otra pantalla.
 * Vive montado en app/(app)/layout.tsx (no en una sola página) para que su
 * estado (en qué paso va) sobreviva la navegación entre rutas — un layout no
 * se vuelve a montar al cambiar de página dentro del mismo grupo de rutas,
 * a diferencia de cada page.tsx.
 *
 * "Omitir" lo cierra del todo en cualquier paso — ninguno de los dos se le
 * vuelve a mostrar, queda guardado en el servidor (no en el teléfono, para
 * que no reaparezca si cambia de dispositivo).
 *
 * Cada paso apunta a un id real de esa pantalla. Si el elemento tarda en
 * aparecer (la página todavía está cargando sus datos) se reintenta unos
 * segundos antes de rendirse y mostrar la tarjeta sin resaltar nada.
 */

interface Paso {
  ruta: string
  titulo: string
  texto: string
  targetId: string | null
}

const PASOS: Paso[] = [
  {
    ruta: '/',
    titulo: '¡Bienvenido a ZR App!',
    texto: 'Te mostramos rapidito cómo se usa. Puedes tocar "Siguiente" para seguir, o "Omitir" si ya la conoces.',
    targetId: null,
  },
  {
    ruta: '/',
    titulo: 'Tu semana',
    texto: 'Aquí ves los días de la semana. El sábado marcas tu asistencia; los demás días, tu módulo y tu material.',
    targetId: 'tour-semana',
  },
  {
    ruta: '/',
    titulo: 'Tu carnet, material y dudas',
    texto: 'Desde aquí muestras tu carnet para la asistencia, revisas el material de tu módulo y le preguntas al profesor.',
    targetId: 'tour-accesos',
  },
  {
    ruta: '/',
    titulo: 'Muévete por la app',
    texto: 'Desde estos botones vas a Inicio, tu módulo, el material, tus dudas y tu perfil. Dale "Siguiente" y te los mostramos uno por uno.',
    targetId: 'tour-nav',
  },
  {
    ruta: '/clases',
    titulo: 'Mi módulo',
    texto: 'Aquí ves todo lo que vas a aprender en el módulo que estás cursando ahora: el resumen completo y tus competencias.',
    targetId: 'tour-modulo',
  },
  {
    ruta: '/malla',
    titulo: 'La malla curricular',
    texto: 'Y desde ahí puedes entrar aquí — los catorce módulos del programa completo, en el orden en que se cursan.',
    targetId: 'tour-malla',
  },
  {
    ruta: '/contenido',
    titulo: 'Material',
    texto: 'Aquí está el material de tu módulo: guías, PDFs y presentaciones, organizados en carpetas.',
    targetId: 'tour-material',
  },
  {
    ruta: '/dudas',
    titulo: 'Dudas',
    texto: 'Si algo no te quedó claro, escríbelo aquí como pregunta. Tu profesor las responde el sábado.',
    targetId: 'tour-dudas',
  },
  {
    ruta: '/perfil',
    titulo: 'Tu carnet',
    texto: 'Y aquí tu carnet digital con tu código QR — el profesor lo escanea para marcar tu asistencia.',
    targetId: 'tour-carnet',
  },
]

interface Rect { top: number; left: number; width: number; height: number }

export function TourEstudiante({ onTerminado }: { onTerminado: () => void }) {
  const router = useRouter()
  const pathname = usePathname()
  const [paso, setPaso] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [guardando, setGuardando] = useState(false)

  const actual = PASOS[paso]
  const esUltimo = paso === PASOS.length - 1
  const enRutaCorrecta = pathname === actual.ruta

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

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

    function medir(el: HTMLElement) {
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }

    // Si la página recién se montó (venimos de navegar a otra ruta del
    // tour), sus datos pueden tardar en llegar y el elemento todavía no
    // existe — se reintenta unos segundos antes de rendirse.
    function intentar() {
      if (cancelado) return
      const el = document.getElementById(actual.targetId as string)
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
      const el = actual.targetId ? document.getElementById(actual.targetId) : null
      if (el) medir(el)
    }
    window.addEventListener('resize', medirDeNuevo)
    return () => {
      cancelado = true
      window.removeEventListener('resize', medirDeNuevo)
    }
  }, [actual.targetId, paso, enRutaCorrecta])

  async function terminar() {
    setGuardando(true)
    await createClient().rpc('fn_marcar_tour_visto')
    setGuardando(false)
    onTerminado()
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
            className="absolute left-1/2 w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 space-y-4 rounded-xl border border-zr-border bg-zr-surface p-6 shadow-2xl"
            style={
              arriba
                ? { top: Math.min(rect.top + rect.height + pad * 2 + 12, window.innerHeight - 260) }
                : { top: Math.max(rect.top - pad - 12, 16), transform: 'translate(-50%, -100%)' }
            }
          >
            {tarjeta}
          </div>
        </>
      ) : (
        // Sin elemento que resaltar (bienvenida, cierre, o el elemento no
        // apareció a tiempo): la tarjeta se centra con flexbox, no con
        // top:50%+transform — así nunca se sale del viewport ni se
        // desfigura contra los bordes, sea cual sea el tamaño de pantalla.
        <div className="absolute inset-0 flex items-center justify-center bg-[rgba(6,10,20,0.86)] p-5">
          <div className="max-h-full w-full max-w-sm space-y-4 overflow-y-auto rounded-xl border border-zr-border bg-zr-surface p-6 shadow-2xl">
            {tarjeta}
          </div>
        </div>
      )}
    </div>
  )
}
