'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'

/**
 * Una sola evaluación, una tabla compacta tipo Excel -- pedido explícito del
 * coordinador (sept. 2026) para no tener que hacer scroll por 20+
 * estudiantes dentro de una lista de evaluaciones. teoría/práctica del
 * módulo se recalculan solas al guardar (migración 110); esta pantalla solo
 * escribe la nota de ESTA evaluación.
 */

const ETIQUETA_KIND: Record<string, string> = { examen: 'Examen', practica: 'Práctica', otro: 'Otro' }

interface FilaEstudiante {
  studentId: string
  nombre: string
  cedula: string
  score: number | null
}

export default function NotaDeUnaEvaluacion() {
  const router = useRouter()
  const params = useParams()
  const cohortId = params.cohortId as string
  const evalId = params.evalId as string

  const [titulo, setTitulo] = useState('')
  const [kind, setKind] = useState('')
  const [fecha, setFecha] = useState('')
  const [escala, setEscala] = useState(20)
  const [filas, setFilas] = useState<FilaEstudiante[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardandoId, setGuardandoId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const [{ data: examen }, { data: estudiantes }, { data: notas }] = await Promise.all([
        supabase.from('manual_exam_definitions').select('title, kind, exam_date, scale_max').eq('id', evalId).single(),
        supabase.from('students').select('id, profiles!students_id_fkey(full_name, cedula)').eq('cohort_id', cohortId),
        supabase.from('manual_exam_scores').select('student_id, score').eq('definition_id', evalId),
      ])

      if (!vigente) return

      if (examen) {
        setTitulo(examen.title)
        setKind(examen.kind)
        setFecha(examen.exam_date)
        setEscala(Number(examen.scale_max))
      }

      type EstudianteCrudo = { id: string; profiles: { full_name: string; cedula: string } | null }
      const porEstudiante = new Map((notas ?? []).map((n) => [n.student_id, n.score]))

      setFilas(
        ((estudiantes ?? []) as unknown as EstudianteCrudo[]).map((e) => ({
          studentId: e.id,
          nombre: e.profiles?.full_name ?? '—',
          cedula: e.profiles?.cedula ?? '—',
          score: porEstudiante.get(e.id) ?? null,
        })),
      )
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router, cohortId, evalId])

  async function guardar(studentId: string, valor: number) {
    setGuardandoId(studentId)
    setError(null)
    const supabase = createClient()
    const { error: fallo } = await supabase
      .from('manual_exam_scores')
      .upsert({ definition_id: evalId, student_id: studentId, score: valor }, { onConflict: 'definition_id,student_id' })

    if (fallo) { setError(fallo.message); setGuardandoId(null); return }
    setFilas((fs) => fs.map((f) => f.studentId === studentId ? { ...f, score: valor } : f))
    setGuardandoId(null)
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 px-5 pt-14 pb-10">
      <BotonVolver href={`/notas/${cohortId}`} />

      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
          {ETIQUETA_KIND[kind] ?? kind}
        </p>
        <h1 className="zr-display mt-3 text-3xl text-zr-text">{titulo}</h1>
        <p className="mt-1 text-sm text-zr-text-muted">{fecha} · sobre {escala}</p>
      </header>

      {error && (
        <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
          {error}
        </p>
      )}

      {filas.length === 0 ? (
        <EstadoVacio titulo="Sin estudiantes" explicacion="Esta cohorte todavía no tiene estudiantes." />
      ) : (
        <>
          {/* Computadora: tabla compacta tipo Excel. */}
          <div className="hidden overflow-x-auto rounded-lg border border-zr-border lg:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-zr-surface">
                  <th className="border-b border-r border-zr-border bg-zr-surface px-4 py-2.5 text-left font-bold text-zr-text">
                    Estudiante
                  </th>
                  <th className="min-w-[100px] border-b border-zr-border px-2 py-2.5 text-center font-bold text-zr-text-muted">
                    Nota
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.studentId} className="border-b border-zr-border last:border-b-0">
                    <td className="border-r border-zr-border px-4 py-2">
                      <p className="truncate font-semibold text-zr-text">{f.nombre}</p>
                      <p className="text-xs tabular-nums text-zr-text-muted">{f.cedula}</p>
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="number" min={0} max={escala} step={0.5}
                        defaultValue={f.score ?? ''}
                        onBlur={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) guardar(f.studentId, v) }}
                        disabled={guardandoId === f.studentId}
                        className="w-20 rounded border border-zr-border bg-zr-bg px-2 py-1 text-center text-sm font-semibold text-zr-text focus:border-zr-blue focus:outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Teléfono: fila compacta por estudiante. */}
          <div className="space-y-2 lg:hidden">
            {filas.map((f) => (
              <div key={f.studentId} className="zr-card flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zr-text">{f.nombre}</p>
                  <p className="text-xs tabular-nums text-zr-text-muted">{f.cedula}</p>
                </div>
                <input
                  type="number" min={0} max={escala} step={0.5}
                  defaultValue={f.score ?? ''}
                  onBlur={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) guardar(f.studentId, v) }}
                  disabled={guardandoId === f.studentId}
                  className="w-20 shrink-0 rounded-lg border border-zr-border bg-zr-bg px-2 py-1.5 text-center text-sm font-semibold text-zr-text focus:border-zr-blue focus:outline-none"
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
