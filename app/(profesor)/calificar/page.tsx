'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla } from '@/components/ui/Editorial'

/**
 * T-308 · Cola de calificación de redacciones abiertas.
 *
 * La rúbrica va SIEMPRE a la vista, junto a la respuesta. Es lo único que hace
 * que dos profesores distintos pongan notas parecidas a la misma respuesta.
 * La más antigua primero: si se calificara la más reciente, la primera entrega
 * del sábado sería la última en salir.
 */

interface Pendiente {
  answerId: string
  estudiante: string
  examen: string
  enunciado: string
  rubrica: string | null
  respuesta: string
  puntosMaximos: number
  entregadoHace: string
}

function hace(iso: string): string {
  const horas = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
  if (horas < 1) return 'hace minutos'
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  return `hace ${dias} día${dias > 1 ? 's' : ''}`
}

export default function Calificar() {
  const router = useRouter()
  const [cola, setCola] = useState<Pendiente[]>([])
  const [indice, setIndice] = useState(0)
  const [puntos, setPuntos] = useState<string>('')
  const [comentario, setComentario] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      // Solo redacciones abiertas sin puntaje. Las objetivas ya las calificó
      // la Edge Function submit-attempt al entregar.
      // El nombre no cuelga del intento: exam_attempts.student_id apunta a
      // students, y students.id apunta a profiles. Hay que pasar por las dos.
      const { data, error } = await supabase
        .from('exam_answers')
        .select(`
          id, answer, created_at,
          exam_questions!inner(statement, rubric, points, type),
          exam_attempts!inner(
            submitted_at,
            exams(title),
            students(profiles!students_id_fkey(full_name))
          )
        `)
        .is('awarded_points', null)
        .eq('exam_questions.type', 'redaccion_abierta')
        .order('created_at', { ascending: true })

      if (error) {
        console.error('No se pudo cargar la cola:', error.message)
      }

      const filas = data as unknown as {
        id: string
        answer: { text?: string } | null
        created_at: string
        exam_questions: { statement: string; rubric: string | null; points: number } | null
        exam_attempts: {
          submitted_at: string | null
          exams: { title: string } | null
          students: { profiles: { full_name: string } | null } | null
        } | null
      }[] | null

      if (filas) {
        setCola(
          filas.map((a) => ({
            answerId: a.id,
            estudiante: a.exam_attempts?.students?.profiles?.full_name ?? 'Estudiante',
            examen: a.exam_attempts?.exams?.title ?? 'Examen',
            enunciado: a.exam_questions?.statement ?? '',
            rubrica: a.exam_questions?.rubric ?? null,
            respuesta: a.answer?.text ?? '(sin responder)',
            puntosMaximos: Number(a.exam_questions?.points ?? 0),
            entregadoHace: hace(a.exam_attempts?.submitted_at ?? a.created_at),
          })),
        )
      }

      setCargando(false)
    }

    cargar()
  }, [])

  const actual = cola[indice]

  async function guardar() {
    if (!actual) return

    const valor = Number(puntos)
    if (puntos === '' || Number.isNaN(valor) || valor < 0 || valor > actual.puntosMaximos) {
      setError(`El puntaje tiene que estar entre 0 y ${actual.puntosMaximos}.`)
      return
    }

    setError(null)
    setGuardando(true)

    // La validación real vive en la Edge Function: el navegador no decide notas.
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
    setIndice((i) => i + 1)
    setGuardando(false)
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-zr-text-muted">Cargando la cola…</p>
      </div>
    )
  }

  if (!actual) {
    return (
      <div className="px-5 pt-14">
        <Encabezado sobretitulo="Calificación" titulo="Todo al día" />
        <Regla delay={60} />
        <div className="zr-card mt-10 animate-rise p-10 text-center" style={{ animationDelay: '120ms' }}>
          <p className="text-lg font-semibold text-zr-text">
            {cola.length === 0
              ? 'No hay redacciones esperando'
              : `Calificaste ${cola.length} respuesta${cola.length > 1 ? 's' : ''}`}
          </p>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-zr-text-muted">
            Las preguntas de opción múltiple y verdadero/falso se califican solas al momento de
            entregar. Aquí solo llega lo que necesita tu criterio.
          </p>
          <button
            onClick={() => router.push('/hoy')}
            className="mt-8 rounded-lg bg-zr-blue px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-zr-blue-deep"
          >
            Volver al panel
          </button>
        </div>
      </div>
    )
  }

  const avance = Math.round((indice / cola.length) * 100)

  return (
    <div className="px-5 pt-14">
      <Encabezado
        sobretitulo="Calificación"
        titulo="Redacciones"
        descripcion={`Respuesta ${indice + 1} de ${cola.length} · ${actual.entregadoHace}`}
      />

      <div className="mt-8 h-1 w-full overflow-hidden rounded-full bg-zr-border">
        <div
          className="h-full rounded-full bg-zr-blue transition-all duration-500"
          style={{ width: `${avance}%` }}
        />
      </div>

      <div className="mt-10 space-y-6">
        {/* Quién y de qué examen */}
        <div className="zr-card animate-rise p-6" style={{ animationDelay: '80ms' }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
            Estudiante
          </p>
          <p className="zr-display mt-2 text-2xl text-zr-text">{actual.estudiante}</p>
          <p className="mt-2 text-sm text-zr-text-muted">{actual.examen}</p>
        </div>

        {/* Pregunta */}
        <div className="animate-rise" style={{ animationDelay: '140ms' }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-text-muted">
            Pregunta · {actual.puntosMaximos} puntos
          </p>
          <p className="mt-3 text-lg font-semibold leading-relaxed text-zr-text">
            {actual.enunciado}
          </p>
        </div>

        {/* Rúbrica */}
        {actual.rubrica && (
          <div
            className="animate-rise rounded-lg border border-zr-blue/25 bg-zr-blue/10 p-5"
            style={{ animationDelay: '180ms' }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
              Rúbrica
            </p>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zr-text">
              {actual.rubrica}
            </p>
          </div>
        )}

        {/* Respuesta */}
        <div className="zr-card animate-rise p-6" style={{ animationDelay: '220ms' }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-text-muted">
            Respuesta del estudiante
          </p>
          <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-zr-text">
            {actual.respuesta}
          </p>
        </div>

        {/* Calificación */}
        <div className="zr-card animate-rise space-y-5 p-6" style={{ animationDelay: '260ms' }}>
          <div>
            <label htmlFor="puntos" className="mb-2 block text-sm font-semibold text-zr-text">
              Puntaje (0 – {actual.puntosMaximos})
            </label>
            <input
              id="puntos"
              type="number"
              inputMode="decimal"
              min={0}
              max={actual.puntosMaximos}
              step={0.5}
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
            <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
              {error}
            </p>
          )}

          <button
            onClick={guardar}
            disabled={guardando}
            className="w-full rounded-lg bg-zr-success px-6 py-4 text-base font-bold text-white transition-all hover:bg-zr-success/90 disabled:opacity-50"
          >
            {guardando
              ? 'Guardando…'
              : indice < cola.length - 1
                ? 'Guardar y siguiente'
                : 'Guardar y terminar'}
          </button>
        </div>
      </div>
    </div>
  )
}
