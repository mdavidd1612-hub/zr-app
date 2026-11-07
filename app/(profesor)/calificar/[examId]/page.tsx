'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'

/**
 * Lista de estudiantes que presentaron UN examen -- pedido explícito del
 * coordinador (7-nov-2026): al tocar "Ver" en el examen de certificación
 * dentro de una unidad, el profesor entra aquí (no directo al constructor),
 * elige un estudiante y corrige sus redacciones desde
 * /calificar/[examId]/[attemptId].
 *
 * Las de opción múltiple y verdadero/falso ya se calificaron solas al
 * entregar (submit-attempt, migración 176). Solo las de redacción abierta
 * esperan por un profesor -- eso es lo que cuenta "pendiente" aquí.
 */

interface Fila {
  attemptId: string
  estudiante: string
  intento: number
  estado: 'en_progreso' | 'entregado' | 'calificado' | 'abandonado'
  totalScore: number | null
  pendientes: number
  totalRedacciones: number
}

const ETIQUETA_ESTADO: Record<Fila['estado'], { texto: string; tono: string }> = {
  en_progreso: { texto: 'Presentando ahora', tono: 'bg-zr-blue/15 text-zr-blue-mid' },
  entregado: { texto: 'Por corregir', tono: 'bg-zr-warning/15 text-zr-warning' },
  calificado: { texto: 'Calificado', tono: 'bg-zr-success/15 text-zr-success' },
  abandonado: { texto: 'Abandonado', tono: 'bg-zr-border text-zr-text-muted' },
}

export default function ListaEstudiantesExamen() {
  const router = useRouter()
  const params = useParams()
  const examId = params.examId as string

  const [tituloExamen, setTituloExamen] = useState('')
  const [notaMinima, setNotaMinima] = useState<number | null>(null)
  const [escala, setEscala] = useState(20)
  const [filas, setFilas] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()

      const { data: examen } = await supabase
        .from('exams').select('title, passing_score, max_score').eq('id', examId).maybeSingle()
      if (!examen) { router.replace('/crear-examen'); return }
      setTituloExamen(examen.title)
      setNotaMinima(examen.passing_score != null ? Number(examen.passing_score) : null)
      setEscala(Number(examen.max_score) || 20)

      const { data: intentos } = await supabase
        .from('exam_attempts')
        .select('id, attempt_number, status, total_score, submitted_at, students(profiles!students_id_fkey(full_name))')
        .eq('exam_id', examId)
        .order('submitted_at', { ascending: false })

      const filasIntentos = (intentos ?? []) as unknown as {
        id: string; attempt_number: number; status: Fila['estado']; total_score: number | null
        students: { profiles: { full_name: string } | null } | null
      }[]

      const idsIntentos = filasIntentos.map((i) => i.id)
      const { data: respuestas } = idsIntentos.length
        ? await supabase
            .from('exam_answers')
            .select('attempt_id, awarded_points, exam_questions!inner(type)')
            .in('attempt_id', idsIntentos)
            .eq('exam_questions.type', 'redaccion_abierta')
        : { data: [] }

      const porIntento = new Map<string, { total: number; pendientes: number }>()
      for (const r of respuestas ?? []) {
        const actual = porIntento.get(r.attempt_id) ?? { total: 0, pendientes: 0 }
        actual.total++
        if (r.awarded_points == null) actual.pendientes++
        porIntento.set(r.attempt_id, actual)
      }

      setFilas(
        filasIntentos.map((i) => ({
          attemptId: i.id,
          estudiante: i.students?.profiles?.full_name ?? 'Estudiante',
          intento: i.attempt_number,
          estado: i.status,
          totalScore: i.total_score != null ? Number(i.total_score) : null,
          pendientes: porIntento.get(i.id)?.pendientes ?? 0,
          totalRedacciones: porIntento.get(i.id)?.total ?? 0,
        })),
      )
      setCargando(false)
    }
    cargar()
  }, [examId, router])

  if (cargando) return <PantallaEsqueleto variante="lista" />

  return (
    <div className="space-y-9 px-5 pb-20 pt-14">
      <div className="flex items-center justify-between gap-3">
        <BotonVolver />
        <button
          onClick={() => router.push(`/crear-examen/${examId}`)}
          className="rounded-lg px-3 py-2 text-sm font-bold text-zr-blue-mid"
        >
          Editar examen
        </button>
      </div>

      <Encabezado
        sobretitulo="Calificación"
        titulo={tituloExamen}
        descripcion={
          notaMinima != null
            ? `${filas.length} estudiante${filas.length === 1 ? '' : 's'} · nota mínima ${notaMinima}/${escala}`
            : `${filas.length} estudiante${filas.length === 1 ? '' : 's'}`
        }
      />

      <Regla delay={60} />

      {filas.length === 0 ? (
        <p className="text-sm text-zr-text-muted">Todavía nadie ha presentado este examen.</p>
      ) : (
        <div className="space-y-3">
          {filas.map((f, idx) => {
            const puedeCorregir = f.pendientes > 0
            const aprobo = f.estado === 'calificado' && notaMinima != null && f.totalScore != null && f.totalScore >= notaMinima
            return (
              <div
                key={f.attemptId}
                className="zr-card animate-rise flex items-center justify-between gap-4 p-5"
                style={{ animationDelay: `${60 + idx * 40}ms` }}
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-zr-text">{f.estudiante}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${ETIQUETA_ESTADO[f.estado].tono}`}>
                      {ETIQUETA_ESTADO[f.estado].texto}
                    </span>
                    {f.intento > 1 && <span className="text-xs text-zr-text-muted">Intento {f.intento}</span>}
                    {f.estado === 'calificado' && f.totalScore != null && (
                      <span className={`text-xs font-bold ${aprobo ? 'text-zr-success' : 'text-zr-error'}`}>
                        {f.totalScore.toFixed(2)}/{escala} · {aprobo ? 'Aprobado' : 'Reprobado'}
                      </span>
                    )}
                    {puedeCorregir && (
                      <span className="text-xs text-zr-warning">
                        {f.pendientes} redacción{f.pendientes === 1 ? '' : 'es'} sin revisar
                      </span>
                    )}
                  </div>
                </div>
                {(puedeCorregir || f.totalRedacciones > 0) && f.estado !== 'en_progreso' && (
                  <button
                    onClick={() => router.push(`/calificar/${examId}/${f.attemptId}`)}
                    className="shrink-0 rounded-lg bg-zr-blue px-4 py-2.5 text-sm font-bold text-white"
                  >
                    {puedeCorregir ? 'Corregir' : 'Ver'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
