'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'

/**
 * T-416 · Marcar competencia dominada.
 *
 * Pensado para marcar UNA competencia a VARIOS estudiantes de una vez, no
 * estudiante por estudiante: se elige la competencia, se marcan las casillas
 * de quienes ya la dominan tras la práctica de taller, y un solo botón lo
 * aplica a todos. Si marcar a 25 personas tomara 25 pasos, el profesor no lo
 * usaría — se seguiría anotando en papel.
 *
 * El disparador fn_mastery_guard exige `dominated_via` al marcar 'dominado'.
 * En Fase 1 solo existe 'evaluacion_practica': es la única fuente que no
 * depende de que el estudiante se autocalifique.
 */

interface Competencia {
  id: string
  nombre: string
  semana: number
}

interface Estudiante {
  id: string
  nombre: string
  cedula: string
}

type Estado = 'no_iniciado' | 'en_progreso' | 'dominado'

export default function MarcarDominio() {
  const router = useRouter()
  const params = useParams()
  const cohortId = params.cohortId as string

  const [competencias, setCompetencias] = useState<Competencia[]>([])
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([])
  const [competenciaId, setCompetenciaId] = useState('')
  // Estado ya guardado en la base, por estudiante, para la competencia elegida.
  const [estadoActual, setEstadoActual] = useState<Map<string, Estado>>(new Map())
  // Selección en pantalla, sin guardar todavía.
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [nombreCohorte, setNombreCohorte] = useState('')

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const [{ data: cohorte }, { data: est }] = await Promise.all([
        supabase.from('cohorts').select('name, current_module_id').eq('id', cohortId).single(),
        supabase.from('v_students').select('id, full_name, cedula').eq('cohort_id', cohortId).order('full_name'),
      ])

      if (!cohorte) {
        // can_see_student() ya lo habría bloqueado en la base; esto es solo
        // para no dejar la pantalla en blanco sin explicación.
        setMensaje('No tienes acceso a esta cohorte, o no existe.')
        setCargando(false)
        return
      }

      setNombreCohorte(cohorte.name)
      setEstudiantes(
        (est ?? [])
          .filter((e): e is { id: string; full_name: string; cedula: string } => e.id !== null)
          .map((e) => ({ id: e.id, nombre: e.full_name, cedula: e.cedula })),
      )

      if (cohorte.current_module_id) {
        const { data: guias } = await supabase
          .from('learning_guides')
          .select('id, sub_competency_name, week_number')
          .eq('module_id', cohorte.current_module_id)
          .order('week_number')
          .order('order_in_week')

        setCompetencias(
          (guias ?? []).map((g) => ({ id: g.id, nombre: g.sub_competency_name, semana: g.week_number })),
        )
        if (guias?.length) setCompetenciaId(guias[0].id)
      }

      setCargando(false)
    }

    cargar()
  }, [cohortId, router])

  useEffect(() => {
    if (!competenciaId || estudiantes.length === 0) return

    const supabase = createClient()

    async function cargarEstado() {
      const { data } = await supabase
        .from('mastery_map')
        .select('student_id, status')
        .eq('learning_guide_id', competenciaId)
        .in('student_id', estudiantes.map((e) => e.id))

      const mapa = new Map<string, Estado>()
      for (const fila of data ?? []) mapa.set(fila.student_id, fila.status as Estado)
      setEstadoActual(mapa)

      // La selección inicial refleja quién ya está marcado como dominado.
      setSeleccion(new Set([...mapa.entries()].filter(([, v]) => v === 'dominado').map(([k]) => k)))
    }

    cargarEstado()
  }, [competenciaId, estudiantes])

  function alternar(id: string) {
    setSeleccion((s) => {
      const copia = new Set(s)
      if (copia.has(id)) copia.delete(id)
      else copia.add(id)
      return copia
    })
  }

  async function guardar() {
    setGuardando(true)
    setMensaje(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Todo o nada por competencia: los seleccionados quedan 'dominado', el
    // resto vuelve a 'en_progreso' si estaba marcado y ya no se seleccionó
    // (permite corregir un marcado accidental sin ir a buscarlo aparte).
    const filas = estudiantes.map((e) => ({
      student_id: e.id,
      learning_guide_id: competenciaId,
      status: seleccion.has(e.id) ? 'dominado' : ('en_progreso' as Estado),
      dominated_via: seleccion.has(e.id) ? 'evaluacion_practica' : null,
      marked_by: user.id,
    }))

    const { error } = await supabase
      .from('mastery_map')
      .upsert(filas as never, { onConflict: 'student_id,learning_guide_id' })

    if (error) {
      setMensaje(error.message)
    } else {
      setMensaje(`Guardado: ${seleccion.size} de ${estudiantes.length} estudiantes marcados como dominado.`)
      setEstadoActual(new Map(estudiantes.map((e) => [e.id, seleccion.has(e.id) ? 'dominado' : 'en_progreso'])))
    }
    setGuardando(false)
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  const competenciaActual = competencias.find((c) => c.id === competenciaId)

  return (
    <div className="space-y-8 px-5 pt-14 pb-8">
      <BotonVolver href="/sesiones" />

      <Encabezado sobretitulo={nombreCohorte || 'Cohorte'} titulo="Marcar dominio" />

      <Regla delay={60} />

      {competencias.length === 0 ? (
        <div className="zr-card p-8 text-center">
          <p className="text-base font-semibold text-zr-text">Sin competencias cargadas</p>
          <p className="mt-2 text-sm text-zr-text-muted">
            Esta cohorte no tiene módulo asignado, o el módulo no tiene guías digitalizadas
            todavía.
          </p>
        </div>
      ) : (
        <>
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Competencia</label>
            <select
              value={competenciaId}
              onChange={(e) => setCompetenciaId(e.target.value)}
              className="w-full rounded-lg border border-zr-border bg-zr-surface px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
            >
              {competencias.map((c) => (
                <option key={c.id} value={c.id}>Semana {c.semana} · {c.nombre}</option>
              ))}
            </select>
          </div>

          <p className="text-sm text-zr-text-muted">
            Marca a quienes ya dominan <strong className="text-zr-text">{competenciaActual?.nombre}</strong> tras
            la práctica de taller. {seleccion.size} de {estudiantes.length} seleccionados.
          </p>

          {mensaje && (
            <p className={`rounded-lg border px-4 py-3 text-sm font-medium ${
              mensaje.startsWith('Guardado')
                ? 'border-zr-success/30 bg-zr-success/12 text-zr-success'
                : 'border-zr-error/30 bg-zr-error/12 text-zr-error'
            }`}>
              {mensaje}
            </p>
          )}

          <div className="space-y-2">
            {estudiantes.map((e) => {
              const marcado = seleccion.has(e.id)
              const previo = estadoActual.get(e.id)
              return (
                <button
                  key={e.id}
                  onClick={() => alternar(e.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                    marcado ? 'border-zr-success/40 bg-zr-success/10' : 'border-zr-border bg-zr-surface'
                  }`}
                >
                  <div
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                      marcado ? 'border-zr-success bg-zr-success text-white' : 'border-zr-border'
                    }`}
                  >
                    {marcado && '✓'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zr-text">{e.nombre}</p>
                    <p className="text-xs tabular-nums text-zr-text-muted">{e.cedula}</p>
                  </div>
                  {previo === 'dominado' && !marcado && (
                    <span className="shrink-0 text-xs font-semibold text-zr-warning">Se desmarcará</span>
                  )}
                </button>
              )
            })}
          </div>

          <button
            onClick={guardar}
            disabled={guardando || estudiantes.length === 0}
            className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-40"
          >
            {guardando ? 'Guardando…' : `Guardar (${seleccion.size} dominado${seleccion.size === 1 ? '' : 's'})`}
          </button>
        </>
      )}
    </div>
  )
}
