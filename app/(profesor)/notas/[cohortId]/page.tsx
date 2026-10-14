'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'

/**
 * Notas del profesor -- reunión de sept. 2026: UNA sola tabla tipo Excel por
 * programa, con todo el curso en una vista (una columna por cada evaluación
 * que registró Dirección Académica + Participación y Nota), en vez de entrar
 * y salir de una pantalla por evaluación. Reunión de oct. 2026: cada
 * evaluación lleva un porcentaje; ya no hay Teoría / Práctica / Puntualidad
 * como notas (migración 143).
 *
 * Reunión del 13 oct. 2026: el profesor publica directo, sin esperar a
 * Dirección Académica — "Revisar" (confirmación) y "Publicar" (migración
 * 167). El estudiante la ve de inmediato. Mientras el módulo está en curso
 * corrige sin límite; al terminar, tiene una semana más antes de que se
 * cierre para él (solo Dirección Académica corrige de ahí en adelante).
 *
 * La nota se calcula sola en el servidor -- de solo lectura aquí (regla 2 de
 * CLAUDE.md). Lo que el profesor escribe: la nota de cada evaluación y la
 * participación en clase.
 */

interface Evaluacion { id: string; title: string; examDate: string; kind: string; scaleMax: number; passingMin: number; pesoPct: number }

interface FilaEstudiante {
  studentId: string
  nombre: string
  cedula: string
  finalScore: number | null
  evaluadoPct: number
}

// Lo que ya está publicado para este módulo, si lo está.
interface Publicacion { publishedAt: string | null }

const ABREV_KIND: Record<string, string> = { examen: 'Examen', practica: 'Práctica', prepractica: 'Pre-práctica', exposicion: 'Exposición', participacion: 'Participación', otro: 'Otro' }

const fmt = (v: number | null) => (v === null ? '—' : Number(v).toFixed(2))

