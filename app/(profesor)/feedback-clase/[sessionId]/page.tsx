'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'

/**
 * T-407 · Feedback agregado de una sesión.
 *
 * v_feedback_session_summary ya aplica las dos reglas de negocio: solo
 * cohortes que el profesor atiende, y solo si hay 3 o más respuestas. Si la
 * consulta vuelve vacía, no significa "nadie respondió" — puede que sí
 * respondieran pero sean menos de 3, y por diseño eso no se muestra.
 */

interface Fila {
  pregunta: string
  promedio: number
  respuestas: number
}

export default function FeedbackClase() {
  const params = useParams()
  const sessionId = params.sessionId as string

  const [filas, setFilas] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(true)
  const [sesion, setSesion] = useState<{ fecha: string; cohorte: string } | null>(null)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()

      const [{ data: resumen }, { data: s }] = await Promise.all([
        supabase
          .from('v_feedback_session_summary')
          .select('question, avg_score, response_count')
          .eq('session_id', sessionId),
        supabase
          .from('class_sessions')
          .select('session_date, cohorts(name)')
          .eq('id', sessionId)
          .single(),
      ])

      setFilas(
        (resumen ?? []).map((r) => ({
          pregunta: r.question ?? '',
          promedio: Number(r.avg_score),
          respuestas: Number(r.response_count),
        })),
      )

      const fila = s as unknown as { session_date: string; cohorts: { name: string } | null } | null
      if (fila) {
        setSesion({
          fecha: new Date(fila.session_date + 'T12:00:00').toLocaleDateString('es-VE', {
            weekday: 'long', day: 'numeric', month: 'long',
          }),
          cohorte: fila.cohorts?.name ?? 'Programa',
        })
      }

      setCargando(false)
    }

    cargar()
  }, [sessionId])

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-zr-text-muted">Cargando feedback…</p>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14">
      <BotonVolver href="/sesiones" />

      <Encabezado
        sobretitulo="Docencia"
        titulo="Feedback de la clase"
        descripcion={sesion ? `${sesion.cohorte} · ${sesion.fecha}` : undefined}
      />

      <Regla delay={60} />

      {filas.length === 0 ? (
        <div className="zr-card p-8 text-center">
          <p className="text-base font-semibold text-zr-text">Todavía no hay suficientes respuestas</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-zr-text-muted">
            El promedio solo se muestra a partir de 3 respuestas — así nadie puede adivinar quién
            dijo qué. Puede que ya haya una o dos, pero aún no alcanza.
          </p>
        </div>
      ) : (
        <Seccion numero={1} titulo="Promedio del grupo" delay={120}>
          <div className="space-y-3">
            {filas.map((f) => (
              <div key={f.pregunta} className="zr-card p-6">
                <p className="text-sm font-semibold text-zr-text">{f.pregunta}</p>
                <div className="mt-4 flex items-end gap-2">
                  <span className="zr-metric text-3xl text-zr-blue">{f.promedio.toFixed(1)}</span>
                  <span className="pb-1 text-sm text-zr-text-muted">/ 5</span>
                  <span className="ml-auto pb-1 text-xs text-zr-text-muted">
                    {f.respuestas} respuesta{f.respuestas === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Seccion>
      )}
    </div>
  )
}
