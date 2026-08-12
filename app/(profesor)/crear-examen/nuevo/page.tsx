'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { QuestionEditor } from '@/components/QuestionEditor'
import { Encabezado, Regla, Seccion, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'

type TipoPregunta = 'opcion_multiple' | 'verdadero_falso' | 'redaccion_abierta'

interface Pregunta {
  id: string
  type: TipoPregunta
  statement: string
  points: number
  options?: Array<{ key: string; text: string }>
  correct_answer?: unknown
  rubric?: string | null
}

const TIPOS: { valor: TipoPregunta; titulo: string; explicacion: string }[] = [
  { valor: 'opcion_multiple',   titulo: 'Opción múltiple',  explicacion: 'De 2 a 6 opciones. Se califica sola.' },
  { valor: 'verdadero_falso',   titulo: 'Verdadero o falso', explicacion: 'Dos opciones. Se califica sola.' },
  { valor: 'redaccion_abierta', titulo: 'Redacción abierta', explicacion: 'La calificas tú con una rúbrica.' },
]

const ETIQUETA_TIPO: Record<TipoPregunta, string> = {
  opcion_multiple: 'Opción múltiple',
  verdadero_falso: 'Verdadero/falso',
  redaccion_abierta: 'Redacción',
}

export default function NuevoExamen() {
  const router = useRouter()

  const [titulo, setTitulo] = useState('')
  const [instrucciones, setInstrucciones] = useState('')
  const [moduloId, setModuloId] = useState('')
  const [modulos, setModulos] = useState<{ id: string; name: string }[]>([])
  const [cohorteId, setCohorteId] = useState('')
  const [cohortes, setCohortes] = useState<{ id: string; name: string }[]>([])
  const [puntajeMaximo, setPuntajeMaximo] = useState(20)
  const [duracion, setDuracion] = useState<number | ''>(10)

  const [preguntas, setPreguntas] = useState<Pregunta[]>([])
  const [editorAbierto, setEditorAbierto] = useState<TipoPregunta | null>(null)
  const [eligiendoTipo, setEligiendoTipo] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [transcribiendo, setTranscribiendo] = useState(false)
  const [errorPdf, setErrorPdf] = useState<string | null>(null)
  const archivoRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Solo las cohortes que este profesor dicta. Sin este filtro, el
      // selector mostraba TODAS las cohortes de la academia y el profesor
      // podía terminar publicando un examen en la clase de otro profesor.
      const [{ data: mods }, { data: cohs }] = await Promise.all([
        supabase.from('modules').select('id, name').order('order_index'),
        supabase.from('cohorts').select('id, name').eq('status', 'activa').eq('teacher_id', user.id),
      ])

      setModulos(mods ?? [])
      setCohortes(cohs ?? [])
      if (mods?.length) setModuloId(mods[0].id)
      if (cohs?.length) setCohorteId(cohs[0].id)
    }

    cargar()
  }, [])

  const puntosAsignados = preguntas.reduce((s, q) => s + q.points, 0)
  const puntosCuadran = puntosAsignados === puntajeMaximo
  const sePuedeGuardar = titulo.trim() !== '' && moduloId !== '' && preguntas.length > 0

  async function importarPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setTranscribiendo(true)
    setErrorPdf(null)

    try {
      // Extraer texto del PDF en el navegador con pdfjs-dist — evita parsear
      // binarios en el servidor donde los entornos serverless lo bloquean.
      const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
      GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.mjs',
        import.meta.url,
      ).toString()

      const arrayBuffer = await file.arrayBuffer()
      const pdf = await getDocument({ data: arrayBuffer }).promise
      let textoCompleto = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const pagina = content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
        textoCompleto += pagina + '\n'
      }

      if (!textoCompleto.trim() || textoCompleto.trim().length < 30) {
        setErrorPdf('No se pudo extraer texto del PDF. ¿Es un PDF escaneado?')
        setTranscribiendo(false)
        return
      }

      const res = await fetch('/api/transcribe-exam', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textoCompleto }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErrorPdf(data.error ?? 'No se pudo leer el PDF')
        return
      }

      type PreguntaRaw = {
        type: TipoPregunta
        statement: string
        points: number
        options?: Array<{ key: string; text: string }>
        correct_answer?: unknown
        rubric?: string | null
      }

      const nuevas: Pregunta[] = ((data.preguntas ?? []) as PreguntaRaw[]).map((p) => {
        let correcta = p.correct_answer ?? null

        // La BD exige correct_answer != null para preguntas no abiertas.
        // Si la IA no lo detectó, usamos la primera opción como fallback —
        // el profesor lo corrige antes de publicar.
        if (correcta === null && p.type !== 'redaccion_abierta') {
          if (p.type === 'verdadero_falso') correcta = true
          else if (p.options && p.options.length > 0) correcta = p.options[0].key
        }

        return {
          id: `q${Date.now()}-${Math.random()}`,
          type: p.type,
          statement: p.statement,
          points: p.points ?? 1,
          options: p.options,
          correct_answer: correcta,
          rubric: p.rubric ?? null,
        }
      })

      if (nuevas.length === 0) {
        setErrorPdf('No se encontraron preguntas en el PDF. Verifica que tenga texto seleccionable.')
        return
      }

      setPreguntas((qs) => [...qs, ...nuevas])
      if (data.titulo_sugerido && !titulo) setTitulo(data.titulo_sugerido)
      if (data.instrucciones_sugeridas && !instrucciones) setInstrucciones(data.instrucciones_sugeridas)
    } catch {
      setErrorPdf('Error de conexión al procesar el PDF')
    } finally {
      setTranscribiendo(false)
    }
  }

  function agregarPregunta(datos: Omit<Pregunta, 'id'>) {
    if (editandoId) {
      setPreguntas((qs) => qs.map((q) => q.id === editandoId ? { ...datos, id: editandoId } : q))
      setEditandoId(null)
    } else {
      setPreguntas((qs) => [...qs, { id: `q${Date.now()}`, ...datos }])
    }
    setEditorAbierto(null)
  }

  function iniciarEdicion(pregunta: Pregunta) {
    setEditandoId(pregunta.id)
    setEditorAbierto(pregunta.type)
    setEligiendoTipo(false)
  }

  async function guardar() {
    if (!sePuedeGuardar) return
    setGuardando(true)
    setError(null)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setGuardando(false)
      return
    }

    const { data: examen, error: falloExamen } = await supabase
      .from('exams')
      .insert({
        title: titulo.trim(),
        instructions: instrucciones.trim() || null,
        module_id: moduloId,
        cohort_id: cohorteId || null,
        teacher_id: user.id,
        max_score: puntajeMaximo,
        duration_minutes: duracion === '' ? null : duracion,
        status: 'oculto',   // Nace como borrador. Publicar es un paso aparte.
      })
      .select()
      .single()

    if (falloExamen || !examen) {
      setError(falloExamen?.message ?? 'No se pudo crear el examen.')
      setGuardando(false)
      return
    }

    const { error: falloPreguntas } = await supabase.from('exam_questions').insert(
      preguntas.map((q, i) => ({
        exam_id: examen.id,
        order_index: i + 1,
        type: q.type,
        statement: q.statement,
        points: q.points,
        options: q.options ?? null,
        correct_answer: (q.correct_answer ?? null) as never,
        rubric: q.rubric ?? null,
      })),
    )

    if (falloPreguntas) {
      setError(falloPreguntas.message)
      setGuardando(false)
      return
    }

    router.push('/crear-examen')
  }

  return (
    <div className="space-y-11 px-5 pt-14">
      <BotonVolver href="/crear-examen" />

      <Encabezado
        sobretitulo="Docencia"
        titulo="Nuevo examen"
        descripcion="Se guarda como borrador. Se publica después, cuando los puntos cuadren."
      />

      <Regla delay={60} />

      {/* 01 — DATOS */}
      <Seccion numero={1} titulo="Datos del examen" delay={120}>
        <div className="zr-card space-y-5 p-6">
          <div>
            <label htmlFor="titulo" className="mb-2 block text-sm font-semibold text-zr-text">
              Título
            </label>
            <input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Electricidad automotriz · Semana 2"
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="instrucciones" className="mb-2 block text-sm font-semibold text-zr-text">
              Instrucciones <span className="font-normal text-zr-text-muted">(opcional)</span>
            </label>
            <textarea
              id="instrucciones"
              value={instrucciones}
              onChange={(e) => setInstrucciones(e.target.value)}
              placeholder="Lo que el estudiante lee antes de empezar."
              className="min-h-20 w-full resize-none rounded-lg border border-zr-border bg-zr-bg px-4 py-3 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="modulo" className="mb-2 block text-sm font-semibold text-zr-text">
                Módulo
              </label>
              <select
                id="modulo"
                value={moduloId}
                onChange={(e) => setModuloId(e.target.value)}
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
              >
                {modulos.length === 0 && <option value="">Sin módulos cargados</option>}
                {modulos.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="cohorte" className="mb-2 block text-sm font-semibold text-zr-text">
                Cohorte
              </label>
              <select
                id="cohorte"
                value={cohorteId}
                onChange={(e) => setCohorteId(e.target.value)}
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
              >
                <option value="">Todas las cohortes</option>
                {cohortes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="maximo" className="mb-2 block text-sm font-semibold text-zr-text">
                Puntaje máximo
              </label>
              <input
                id="maximo"
                type="number"
                min={1}
                value={puntajeMaximo}
                onChange={(e) => setPuntajeMaximo(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base tabular-nums text-zr-text focus:border-zr-blue focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="duracion" className="mb-2 block text-sm font-semibold text-zr-text">
                Duración <span className="font-normal text-zr-text-muted">(min)</span>
              </label>
              <input
                id="duracion"
                type="number"
                min={1}
                value={duracion}
                onChange={(e) => setDuracion(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Sin límite"
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base tabular-nums text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
              />
            </div>
          </div>
        </div>
      </Seccion>

      {/* 02 — PREGUNTAS */}
      <Seccion numero={2} titulo="Preguntas" delay={200}>
        {/* Importar desde PDF */}
        <div className="zr-card flex items-center gap-4 p-5">
          <div className="flex-1">
            <p className="text-sm font-semibold text-zr-text">Importar desde PDF</p>
            <p className="mt-0.5 text-xs text-zr-text-muted">
              Sube el examen en PDF y la IA extrae las preguntas automáticamente.
            </p>
          </div>
          <input
            ref={archivoRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={importarPdf}
          />
          <button
            type="button"
            disabled={transcribiendo}
            onClick={() => archivoRef.current?.click()}
            className="shrink-0 rounded-lg border border-zr-blue px-4 py-2.5 text-sm font-semibold text-zr-blue transition-colors hover:bg-zr-blue/8 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {transcribiendo ? 'Leyendo…' : 'Subir PDF'}
          </button>
        </div>

        {errorPdf && (
          <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
            {errorPdf}
          </p>
        )}

        {/* Contador permanente. Rojo mientras no cuadre: es el error más común
            al armar un examen y el que impide publicarlo. */}
        <div
          className={`flex items-center justify-between rounded-lg border px-5 py-4 ${
            puntosCuadran
              ? 'border-zr-success/30 bg-zr-success/10 text-zr-success'
              : 'border-zr-error/30 bg-zr-error/10 text-zr-error'
          }`}
        >
          <p className="text-sm font-bold">
            Puntos asignados: {puntosAsignados} / {puntajeMaximo}
          </p>
          {!puntosCuadran && (
            <p className="text-xs font-medium">
              {puntosAsignados < puntajeMaximo
                ? `Faltan ${puntajeMaximo - puntosAsignados}`
                : `Sobran ${puntosAsignados - puntajeMaximo}`}
            </p>
          )}
        </div>

        {preguntas.length > 0 && !editorAbierto && (
          <div className="space-y-3">
            {preguntas.map((q, i) => (
              <div key={q.id} className="zr-card space-y-3 p-5">
                <div className="flex items-start gap-4">
                  <span className="zr-metric w-8 shrink-0 pt-0.5 text-lg text-zr-blue">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium text-zr-text">{q.statement}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Etiqueta tono="info">{ETIQUETA_TIPO[q.type]}</Etiqueta>
                      <Etiqueta tono="neutro">{q.points} pts</Etiqueta>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-3 border-t border-zr-border pt-3">
                  <button
                    onClick={() => iniciarEdicion(q)}
                    className="rounded px-3 py-1.5 text-sm font-semibold text-zr-blue transition-colors hover:bg-zr-blue/8"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => setPreguntas((qs) => qs.filter((x) => x.id !== q.id))}
                    className="rounded px-3 py-1.5 text-sm font-semibold text-zr-text-muted transition-colors hover:text-zr-error"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Se elige el tipo primero; el formulario cambia según el tipo. */}
        {editorAbierto ? (
          <QuestionEditor
            type={editorAbierto}
            onSave={agregarPregunta}
            onCancel={() => { setEditorAbierto(null); setEditandoId(null) }}
            initialData={editandoId ? preguntas.find((q) => q.id === editandoId) as never : undefined}
            modoEdicion={!!editandoId}
          />
        ) : eligiendoTipo ? (
          <div className="zr-card space-y-3 p-5">
            <p className="text-sm font-semibold text-zr-text">¿Qué tipo de pregunta?</p>
            {TIPOS.map((t) => (
              <button
                key={t.valor}
                onClick={() => { setEditorAbierto(t.valor); setEligiendoTipo(false) }}
                className="w-full rounded-lg border border-zr-border bg-zr-bg p-4 text-left transition-colors hover:border-zr-blue/45"
              >
                <p className="text-base font-semibold text-zr-text">{t.titulo}</p>
                <p className="mt-1 text-sm text-zr-text-muted">{t.explicacion}</p>
              </button>
            ))}
            <button
              onClick={() => setEligiendoTipo(false)}
              className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-zr-text-muted"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEligiendoTipo(true)}
            className="w-full rounded-lg border border-dashed border-zr-border px-6 py-5 text-sm font-semibold text-zr-blue transition-colors hover:border-zr-blue/45 hover:bg-zr-blue/5"
          >
            + Agregar pregunta
          </button>
        )}
      </Seccion>

      {/* Guardar */}
      <div className="space-y-4">
        {error && (
          <p className="rounded-lg border border-zr-error/30 bg-zr-error/12 px-4 py-3 text-sm font-medium text-zr-error">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => router.push('/crear-examen')}
            className="flex-1 rounded-lg border border-zr-border px-6 py-4 text-base font-semibold text-zr-text"
          >
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={!sePuedeGuardar || guardando}
            className="flex-1 rounded-lg bg-zr-blue px-6 py-4 text-base font-bold text-white transition-colors hover:bg-zr-blue-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            {guardando ? 'Guardando…' : 'Guardar borrador'}
          </button>
        </div>

        <p className="text-center text-xs text-zr-text-muted">
          El examen se guarda oculto. Para que los estudiantes lo vean, publícalo desde la lista.
        </p>
      </div>
    </div>
  )
}
