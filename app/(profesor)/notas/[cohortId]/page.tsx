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
 * como notas (migración 143). Al terminar, el profesor "Confirma y envía": desde ahí queda
 * bloqueado para él y el estudiante NO ve nada hasta que Dirección Académica
 * lo valide (migración 126).
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

interface Envio { status: 'enviado' | 'validado' | 'devuelto'; submittedAt: string; motivo: string | null }

const ABREV_KIND: Record<string, string> = { examen: 'Examen', practica: 'Práctica', prepractica: 'Pre-práctica', exposicion: 'Exposición', participacion: 'Participación', otro: 'Otro' }

const fmt = (v: number | null) => (v === null ? '—' : Number(v).toFixed(v % 1 === 0 ? 0 : 1))

export default function NotasCohorteProfesor() {
  const router = useRouter()
  const params = useParams()
  const cohortId = params.cohortId as string

  const [moduleId, setModuleId] = useState<string | null>(null)
  // Módulos que este profesor puede ver en la cohorte (los que tiene asignados)
  // y el que está mirando. Migración 150: acceso y notas por módulo.
  const [opciones, setOpciones] = useState<{ id: string; orden: number; nombre: string }[]>([])
  const [moduloElegido, setModuloElegido] = useState<string | null>(null)
  const [estadoModulo, setEstadoModulo] = useState<'sin_calendario' | 'no_empezo' | 'en_curso' | 'terminado'>('sin_calendario')
  const [umbral, setUmbral] = useState(12)
  const [sumaPct, setSumaPct] = useState(0)
  const [filas, setFilas] = useState<FilaEstudiante[]>([])
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([])
  // notas[studentId][evalId]
  const [notas, setNotas] = useState<Record<string, Record<string, number | null>>>({})
  const [envio, setEnvio] = useState<Envio | null>(null)
  // Se vuelve a leer todo cuando Dirección registra algo nuevo mientras esta
  // pantalla está abierta (al volver a la pestaña).
  const [version, setVersion] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
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

      const { data: estado } = await supabase.rpc('estado_modulo_cohorte', { p_cohort: cohortId, p_module: modulo })
      if (!vigente) return
      setEstadoModulo((estado as typeof estadoModulo | null) ?? 'sin_calendario')

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
          .select('status, submitted_at, return_reason')
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

      setEnvio(sub ? { status: sub.status as Envio['status'], submittedAt: sub.submitted_at, motivo: sub.return_reason } : null)

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

  // Solo está bloqueado mientras espera la validación. Si Dirección registra
  // una evaluación nueva, el servidor reabre el envío solo (migración 136); y
  // si cambias algo ya validado, también se reabre y hay que volver a enviar.
  // Módulo terminado o que aún no empieza: el profesor solo mira (migración
  // 150); corregir lo hace Dirección Académica.
  const soloLectura = estadoModulo === 'terminado' || estadoModulo === 'no_empezo'
  const bloqueado = envio?.status === 'enviado' || soloLectura

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
    setEnvio((e) => (e?.status === 'validado' ? null : e))
    await releerEstudiante(studentId)
    setGuardando(null)
  }

  async function confirmarEnvio() {
    if (!moduleId) return
    const faltan = filas.reduce(
      (total, f) => total + evaluaciones.filter((e) => notas[f.studentId]?.[e.id] == null).length,
      0,
    )
    const aviso = faltan > 0
      ? `Todavía hay ${faltan} nota${faltan === 1 ? '' : 's'} vacía${faltan === 1 ? '' : 's'}. `
      : ''
    if (!confirm(`${aviso}Al confirmar, las notas se envían a Dirección Académica y ya no podrás cambiarlas. Los estudiantes las verán cuando se validen. ¿Enviar?`)) return

    setEnviando(true)
    setError(null)
    const { error: fallo } = await createClient().rpc('enviar_notas', { p_cohort: cohortId, p_module: moduleId })
    setEnviando(false)
    if (fallo) { setError(fallo.message); return }
    setEnvio({ status: 'enviado', submittedAt: new Date().toISOString(), motivo: null })
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

      {soloLectura && (
        <p className="rounded-lg border border-zr-border bg-zr-surface px-4 py-3 text-sm font-medium text-zr-text">
          {estadoModulo === 'terminado'
            ? 'Este módulo ya terminó: puedes ver las notas, pero solo Dirección Académica las corrige.'
            : 'Este módulo todavía no empieza: aún no se cargan notas.'}
        </p>
      )}

      <button
        onClick={() => router.push('/evaluaciones')}
        className="min-h-12 w-full rounded-lg border border-zr-blue/40 text-sm font-bold text-zr-blue-mid"
      >
        Registrar o editar evaluaciones
      </button>

      {envio?.status === 'devuelto' && (
        <div className="rounded-lg border border-zr-error/30 bg-zr-error/10 px-4 py-3 text-sm text-zr-text">
          <p className="font-bold text-zr-error">Dirección Académica te devolvió las notas</p>
          {envio.motivo && <p className="mt-1 font-medium">{envio.motivo}</p>}
          <p className="mt-1 text-xs text-zr-text-muted">Corrige lo que pide y vuelve a enviarlas.</p>
        </div>
      )}
      {faltaPorcentaje && evaluaciones.length > 0 && (
        <p className="rounded-lg border border-zr-warning/40 bg-zr-warning/10 px-4 py-3 text-sm font-medium text-zr-text">
          Los porcentajes del módulo suman {sumaPct} % y deben sumar 100 %. Mientras tanto no podrás enviar las notas:
          ajusta las evaluaciones en «Registrar o editar evaluaciones».
        </p>
      )}

      {envio?.status === 'enviado' && (
        <p className="rounded-lg border border-zr-blue/30 bg-zr-blue/10 px-4 py-3 text-sm font-medium text-zr-text">
          Enviadas a Dirección Académica el {new Date(envio.submittedAt).toLocaleDateString('es-VE')}.
          Los estudiantes las verán cuando se validen. Si Dirección registra una evaluación nueva, esto
          se reabre solo para que cargues su nota y vuelvas a enviar. Para corregir algo ya enviado,
          pídele a Dirección Académica que las devuelva.
        </p>
      )}
      {envio?.status === 'validado' && (
        <p className="rounded-lg border border-zr-success/30 bg-zr-success/10 px-4 py-3 text-sm font-medium text-zr-success">
          Notas validadas: los estudiantes ya las ven. Si cambias una nota o Dirección registra una
          evaluación nueva, solo esa evaluación queda por validar (tendrás que volver a enviar); lo
          que ya estaba validado se sigue viendo.
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
            <EstadoVacio titulo="Sin evaluaciones registradas" explicacion="Dirección Académica todavía no registró una evaluación para este módulo." />
          )}

          <div className="overflow-x-auto rounded-lg border border-zr-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-zr-surface">
                  <th className="sticky left-0 z-10 min-w-[170px] border-b border-r border-zr-border bg-zr-surface px-3 py-2.5 text-left font-bold text-zr-text">
                    Estudiante
                  </th>
                  {evaluaciones.map((ev) => (
                    <th key={ev.id} className="min-w-[88px] border-b border-zr-border px-2 py-2 text-center align-bottom">
                      <span className="block text-xs font-bold text-zr-text">{ev.title}</span>
                      <span className="block text-[10px] font-normal text-zr-text-muted">
                        {ABREV_KIND[ev.kind] ?? ev.kind} · /{ev.scaleMax} · {ev.pesoPct} %
                      </span>
                    </th>
                  ))}
                  <th className="min-w-[84px] border-b border-l border-zr-border px-2 py-2.5 text-center align-bottom text-xs font-bold text-zr-text-muted">Nota</th>
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
                          type="number" inputMode="decimal" min={0} max={ev.scaleMax} step={0.5}
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
              onClick={confirmarEnvio}
              disabled={enviando}
              className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-50"
            >
              {enviando ? 'Enviando…' : 'Confirmar y enviar a Dirección Académica'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
