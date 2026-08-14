'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Encabezado, Regla, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'

interface RespuestaEstudiante {
  question_id: string
  answer: unknown
  awarded_points: number | null
  auto_graded: boolean
  teacher_feedback: string | null
}

interface PreguntaRevision {
  id: string
  orderIndex: number
  type: 'opcion_multiple' | 'verdadero_falso' | 'redaccion_abierta'
  statement: string
  options: Array<{ key: string; text: string }> | null
  correctAnswer: unknown
  points: number
  rubric: string | null
  respuesta: RespuestaEstudiante | null
}

interface RevisionData {
  totalScore: number | null
  gradedAt: string | null
  preguntas: PreguntaRevision[]
}

function formatearFecha(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-VE', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function RevisionExamen() {
  const router = useRouter()
  const { examId } = useParams<{ examId: string }>()
  const [data, setData] = useState<RevisionData | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/exam-review/${examId}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          if (body.error === 'not_found') {
            router.replace('/examenes')
          } else {
            setError('No se pudo cargar la revisión.')
          }
          return
        }
        const json = await res.json()
        setData(json)
      })
      .catch(() => setError('Error de red. Intenta de nuevo.'))
      .finally(() => setCargando(false))
  }, [examId, router])

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-zr-text-muted">Cargando revisión…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-5">
        <p className="text-sm text-zr-error">{error ?? 'Examen no disponible.'}</p>
      </div>
    )
  }

  const maxPuntos = data.preguntas.reduce((s, q) => s + q.points, 0)

  return (
    <div className="space-y-11 px-5 pt-14 pb-24">
      <BotonVolver href="/examenes" />

      <Encabezado
        sobretitulo="Revisión"
        titulo="Tu examen"
        descripcion={data.gradedAt ? `Calificado el ${formatearFecha(data.gradedAt)}` : 'Revisión de respuestas'}
      />

      {/* Nota global */}
      <div className="zr-card p-6 text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-text-muted">Tu nota</p>
        <p className="zr-metric mt-2 text-5xl text-zr-blue">
          {data.totalScore ?? '—'}
        </p>
        <p className="mt-1 text-sm text-zr-text-muted">de {maxPuntos} puntos</p>
      </div>

      <Regla delay={60} />

      {/* Preguntas */}
      <div className="space-y-6">
        {data.preguntas.map((q, i) => {
          const respuesta = q.respuesta
          const awardedPoints = respuesta?.awarded_points ?? null
          const correcta = awardedPoints !== null && awardedPoints >= q.points
          const parcial = awardedPoints !== null && awardedPoints > 0 && awardedPoints < q.points
          const erronea = awardedPoints === 0

          const correctAnswer = typeof q.correctAnswer === 'string'
            ? JSON.parse(q.correctAnswer)
            : q.correctAnswer

          const studentAnswer = typeof respuesta?.answer === 'string'
            ? JSON.parse(respuesta.answer as string)
            : respuesta?.answer

          return (
            <div key={q.id} className="zr-card overflow-hidden">
              {/* Cabecera */}
              <div className="flex items-start gap-4 p-5">
                <span className="zr-metric w-8 shrink-0 pt-0.5 text-lg text-zr-text-muted">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium text-zr-text leading-snug">{q.statement}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Etiqueta tono="neutro">{q.points} pts</Etiqueta>
                    {awardedPoints !== null ? (
                      <Etiqueta tono={correcta ? 'exito' : parcial ? 'aviso' : 'error'}>
                        {awardedPoints} / {q.points} obtenidos
                      </Etiqueta>
                    ) : (
                      <Etiqueta tono="info">Sin calificar</Etiqueta>
                    )}
                  </div>
                </div>
              </div>

              {/* Detalle según tipo */}
              <div className="border-t border-zr-border/60 p-5 space-y-4">
                {q.type === 'opcion_multiple' && q.options && (
                  <div className="space-y-2">
                    {q.options.map((opt) => {
                      const esCorrecta = correctAnswer?.key === opt.key
                      const esElegida = studentAnswer?.key === opt.key
                      return (
                        <div
                          key={opt.key}
                          className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
                            esCorrecta
                              ? 'border-zr-success/40 bg-zr-success/10 font-semibold text-zr-success'
                              : esElegida
                              ? 'border-zr-error/40 bg-zr-error/10 text-zr-error'
                              : 'border-zr-border text-zr-text-muted'
                          }`}
                        >
                          <span className="text-base">
                            {esCorrecta ? '✓' : esElegida ? '✗' : '·'}
                          </span>
                          <span>{opt.text}</span>
                          {esElegida && !esCorrecta && (
                            <span className="ml-auto text-xs font-semibold">Tu respuesta</span>
                          )}
                          {esCorrecta && (
                            <span className="ml-auto text-xs font-semibold">Correcta</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {q.type === 'verdadero_falso' && (
                  <div className="space-y-2">
                    {(['true', 'false'] as const).map((val) => {
                      const label = val === 'true' ? 'Verdadero' : 'Falso'
                      const esCorrecta = correctAnswer?.value === val
                      const esElegida = studentAnswer?.value === val
                      return (
                        <div
                          key={val}
                          className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
                            esCorrecta
                              ? 'border-zr-success/40 bg-zr-success/10 font-semibold text-zr-success'
                              : esElegida
                              ? 'border-zr-error/40 bg-zr-error/10 text-zr-error'
                              : 'border-zr-border text-zr-text-muted'
                          }`}
                        >
                          <span>{esCorrecta ? '✓' : esElegida ? '✗' : '·'}</span>
                          <span>{label}</span>
                          {esElegida && !esCorrecta && (
                            <span className="ml-auto text-xs font-semibold">Tu respuesta</span>
                          )}
                          {esCorrecta && (
                            <span className="ml-auto text-xs font-semibold">Correcta</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {q.type === 'redaccion_abierta' && (
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-zr-text-muted">
                        Tu respuesta
                      </p>
                      <div className="rounded-lg border border-zr-border bg-zr-bg px-4 py-3 text-sm text-zr-text leading-relaxed whitespace-pre-wrap">
                        {(studentAnswer?.text as string) || (
                          <span className="text-zr-text-muted italic">Sin respuesta</span>
                        )}
                      </div>
                    </div>

                    {q.rubric && (
                      <div>
                        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-zr-text-muted">
                          Rúbrica
                        </p>
                        <p className="text-sm text-zr-text-muted leading-relaxed">{q.rubric}</p>
                      </div>
                    )}

                    {respuesta?.teacher_feedback && (
                      <div className="rounded-lg border border-zr-blue/30 bg-zr-blue/8 px-4 py-3">
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-zr-blue">
                          Nota del profesor
                        </p>
                        <p className="text-sm text-zr-text leading-relaxed">
                          {respuesta.teacher_feedback}
                        </p>
                      </div>
                    )}

                    {awardedPoints === null && (
                      <p className="text-xs text-zr-text-muted">
                        Tu profesor todavía no ha calificado esta respuesta.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
