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

  const Tarjeta = ({ e, i }: { e: Examen; i: number }) => {
    const cuadran = e.puntosAsignados === e.puntajeMaximo
    return (
      <div
        className="zr-card zr-card-interactive animate-rise overflow-hidden"
        style={{ animationDelay: `${60 * i}ms` }}
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-zr-text">{e.titulo}</h3>
              <p className="mt-1 text-sm text-zr-text-muted">{e.modulo}</p>
            </div>
            <Etiqueta tono={ESTADO[e.estado].tono}>{ESTADO[e.estado].texto}</Etiqueta>
          </div>

          <div className="mt-5 flex flex-wrap gap-6 border-t border-zr-border/60 pt-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zr-text-muted">
                Preguntas
              </p>
              <p className="zr-metric mt-1 text-xl text-zr-text">{e.preguntas}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zr-text-muted">
                Puntos
              </p>
              <p className={`zr-metric mt-1 text-xl ${cuadran ? 'text-zr-success' : 'text-zr-error'}`}>
                {e.puntosAsignados} / {e.puntajeMaximo}
              </p>
            </div>
          </div>
        </div>

        {e.estado === 'oculto' && (
          <div className="flex gap-2 border-t border-zr-border bg-zr-bg/40 p-4">
            <button
              onClick={() => publicar(e)}
              disabled={ocupado === e.id || !cuadran || e.preguntas === 0}
              title={!cuadran ? 'Los puntos de las preguntas tienen que sumar el puntaje máximo' : undefined}
              className="flex-1 rounded-lg bg-zr-success px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-zr-success/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {ocupado === e.id ? 'Trabajando…' : 'Publicar'}
            </button>
            <button
              onClick={() => duplicar(e)}
              disabled={ocupado === e.id}
              className="flex-1 rounded-lg border border-zr-border px-4 py-3 text-sm font-semibold text-zr-text transition-colors hover:border-zr-blue/45 disabled:opacity-40"
            >
              Duplicar
            </button>
          </div>
        )}

        {e.estado !== 'oculto' && (
          <div className="border-t border-zr-border bg-zr-bg/40 p-4">
            <button
              onClick={() => duplicar(e)}
              disabled={ocupado === e.id}
              className="w-full rounded-lg border border-zr-border px-4 py-3 text-sm font-semibold text-zr-text transition-colors hover:border-zr-blue/45 disabled:opacity-40"
            >
              {ocupado === e.id ? 'Duplicando…' : 'Duplicar para otra cohorte'}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-12 px-6 py-12 lg:px-10 lg:py-16">
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