export default function NotasCohorteProfesor() {
  const router = useRouter()
  const params = useParams()
  const cohortId = params.cohortId as string

  const [moduleId, setModuleId] = useState<string | null>(null)
  // Módulos que este profesor puede ver en la cohorte (los que tiene asignados)
  // y el que está mirando. Migración 150: acceso y notas por módulo.
  const [opciones, setOpciones] = useState<{ id: string; orden: number; nombre: string }[]>([])
  // Viene preelegido desde el selector de programa y módulo (?modulo=).
  const [moduloElegido, setModuloElegido] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('modulo'))
  const [estadoModulo, setEstadoModulo] = useState<'sin_calendario' | 'no_empezo' | 'en_curso' | 'terminado'>('sin_calendario')
  // Si puede cargar/publicar AHORA (migración 167): en curso siempre, terminado
  // solo dentro de la semana de gracia, no_empezo nunca.
  const [puedeEditar, setPuedeEditar] = useState(true)
  const [umbral, setUmbral] = useState(12)
  const [sumaPct, setSumaPct] = useState(0)
  const [filas, setFilas] = useState<FilaEstudiante[]>([])
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([])
  // notas[studentId][evalId]
  const [notas, setNotas] = useState<Record<string, Record<string, number | null>>>({})
  const [publicado, setPublicado] = useState<Publicacion | null>(null)
  // Se vuelve a leer todo cuando algo cambia mientras esta pantalla está
  // abierta (al volver a la pestaña).
  const [version, setVersion] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [publicando, setPublicando] = useState(false)
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

      const { data: cohorte } = await supabase
        .from('cohorts').select('current_module_id, program_id').eq('id', cohortId).single()
      if (!vigente) return

      // Módulos asignados a este profesor dentro del programa de la cohorte.
      const { data: asig } = await supabase
        .from('teacher_module_assignments')
        .select('modules!inner(id, name, order_index, program_id)')
        .eq('teacher_id', user.id)
        .eq('modules.program_id', cohorte?.program_id ?? '')
        .or(`cohort_id.is.null,cohort_id.eq.${cohortId}`)
      const lista = ((asig ?? []) as unknown as { modules: { id: string; name: string; order_index: number } }[])
        .map((a) => ({ id: a.modules.id, orden: a.modules.order_index, nombre: a.modules.name }))
        .sort((x, y) => x.orden - y.orden)
      if (!vigente) return
      setOpciones(lista)

      // Por defecto: el módulo vigente si es suyo; si no, el último que tiene asignado.
      const porDefecto = lista.some((m) => m.id === cohorte?.current_module_id)
        ? cohorte?.current_module_id ?? null
        : lista[lista.length - 1]?.id ?? cohorte?.current_module_id ?? null
      const modulo = moduloElegido && (lista.length === 0 || lista.some((m) => m.id === moduloElegido)) ? moduloElegido : porDefecto
      setModuleId(modulo)
      if (!modulo) { setCargando(false); return }

      const [{ data: estado }, { data: editable }] = await Promise.all([
        supabase.rpc('estado_modulo_cohorte', { p_cohort: cohortId, p_module: modulo }),
        supabase.rpc('profesor_puede_editar_notas', { p_cohort: cohortId, p_module: modulo }),
      ])
      if (!vigente) return
      setEstadoModulo((estado as typeof estadoModulo | null) ?? 'sin_calendario')
      setPuedeEditar(editable ?? false)

      const [{ data: estudiantes }, { data: matriculas }, { data: exs }, { data: sub }] = await Promise.all([
        supabase.from('students').select('id, profiles!students_id_fkey(full_name, cedula)').eq('cohort_id', cohortId),
        supabase
          .from('module_enrollments')
          .select('student_id, final_score, evaluated_pct, passing_threshold')
          .eq('cohort_id', cohortId)
          .eq('module_id', modulo),
        supabase
          .from('manual_exam_definitions')
          .select('id, title, exam_date, kind, scale_max, passing_min, weight_pct')
          .eq('module_id', modulo)
          .order('exam_date'),
        supabase
          .from('grade_submissions')
          .select('status, validated_at')
          .eq('cohort_id', cohortId)
          .eq('module_id', modulo)
          .maybeSingle(),
      ])

      const defs = (exs ?? []) as { id: string; title: string; exam_date: string; kind: string; scale_max: number; passing_min: number; weight_pct: number }[]
      const { data: scores } = defs.length
        ? await supabase.from('manual_exam_scores').select('definition_id, student_id, score').in('definition_id', defs.map((d) => d.id))
        : { data: [] }

      if (!vigente) return

      type EstudianteCrudo = { id: string; profiles: { full_name: string; cedula: string } | null }
      type MatriculaCruda = {
        student_id: string; final_score: number | null
        evaluated_pct: number; passing_threshold: number
      }
      const porEstudiante = new Map(((matriculas ?? []) as unknown as MatriculaCruda[]).map((n) => [n.student_id, n]))

      setEvaluaciones(defs.map((e) => ({
        id: e.id, title: e.title, examDate: e.exam_date, kind: e.kind, scaleMax: Number(e.scale_max),
        passingMin: Number(e.passing_min), pesoPct: Number(e.weight_pct),
      })))
      setSumaPct(defs.reduce((t, d) => t + Number(d.weight_pct), 0))
      const algunaMatricula = (matriculas ?? [])[0] as unknown as MatriculaCruda | undefined
      if (algunaMatricula) setUmbral(Number(algunaMatricula.passing_threshold))

      const mapa: Record<string, Record<string, number | null>> = {}
      for (const s of (scores ?? []) as { definition_id: string; student_id: string; score: number }[]) {
        ;(mapa[s.student_id] ??= {})[s.definition_id] = Number(s.score)
      }
      setNotas(mapa)

      setPublicado(sub?.status === 'validado' ? { publishedAt: sub.validated_at } : null)

      setFilas(
        ((estudiantes ?? []) as unknown as EstudianteCrudo[]).map((e) => {
          const n = porEstudiante.get(e.id)
          return {
            studentId: e.id,
            nombre: e.profiles?.full_name ?? '—',
            cedula: e.profiles?.cedula ?? '—',
            finalScore: n?.final_score === null || n?.final_score === undefined ? null : Number(n.final_score),
            evaluadoPct: Number(n?.evaluated_pct ?? 0),
          }
        }),
      )
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router, cohortId, version, moduloElegido])

  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === 'visible') setVersion((v) => v + 1) }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
    }
  }, [])

  // Solo se bloquea cuando ya no se puede editar: un módulo que no empieza, o
  // uno terminado hace más de una semana (migración 167).
  const bloqueado = !puedeEditar

  // Después de guardar una nota, el servidor ya recalculó la nota final:
  // se vuelve a leer de la base, nunca se suma aquí.
  async function releerEstudiante(studentId: string) {
    if (!moduleId) return
    const { data } = await createClient()
      .from('module_enrollments')
      .select('final_score, evaluated_pct')
      .eq('student_id', studentId).eq('cohort_id', cohortId).eq('module_id', moduleId)
      .maybeSingle()
    if (!data) return
    setFilas((fs) => fs.map((f) => f.studentId === studentId
      ? { ...f, finalScore: data.final_score === null ? null : Number(data.final_score), evaluadoPct: Number(data.evaluated_pct) }
      : f))
  }

  async function guardarNota(studentId: string, ev: Evaluacion, texto: string) {
    if (bloqueado) return
    const clave = `${studentId}:${ev.id}`
    const previo = notas[studentId]?.[ev.id] ?? null
    const valor = texto.trim() === '' ? null : parseFloat(texto.replace(',', '.'))

    if (valor !== null && (Number.isNaN(valor) || valor < 0 || valor > ev.scaleMax)) {
      setError(`La nota de "${ev.title}" debe estar entre 0 y ${ev.scaleMax}.`)
      return
    }
    if (valor === previo) return

    setGuardando(clave)
    setError(null)
    const supabase = createClient()
    const { error: fallo } = valor === null
      ? await supabase.from('manual_exam_scores').delete().eq('definition_id', ev.id).eq('student_id', studentId)
      : await supabase.from('manual_exam_scores')
          .upsert({ definition_id: ev.id, student_id: studentId, score: valor }, { onConflict: 'definition_id,student_id' })
    if (fallo) {
      setError(fallo.message)
      setGuardando(null)
      return
    }
    setNotas((n) => ({ ...n, [studentId]: { ...n[studentId], [ev.id]: valor } }))
    // Al cambiar algo ya publicado, el servidor reabre esa evaluación: hay que
    // volver a revisar y publicar.
    setPublicado(null)
    await releerEstudiante(studentId)
    setGuardando(null)
  }

  // Dos pasos, como se pidió: "Revisar" muestra un resumen y pide confirmar;
  // "Publicar" (este, al confirmar) deja la nota visible al estudiante ya mismo.
  async function revisarYPublicar() {
    if (!moduleId) return
    const faltan = filas.reduce(
      (total, f) => total + evaluaciones.filter((e) => notas[f.studentId]?.[e.id] == null).length,
      0,
    )
    const aviso = faltan > 0
      ? `Todavía hay ${faltan} nota${faltan === 1 ? '' : 's'} vacía${faltan === 1 ? '' : 's'}. `
      : ''
    if (!confirm(`${aviso}Vas a publicar las notas de ${filas.length} estudiante${filas.length === 1 ? '' : 's'}. Las van a ver de inmediato. ¿Publicar?`)) return

    setPublicando(true)
    setError(null)
    const { error: fallo } = await createClient().rpc('publicar_notas_profesor', { p_cohort: cohortId, p_module: moduleId })
    setPublicando(false)
    if (fallo) { setError(fallo.message); return }
    setPublicado({ publishedAt: new Date().toISOString() })
  }

  if (cargando) {
    return (
      <PantallaEsqueleto />
    )
  }

  const celda = 'w-16 rounded border border-zr-border bg-zr-bg px-1 py-1.5 text-center text-sm focus:border-zr-blue focus:outline-none disabled:opacity-60'
  // Menos del mínimo en rojo, el mínimo o más en verde (reunión oct. 2026).
  const tonoNota = (v: number | undefined, min: number) =>
    v === undefined ? 'text-zr-text' : v < min ? 'text-zr-error' : 'text-zr-success'
  const faltaPorcentaje = Math.round(sumaPct * 100) !== 10000

  return (
    <div className="space-y-6 px-5 pt-14 pb-10">
      <BotonVolver href="/hoy" />

      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">Notas</p>
        <h1 className="zr-display mt-3 text-3xl text-zr-text">Tus estudiantes</h1>
        <p className="mt-2 text-sm text-zr-text-muted">
          Llena la tabla a tu ritmo. Cada evaluación vale un porcentaje de la nota del módulo y la nota se calcula sola, con lo que ya cargaste. La participación es una evaluación más.
        </p>
      </header>

      {opciones.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {opciones.map((m) => (
            <button
              key={m.id}
              onClick={() => { setCargando(true); setModuloElegido(m.id) }}
              className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
                m.id === moduleId ? 'border-zr-blue bg-zr-blue/15 text-zr-blue' : 'border-zr-border text-zr-text-muted'
              }`}
            >
              Módulo {m.orden} · {m.nombre}
            </button>
          ))}
        </div>
      )}

      {bloqueado && (
        <p className="rounded-lg border border-zr-border bg-zr-surface px-4 py-3 text-sm font-medium text-zr-text">
          {estadoModulo === 'no_empezo'
            ? 'Este módulo todavía no empieza: aún no se cargan notas.'
            : 'Ya pasó la semana para corregir este módulo: pídele a Dirección Académica que la corrija.'}
        </p>
      )}

      <button
        onClick={() => router.push('/evaluaciones')}
        className="min-h-12 w-full rounded-lg border border-zr-blue/40 text-sm font-bold text-zr-blue-mid"
      >
        Registrar o editar evaluaciones
      </button>

      {faltaPorcentaje && evaluaciones.length > 0 && (
        <p className="rounded-lg border border-zr-warning/40 bg-zr-warning/10 px-4 py-3 text-sm font-medium text-zr-text">
          Los porcentajes del módulo suman {sumaPct} % y deben sumar 100 %. Mientras tanto no podrás publicar las notas:
          ajusta las evaluaciones en «Registrar o editar evaluaciones».
        </p>
      )}

      {publicado && (
        <p className="rounded-lg border border-zr-success/30 bg-zr-success/10 px-4 py-3 text-sm font-medium text-zr-success">
          Publicadas: los estudiantes ya las ven. Si cambias una nota o registras una evaluación nueva,
          solo esa evaluación deja de verse hasta que vuelvas a revisar y publicar.
        </p>
      )}
      {!publicado && !bloqueado && evaluaciones.length > 0 && (
        <p className="rounded-lg border border-zr-blue/30 bg-zr-blue/10 px-4 py-3 text-sm font-medium text-zr-text">
          Todavía no publicadas: los estudiantes no ven nada de este módulo hasta que le des a «Revisar y publicar».
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
          {error}
        </p>
      )}

      {!moduleId ? (
        <EstadoVacio titulo="Sin módulo activo" explicacion="Esta cohorte no tiene un módulo en curso asignado." />
      ) : filas.length === 0 ? (
        <EstadoVacio titulo="Sin estudiantes" explicacion="Esta cohorte todavía no tiene estudiantes." />
      ) : (
        <>
          {evaluaciones.length === 0 && (
            <EstadoVacio titulo="Sin evaluaciones registradas" explicacion="Todavía no registraste una evaluación para este módulo." />
          )}

          {/* max-h + overflow-y propio: así la fila de encabezado (sticky top-0)
              queda fija al bajar por los estudiantes, y la columna de estudiante
              (sticky left-0) sigue fija al moverse de lado a lado. */}
          <div className="max-h-[65dvh] overflow-auto rounded-lg border border-zr-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-zr-surface">
                  <th className="sticky left-0 top-0 z-20 min-w-[170px] border-b border-r border-zr-border bg-zr-surface px-3 py-2.5 text-left font-bold text-zr-text">
                    Estudiante
                  </th>
                  {evaluaciones.map((ev) => (
                    <th key={ev.id} className="sticky top-0 z-10 min-w-[88px] border-b border-zr-border bg-zr-surface px-2 py-2 text-center align-bottom">
                      <span className="block text-xs font-bold text-zr-text">{ev.title}</span>
                      <span className="block text-[10px] font-normal text-zr-text-muted">
                        {ABREV_KIND[ev.kind] ?? ev.kind} · /{ev.scaleMax} · {ev.pesoPct} %
                      </span>
                    </th>
                  ))}
                  <th className="sticky top-0 z-10 min-w-[84px] border-b border-l border-zr-border bg-zr-surface px-2 py-2.5 text-center align-bottom text-xs font-bold text-zr-text-muted">Nota</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.studentId} className="border-b border-zr-border last:border-b-0">
                    <td className="sticky left-0 z-10 border-r border-zr-border bg-zr-surface px-3 py-2">
                      <p className="truncate text-sm font-semibold text-zr-text">{f.nombre}</p>
                      <p className="text-xs tabular-nums text-zr-text-muted">{f.cedula}</p>
                    </td>
                    {evaluaciones.map((ev) => (
                      <td key={ev.id} className="px-2 py-2 text-center">
                        <input
                          key={`${f.studentId}-${ev.id}-${notas[f.studentId]?.[ev.id] ?? ''}`}
                          type="text" inputMode="decimal"
                          defaultValue={notas[f.studentId]?.[ev.id] ?? ''}
                          onBlur={(e) => guardarNota(f.studentId, ev, e.target.value)}
                          disabled={bloqueado || guardando === `${f.studentId}:${ev.id}`}
                          className={`${celda} ${tonoNota(notas[f.studentId]?.[ev.id] ?? undefined, ev.passingMin)}`}
                        />
                      </td>
                    ))}
                    <td className="border-l border-zr-border px-2 py-2 text-center">
                      {f.finalScore === null ? (
                        <span className="text-zr-text-muted">—</span>
                      ) : (
                        <>
                          {/* En progreso: puntos ganados de los que ya se evaluaron.
                              Completo (100 %): la nota final del módulo. */}
                          <span className={`font-bold ${tonoNota(f.finalScore * 100 / Math.max(f.evaluadoPct, 1), umbral)}`}>
                            {fmt(f.finalScore)}
                          </span>
                          <span className="block text-[10px] leading-tight text-zr-text-muted">
                            {f.evaluadoPct >= 100 ? 'final' : `de ${fmt(Math.round(f.evaluadoPct * 20) / 100)}`}
                          </span>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!bloqueado && (
            <button
              onClick={revisarYPublicar}
              disabled={publicando}
              className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-50"
            >
              {publicando ? 'Publicando…' : 'Revisar y publicar'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
