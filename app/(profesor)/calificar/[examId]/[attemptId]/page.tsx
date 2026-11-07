'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'

/**
 * Corrige las redacciones abiertas de UN intento (adaptado de /calificar,
 * que hacía lo mismo pero mezclando TODOS los exámenes -- pedido explícito
 * del coordinador: entrar por estudiante, no por una cola general).
 *
 * La rúbrica va siempre a la vista junto a la respuesta -- es lo que hace
 * que dos profesores distintos pongan notas parecidas a la misma
 * respuesta. Al terminar la última redacción, el servidor (trigger de la
 * migración 176) cierra el intento solo y calcula total_score; aquí se
 * refresca y se muestra aprobado/reprobado contra la nota mínima del
 * examen. Si aprobó, la nota ya quedó en Notas (fusión H.33, migración
 * 193) sin que nadie la cargue a mano. Si no, el estudiante repite según
 * las reglas de intentos/enfriamiento que ya tiene el examen -- eso no
 * cambia aquí.
 */

interface Pendiente {
  answerId: string
  enunciado: string
  rubrica: string | null
  respuesta: string
  puntosMaximos: number
}

export default function CorregirIntento() {
  const router = useRouter()
  const params = useParams()
  const examId = params.examId as string
  const attemptId = params.attemptId as string

  const [estudiante, setEstudiante] = useState('')
  const [tituloExamen, setTituloExamen] = useState('')
  const [notaMinima, setNotaMinima] = useState<number | null>(null)
  const [escala, setEscala] = useState(20)
  const [cola, setCola] = useState<Pendiente[]>([])
  const [indice, setIndice] = useState(0)
  const [puntos, setPuntos] = useState('')
  const [comentario, setComentario] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [resultado, setResultado] = useState<{ totalScore: number | null; estado: string } | null>(null)

  async function cargar() {
    const supabase = createClient()

    const { data: examen } = await supabase
      .from('exams').select('title, passing_score, max_score').eq('id', examId).maybeSingle()
    if (examen) {
      setTituloExamen(examen.title)
      setNotaMinima(examen.passing_score != null ? Number(examen.passing_score) : null)
      setEscala(Number(examen.max_score) || 20)
    }

    const { data: intento } = await supabase
      .from('exam_attempts')
      .select('status, total_score, students(profiles!students_id_fkey(full_name))')
      .eq('id', attemptId).maybeSingle()
    const nombre = (intento as unknown as { students: { profiles: { full_name: string } | null } | null } | null)
      ?.students?.profiles?.full_name
    setEstudiante(nombre ?? 'Estudiante')

    const { data } = await supabase
      .from('exam_answers')
      .select('id, answer, exam_questions!inner(statement, rubric, points, type)')
      .eq('attempt_id', attemptId)
      .eq('exam_questions.type', 'redaccion_abierta')
      .is('awarded_points', null)
      .order('created_at', { ascending: true })

    const filas = (data as unknown as {
      id: string
      answer: { text?: string } | null
      exam_questions: { statement: string; rubric: string | null; points: number } | null
    }[] | null) ?? []

    setCola(
      filas.map((a) => ({
        answerId: a.id,
        enunciado: a.exam_questions?.statement ?? '',
        rubrica: a.exam_questions?.rubric ?? null,
        respuesta: a.answer?.text ?? '(sin responder)',
        puntosMaximos: Number(a.exam_questions?.points ?? 0),
      })),
    )

    // Ya no quedan redacciones pendientes: muestra el resultado final del
    // intento (puede ser la primera carga, si ya estaba todo calificado).
    if (filas.length === 0 && intento) {
      setResultado({ totalScore: intento.total_score != null ? Number(intento.total_score) : null, estado: intento.status })
    }

    setCargando(false)
  }

  useEffect(() => { cargar() }, [attemptId]) // eslint-disable-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps

  const actual = cola[indice]

  async function guardar() {
    if (!actual) return
    const valor = Number(puntos.replace(',', '.'))
    if (puntos === '' || Number.isNaN(valor) || valor < 0 || valor > actual.puntosMaximos) {
      setError(`El puntaje tiene que estar entre 0 y ${actual.puntosMaximos}.`)
      return
    }
    setError(null)
    setGuardando(true)

    // La validación real vive en la Edge Function: el navegador no decide
    // notas. Si era la última redacción, el servidor cierra el intento solo
    // (trigger migración 176) y la nota entra a Notas sola (migración 193).
    const { error: fallo } = await createClient().functions.invoke('grade-answer', {
      body: { answerId: actual.answerId, awardedPoints: valor, feedback: comentario || null },
    })
    if (fallo) {
      setError('No se pudo guardar. Revisa tu conexión e inténtalo otra vez.')
      setGuardando(false)
      return
    }

    setPuntos('')
    setComentario('')
    setGuardando(false)

    if (indice >= cola.length - 1) {
      // Era la última: recarga para traer el resultado final ya cerrado.
      setCargando(true)
      await cargar()
    } else {
      setIndice((i) => i + 1)
    }
  }

  if (cargando) return <PantallaEsqueleto variante="lista" />

  if (resultado) {
    const aprobo = notaMinima != null && resultado.totalScore != null && resultado.totalScore >= notaMinima
    return (
      <div className="space-y-9 px-5 pb-20 pt-[calc(3.5rem+env(safe-area-inset-top))]">
        <BotonVolver href={`/calificar/${examId}`} />
        <Encabezado sobretitulo="Calificación" titulo={estudiante} descripcion={tituloExamen} />
        <Regla delay={60} />
        <div className="zr-card animate-rise space-y-4 p-8 text-center" style={{ animationDelay: '100ms' }}>
          {resultado.totalScore != null ? (
            <>
              <p className="cifra text-5xl font-bold text-zr-text">
                {resultado.totalScore.toFixed(2)}
                <span className="text-xl text-zr-text-muted">/{escala}</span>
              </p>
              {notaMinima != null && (
                <p className={`text-base font-bold ${aprobo ? 'text-zr-success' : 'text-zr-error'}`}>
                  {aprobo ? 'Aprobó la certificación' : 'No alcanzó la nota mínima'}
                </p>
              )}
              <p className="text-sm text-zr-text-muted">
                {aprobo
                  ? 'Ya quedó registrada en Notas de este módulo, sin que tengas que cargarla aparte.'
                  : 'Según las reglas de intentos del examen, el estudiante puede volver a presentarlo después del tiempo de enfriamiento.'}
              </p>
            </>
          ) : (
            <p className="text-sm text-zr-text-muted">Todavía no hay nada pendiente de calificar en este intento.</p>
          )}
          <button
            onClick={() => router.push(`/calificar/${examId}`)}
            className="mt-2 rounded-lg bg-zr-blue px-6 py-3 text-sm font-bold text-white"
          >
            Volver a la lista
          </button>
        </div>
      </div>
    )
  }

  const avance = Math.round((indice / cola.length) * 100)

  return (
    <div className="px-5 pt-[calc(3.5rem+env(safe-area-inset-top))]">
      <BotonVolver href={`/calificar/${examId}`} />

      <div className="mt-7">
        <Encabezado
          sobretitulo="Calificación"
          titulo={estudiante}
          descripcion={`${tituloExamen} · Redacción ${indice + 1} de ${cola.length}`}
        />
      </div>

      <div className="mt-8 h-1 w-full overflow-hidden rounded-full bg-zr-border">
        <div className="h-full rounded-full bg-zr-blue transition-all duration-500" style={{ width: `${avance}%` }} />
      </div>

      <div className="mt-10 space-y-6 pb-20">
        <div className="animate-rise" style={{ animationDelay: '80ms' }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-text-muted">
            Pregunta · {actual.puntosMaximos} puntos
          </p>
          <p className="mt-3 text-lg font-semibold leading-relaxed text-zr-text">{actual.enunciado}</p>
        </div>

        {actual.rubrica && (
          <div className="animate-rise rounded-lg border border-zr-blue/25 bg-zr-blue/10 p-5" style={{ animationDelay: '140ms' }}>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">Rúbrica</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zr-text">{actual.rubrica}</p>
          </div>
        )}

        <div className="zr-card animate-rise p-6" style={{ animationDelay: '180ms' }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-text-muted">Respuesta del estudiante</p>
          <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-zr-text">{actual.respuesta}</p>
        </div>

        <div className="zr-card animate-rise space-y-5 p-6" style={{ animationDelay: '220ms' }}>
          <div>
            <label htmlFor="puntos" className="mb-2 block text-sm font-semibold text-zr-text">
              Puntaje (0 – {actual.puntosMaximos})
            </label>
            <input
              id="puntos"
              type="text"
              inputMode="decimal"
              value={puntos}
              onChange={(e) => setPuntos(e.target.value)}
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-5 py-4 text-2xl font-bold tabular-nums text-zr-text focus:border-zr-blue focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="comentario" className="mb-2 block text-sm font-semibold text-zr-text">
              Comentario para el estudiante
            </label>
            <textarea
              id="comentario"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Qué estuvo bien y qué le faltó…"
              className="min-h-28 w-full resize-none rounded-lg border border-zr-border bg-zr-bg px-4 py-3 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
            />
          </div>
          {error && (
            <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">{error}</p>
          )}
          <button
            onClick={guardar}
            disabled={guardando}
            className="w-full rounded-lg bg-zr-success px-6 py-4 text-base font-bold text-white transition-all hover:bg-zr-success/90 disabled:opacity-50"
          >
            {guardando ? 'Guardando…' : indice < cola.length - 1 ? 'Guardar y siguiente' : 'Guardar y ver resultado'}
          </button>
        </div>
      </div>
    </div>
  )
}
