'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion, Etiqueta } from '@/components/ui/Editorial'

type EstadoExamen = 'oculto' | 'habilitado' | 'cerrado' | 'calificado'

interface Examen {
  id: string
  titulo: string
  estado: EstadoExamen
  modulo: string
  preguntas: number
  puntosAsignados: number
  puntajeMaximo: number
}

/** Forma que devuelve el select de arriba. Las relaciones anidadas de
 *  PostgREST no quedan bien tipadas por los tipos generados, así que se
 *  declara aquí lo que de verdad llega. */
interface FilaExamen {
  id: string
  title: string
  status: EstadoExamen
  max_score: number
  modules: { name: string } | null
  exam_questions: { points: number }[] | null
}

const ESTADO: Record<EstadoExamen, { texto: string; tono: 'exito' | 'neutro' | 'info' | 'aviso' }> = {
  oculto:     { texto: 'Borrador',   tono: 'neutro' },
  habilitado: { texto: 'Publicado',  tono: 'exito'  },
  cerrado:    { texto: 'Cerrado',    tono: 'aviso'  },
  calificado: { texto: 'Calificado', tono: 'info'   },
}

export default function ExamenesProfesor() {
  const router = useRouter()
  const [examenes, setExamenes] = useState<Examen[]>([])
  const [cargando, setCargando] = useState(true)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Se incrementa para volver a pedir la lista después de publicar o duplicar,
  // en vez de llamar a la carga desde el manejador: así el efecto sigue siendo
  // el único sitio que escribe el estado y React no encadena renders.
  const [version, setVersion] = useState(0)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [borrandoLote, setBorrandoLote] = useState(false)

  useEffect(() => {
    let vigente = true

    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data } = await supabase
        .from('exams')
        .select('id, title, status, max_score, module_id, modules(name), exam_questions(points)')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false })

      if (!vigente) return

      const filas = (data ?? []) as unknown as FilaExamen[]

      setExamenes(
        filas.map((e) => ({
          id: e.id,
          titulo: e.title,
          estado: e.status,
          modulo: e.modules?.name ?? 'Módulo',
          preguntas: e.exam_questions?.length ?? 0,
          puntosAsignados: (e.exam_questions ?? []).reduce((s, q) => s + Number(q.points), 0),
          puntajeMaximo: Number(e.max_score),
        })),
      )
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router, version])

  function toggleSeleccion(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function borrarSeleccionados() {
    if (seleccionados.size === 0) return
    const tienenPublicados = [...seleccionados].some(
      (id) => examenes.find((e) => e.id === id)?.estado !== 'oculto',
    )
    if (
      tienenPublicados &&
      !window.confirm(
        '¿Eliminar estos exámenes? Se borrarán también todos los intentos y calificaciones de los estudiantes. Esta acción no se puede deshacer.',
      )
    ) return

    setBorrandoLote(true)
    setError(null)
    const ids = [...seleccionados]

    const res = await fetch('/api/delete-exams', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error ?? 'No se pudieron eliminar los exámenes.')
    } else {
      setExamenes((xs) => xs.filter((x) => !ids.includes(x.id)))
      setSeleccionados(new Set())
    }
    setBorrandoLote(false)
  }

  async function publicar(examen: Examen) {
    setOcupado(examen.id)
    setError(null)

    // La interfaz también valida, pero la garantía real es el disparador
    // trg_validate_exam_publish. Si la base dice que no, se muestra su mensaje.
    const { error: fallo } = await createClient()
      .from('exams')
      .update({ status: 'habilitado', published_at: new Date().toISOString() })
      .eq('id', examen.id)

    if (fallo) {
      setError(fallo.message)
    } else {
      setExamenes((xs) => xs.map((x) => (x.id === examen.id ? { ...x, estado: 'habilitado' } : x)))
    }
    setOcupado(null)
  }

  async function duplicar(examen: Examen) {
    setOcupado(examen.id)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: original } = await supabase
      .from('exams')
      .select('*')
      .eq('id', examen.id)
      .single()

    if (!original) {
      setOcupado(null)
      return
    }

    const { data: copia, error: falloExamen } = await supabase
      .from('exams')
      .insert({
        title: `${original.title} (copia)`,
        module_id: original.module_id,
        cohort_id: original.cohort_id,
        teacher_id: user.id,
        instructions: original.instructions,
        max_score: original.max_score,
        passing_score: original.passing_score,
        duration_minutes: original.duration_minutes,
        status: 'oculto',
      })
      .select()
      .single()

    if (falloExamen || !copia) {
      setError(falloExamen?.message ?? 'No se pudo duplicar el examen.')
      setOcupado(null)
      return
    }

    const { data: preguntas } = await supabase
      .from('exam_questions')
      .select('*')
      .eq('exam_id', examen.id)

    if (preguntas?.length) {
      await supabase.from('exam_questions').insert(
        preguntas.map((q) => ({
          exam_id: copia.id,
          order_index: q.order_index,
          type: q.type,
          statement: q.statement,
          options: q.options,
          correct_answer: q.correct_answer,
          points: q.points,
          rubric: q.rubric,
          learning_guide_id: q.learning_guide_id,
        })),
      )
    }

    setVersion((v) => v + 1)
    setOcupado(null)
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-zr-text-muted">Cargando exámenes…</p>
      </div>
    )
  }

  const borradores = examenes.filter((e) => e.estado === 'oculto')
  const publicados = examenes.filter((e) => e.estado !== 'oculto')

  const esBorrador = (e: Examen) => e.estado === 'oculto'

  const Tarjeta = ({ e, i }: { e: Examen; i: number }) => {
    const cuadran = e.puntosAsignados === e.puntajeMaximo
    const seleccionado = seleccionados.has(e.id)
    return (
      <div
        className={`zr-card animate-rise overflow-hidden transition-all ${seleccionado ? 'ring-2 ring-zr-blue' : ''}`}
        style={{ animationDelay: `${60 * i}ms` }}
      >
        <div className="p-5">
          <div className="flex items-start gap-3">
            {/* Checkbox — solo en borradores */}
            <input
              type="checkbox"
              checked={seleccionado}
              onChange={() => toggleSeleccion(e.id)}
              className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-zr-blue"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-bold text-zr-text">{e.titulo}</h3>
                <Etiqueta tono={ESTADO[e.estado].tono}>{ESTADO[e.estado].texto}</Etiqueta>
              </div>
              <p className="mt-0.5 text-sm text-zr-text-muted">{e.modulo}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-6 border-t border-zr-border/60 pt-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zr-text-muted">Preguntas</p>
              <p className="zr-metric mt-1 text-xl text-zr-text">{e.preguntas}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zr-text-muted">Puntos</p>
              <p className={`zr-metric mt-1 text-xl ${cuadran ? 'text-zr-success' : 'text-zr-error'}`}>
                {e.puntosAsignados} / {e.puntajeMaximo}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-zr-border bg-zr-bg/40 p-4">
          {esBorrador(e) ? (
            <>
              <button
                onClick={() => publicar(e)}
                disabled={ocupado === e.id || !cuadran || e.preguntas === 0}
                title={!cuadran ? 'Los puntos tienen que sumar el puntaje máximo' : undefined}
                className="flex-1 rounded-lg bg-zr-success px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-zr-success/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {ocupado === e.id ? 'Publicando…' : 'Publicar'}
              </button>
              <button
                onClick={() => router.push(`/crear-examen/${e.id}`)}
                disabled={ocupado === e.id}
                className="rounded-lg border border-zr-blue px-4 py-3 text-sm font-semibold text-zr-blue transition-colors hover:bg-zr-blue/8 disabled:opacity-40"
              >
                Editar
              </button>
              <button
                onClick={() => duplicar(e)}
                disabled={ocupado === e.id}
                className="rounded-lg border border-zr-border px-4 py-3 text-sm font-semibold text-zr-text transition-colors hover:border-zr-blue/30 disabled:opacity-40"
              >
                Duplicar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => duplicar(e)}
                disabled={ocupado === e.id}
                className="flex-1 rounded-lg border border-zr-border px-4 py-3 text-sm font-semibold text-zr-text transition-colors hover:border-zr-blue/45 disabled:opacity-40"
              >
                {ocupado === e.id ? 'Duplicando…' : 'Duplicar para otra cohorte'}
              </button>
              <button
                onClick={async () => {
                  if (!window.confirm(
                    '¿Eliminar este examen? Se borrarán todos los intentos y calificaciones de los estudiantes.',
                  )) return
                  setOcupado(e.id)
                  setError(null)
                  const res = await fetch('/api/delete-exams', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: [e.id] }),
                  })
                  if (!res.ok) {
                    const body = await res.json().catch(() => ({}))
                    setError(body.error ?? 'No se pudo eliminar el examen.')
                  } else {
                    setExamenes((xs) => xs.filter((x) => x.id !== e.id))
                  }
                  setOcupado(null)
                }}
                disabled={ocupado === e.id}
                className="rounded-lg border border-zr-error/60 px-4 py-3 text-sm font-semibold text-zr-error transition-colors hover:bg-zr-error/8 disabled:opacity-40"
              >
                Eliminar
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14">
      <Encabezado
        sobretitulo="Docencia"
        titulo="Exámenes"
        descripcion={`${examenes.length} en total · ${borradores.length} sin publicar`}
        accion={
          <button
            onClick={() => router.push('/crear-examen/nuevo')}
            className="rounded-lg bg-zr-blue px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-zr-blue-deep"
          >
            Crear examen
          </button>
        }
      />

      {/* Barra de selección masiva */}
      {seleccionados.size > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-zr-error/30 bg-zr-error/10 px-5 py-4">
          <p className="text-sm font-semibold text-zr-error">
            {seleccionados.size} {seleccionados.size === 1 ? 'examen seleccionado' : 'exámenes seleccionados'}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setSeleccionados(new Set())}
              className="rounded-lg border border-zr-border px-4 py-2 text-sm font-semibold text-zr-text"
            >
              Cancelar
            </button>
            <button
              onClick={borrarSeleccionados}
              disabled={borrandoLote}
              className="rounded-lg bg-zr-error px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {borrandoLote ? 'Borrando…' : 'Eliminar seleccionados'}
            </button>
          </div>
        </div>
      )}

      <Regla delay={60} />

      {error && (
        <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
          {error}
        </p>
      )}

      {examenes.length === 0 ? (
        <div className="zr-card animate-rise p-12 text-center" style={{ animationDelay: '120ms' }}>
          <p className="text-lg font-semibold text-zr-text">Todavía no has creado exámenes</p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zr-text-muted">
            Un examen se arma una vez y se duplica para cada cohorte. Las preguntas de opción
            múltiple y verdadero/falso se califican solas; tú solo revisas las redacciones.
          </p>
          <button
            onClick={() => router.push('/crear-examen/nuevo')}
            className="mt-8 rounded-lg bg-zr-blue px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-zr-blue-deep"
          >
            Crear el primero
          </button>
        </div>
      ) : (
        <>
          {borradores.length > 0 && (
            <Seccion numero={1} titulo="Sin publicar" delay={120}>
              <div className="space-y-4">
                {borradores.map((e, i) => <Tarjeta key={e.id} e={e} i={i} />)}
              </div>
            </Seccion>
          )}

          {publicados.length > 0 && (
            <Seccion
              numero={borradores.length > 0 ? 2 : 1}
              titulo="Publicados"
              delay={borradores.length > 0 ? 220 : 120}
            >
              <div className="space-y-4">
                {publicados.map((e, i) => <Tarjeta key={e.id} e={e} i={i} />)}
              </div>
            </Seccion>
          )}
        </>
      )}
    </div>
  )
}
