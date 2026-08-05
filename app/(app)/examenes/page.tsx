'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla, Etiqueta } from '@/components/ui/Editorial'

/**
 * T-305 · Lista de exámenes del estudiante.
 *
 * Un examen `oculto` NO aparece aquí. No se filtra en el cliente por cortesía:
 * las políticas de RLS de la migración 012 devuelven cero filas. El `.in(...)`
 * de abajo es solo para no traer los cerrados de hace tres meses.
 */

type EstadoIntento = 'no_iniciado' | 'en_progreso' | 'entregado' | 'calificado'

interface Examen {
  id: string
  titulo: string
  modulo: string
  estadoExamen: string
  estadoIntento: EstadoIntento
  puntaje: number | null
  puntajeMaximo: number
  cierra: string | null
}

const ESTADO: Record<EstadoIntento, { texto: string; tono: 'exito' | 'aviso' | 'info' | 'neutro' }> = {
  no_iniciado: { texto: 'Sin presentar', tono: 'info'   },
  en_progreso: { texto: 'A medias',      tono: 'aviso'  },
  entregado:   { texto: 'Entregado',     tono: 'aviso'  },
  calificado:  { texto: 'Calificado',    tono: 'exito'  },
}

export default function Examenes() {
  const router = useRouter()
  const [examenes, setExamenes] = useState<Examen[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: datos, error } = await supabase
        .from('exams')
        .select('id, title, max_score, status, closes_at, modules(name)')
        .in('status', ['habilitado', 'cerrado', 'calificado'])
        .order('closes_at', { ascending: true, nullsFirst: false })

      if (error || !datos) {
        setExamenes([])
        setCargando(false)
        return
      }

      const filas = datos as unknown as {
        id: string; title: string; max_score: number; status: string
        closes_at: string | null; modules: { name: string } | null
      }[]

      const conIntento = await Promise.all(
        filas.map(async (e) => {
          const { data: intento } = await supabase
            .from('exam_attempts')
            .select('status, total_score')
            .eq('exam_id', e.id)
            .eq('student_id', user.id)
            .maybeSingle()

          return {
            id: e.id,
            titulo: e.title,
            modulo: e.modules?.name ?? 'Módulo',
            estadoExamen: e.status,
            estadoIntento: (intento?.status ?? 'no_iniciado') as EstadoIntento,
            puntaje: intento?.total_score ?? null,
            puntajeMaximo: Number(e.max_score),
            cierra: e.closes_at,
          }
        }),
      )

      setExamenes(conIntento)
      setCargando(false)
    }

    cargar()
  }, [router])

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando exámenes…</p>
      </div>
    )
  }

  // Presentable solo si el examen sigue habilitado y no lo ha entregado.
  const sePuedePresentar = (e: Examen) =>
    e.estadoExamen === 'habilitado' &&
    e.estadoIntento !== 'entregado' &&
    e.estadoIntento !== 'calificado'

  const pendientes = examenes.filter(sePuedePresentar)
  const cerrados = examenes.filter((e) => !sePuedePresentar(e))

  return (
    <div className="min-h-dvh bg-zr-bg px-5 pb-28 pt-14">
      <div className="space-y-11">
        <header className="animate-rise">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
            Evaluaciones
          </p>
          <h1 className="zr-display mt-3 text-4xl text-zr-text">Exámenes</h1>
          <p className="mt-3 text-base text-zr-text-muted">
            {pendientes.length === 0
              ? 'No tienes exámenes por presentar.'
              : `Tienes ${pendientes.length} por presentar.`}
          </p>
        </header>

        <Regla delay={60} />

        {examenes.length === 0 && (
          <div className="zr-card animate-rise p-8" style={{ animationDelay: '120ms' }}>
            <p className="text-base font-semibold text-zr-text">Todavía no hay exámenes</p>
            <p className="mt-2 text-sm text-zr-text-muted">
              Tu profesor publica los exámenes cuando la cohorte llega a esa parte del módulo.
              Aparecerán aquí en cuanto lo haga.
            </p>
          </div>
        )}

        {pendientes.length > 0 && (
          <Seccion numero={1} titulo="Por presentar" delay={120}>
            <div className="space-y-3">
              {pendientes.map((e, i) => (
                <button
                  key={e.id}
                  onClick={() => router.push(`/examenes/${e.id}`)}
                  className="zr-card zr-card-interactive w-full animate-rise p-5 text-left"
                  style={{ animationDelay: `${160 + i * 60}ms` }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-zr-text">{e.titulo}</p>
                      <p className="mt-1.5 text-sm text-zr-text-muted">
                        {e.modulo} · {e.puntajeMaximo} puntos
                      </p>
                    </div>
                    <Etiqueta tono={ESTADO[e.estadoIntento].tono}>
                      {ESTADO[e.estadoIntento].texto}
                    </Etiqueta>
                  </div>
                </button>
              ))}
            </div>
          </Seccion>
        )}

        {cerrados.length > 0 && (
          <Seccion
            numero={pendientes.length > 0 ? 2 : 1}
            titulo="Ya presentados"
            delay={pendientes.length > 0 ? 240 : 120}
          >
            <div className="space-y-3">
              {cerrados.map((e) => (
                <div key={e.id} className="zr-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-zr-text">{e.titulo}</p>
                      <p className="mt-1.5 text-sm text-zr-text-muted">{e.modulo}</p>
                      {e.estadoIntento === 'calificado' && e.puntaje !== null && (
                        <p className="mt-3">
                          <span className="zr-metric text-2xl text-zr-blue">{e.puntaje}</span>
                          <span className="ml-1 text-sm text-zr-text-muted">
                            / {e.puntajeMaximo} puntos
                          </span>
                        </p>
                      )}
                      {e.estadoIntento === 'entregado' && (
                        <p className="mt-2 text-xs text-zr-text-muted">
                          Tu profesor todavía tiene que calificar las redacciones.
                        </p>
                      )}
                    </div>
                    <Etiqueta tono={ESTADO[e.estadoIntento].tono}>
                      {ESTADO[e.estadoIntento].texto}
                    </Etiqueta>
                  </div>
                </div>
              ))}
            </div>
          </Seccion>
        )}
      </div>
    </div>
  )
}
