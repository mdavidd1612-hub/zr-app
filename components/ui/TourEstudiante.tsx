'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Tour guiado del primer ingreso — solo estudiante, a pedido explícito del
 * coordinador (migración 084). Se muestra una sola vez, después de que
 * complete su perfil y acepte términos (esas pantallas ya lo mandan a "/"
 * cuando terminan, así que este componente solo vive en Inicio). "Siguiente"
 * avanza, "Omitir" lo cierra del todo en cualquier paso — ninguno de los dos
 * se le vuelve a mostrar, queda guardado en el servidor (no en el teléfono,
 * para que no reaparezca si cambia de dispositivo).
 *
 * Cada paso apunta a un id real de la pantalla (tour-semana, tour-accesos,
 * tour-nav) — todos existen siempre en Inicio, sin importar el día ni si ya
 * tiene módulo asignado, para que el tour nunca se quede appuntando a algo
 * que no está.
 */

interface Paso {
  titulo: string
  texto: string
  targetId: string | null
}

const PASOS: Paso[] = [
  {
    titulo: '¡Bienvenido a ZR App!',
    texto: 'Te mostramos rapidito cómo se usa. Puedes tocar "Siguiente" para seguir, o "Omitir" si ya la conoces.',
    targetId: null,
  },
  {
    titulo: 'Tu semana',
    texto: 'Aquí ves los días de la semana. El sábado marcas tu asistencia; los demás días, tu módulo y tu material.',
    targetId: 'tour-semana',
  },
  {
    titulo: 'Tu carnet, material y dudas',
    texto: 'Desde aquí muestras tu carnet para la asistencia, revisas el material de tu módulo y le preguntas al profesor.',
    targetId: 'tour-accesos',
  },
  {
    titulo: 'Muévete por la app',
    texto: 'Desde estos botones vas a Inicio, tu módulo, el material, tus dudas y tu perfil, en cualquier momento.',
    targetId: 'tour-nav',
  },
  {
    titulo: 'Listo',
    texto: 'Ya puedes empezar a usar ZR App.',
    targetId: null,
  },
]

interface Rect { top: number; left: number; width: number; height: number }

export function TourEstudiante({ onTerminado }: { onTerminado: () => void }) {
  const [paso, setPaso] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [guardando, setGuardando] = useState(false)

  const actual = PASOS[paso]
  const esUltimo = paso === PASOS.length - 1

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  useEffect(() => {
    function medir() {
      if (!actual.targetId) {
        setRect(null)
        return
      }
      const el = document.getElementById(actual.targetId)
      if (!el) {
        setRect(null)
        return
      }
      const r = el.getBoundingClientRect()
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
    }

    // Si el elemento no está a la vista (celular chico, ya se había
    // scrolleado antes de que arrancara el tour), lo trae al centro antes de
    // medir — si no, el recuadro y el texto podrían quedar fuera de pantalla.
    const el = actual.targetId ? document.getElementById(actual.targetId) : null
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior })
      requestAnimationFrame(medir)
    } else {
      medir()
    }

    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [actual.targetId, paso])

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
    setPaso((p) => p + 1)
  }

  const pad = 8
  const arriba = rect ? rect.top < window.innerHeight / 2 : false

  return (
    <div className="fixed inset-0 z-[200]">
      {rect ? (
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
      ) : (
        <div className="absolute inset-0 bg-[rgba(6,10,20,0.86)]" />
      )}

      <div
        className="absolute left-1/2 w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 space-y-4 rounded-xl border border-zr-border bg-zr-surface p-6 shadow-2xl"
        style={
          !rect
            ? { top: '50%', transform: 'translate(-50%, -50%)' }
            : arriba
              ? { top: Math.min(rect.top + rect.height + pad * 2 + 12, window.innerHeight - 260) }
              : { top: Math.max(rect.top - pad - 12, 16), transform: 'translate(-50%, -100%)' }
        }
      >
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
      </div>
    </div>
  )
}
