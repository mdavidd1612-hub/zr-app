'use client'

import { useRouter, useParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { QuestionEditor } from '@/components/QuestionEditor'
import { Encabezado, Regla, Seccion, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'

type TipoPregunta = 'opcion_multiple' | 'verdadero_falso' | 'redaccion_abierta'

interface Pregunta {
  id: string
  dbId?: string   // id real en la BD (si ya existía); undefined si es nueva
  type: TipoPregunta
  statement: string
  points: number
  options?: Array<{ key: string; text: string }>
  correct_answer?: unknown
  rubric?: string | null
}

const TIPOS: { valor: TipoPregunta; titulo: string; explicacion: string }[] = [
  { valor: 'opcion_multiple',   titulo: 'Opción múltiple',   explicacion: 'De 2 a 6 opciones. Se califica sola.' },
  { valor: 'verdadero_falso',   titulo: 'Verdadero o falso', explicacion: 'Dos opciones. Se califica sola.' },
  { valor: 'redaccion_abierta', titulo: 'Redacción abierta', explicacion: 'La calificas tú con una rúbrica.' },
]

const ETIQUETA_TIPO: Record<TipoPregunta, string> = {
  opcion_multiple: 'Opción múltiple',
  verdadero_falso: 'Verdadero/falso',
  redaccion_abierta: 'Redacción',
}

export default function EditarExamen() {
  const router = useRouter()
  const params = useParams()
  const examId = params.examId as string

  const [cargando, setCargando] = useState(true)
  const [titulo, setTitulo] = useState('')
  const [instrucciones, setInstrucciones] = useState('')
  const [moduloId, setModuloId] = useState('')
  const [modulos, setModulos] = useState<{ id: string; name: string }[]>([])
  const [cohorteId, setCohorteId] = useState('')
  const [cohortes, setCohortes] = useState<{ id: string; name: string }[]>([])
  const [puntajeMaximo, setPuntajeMaximo] = useState(20)
  const [duracion, setDuracion] = useState<number | ''>('')
  const [preguntas, setPreguntas] = useState<Pregunta[]>([])
  const [editorAbierto, setEditorAbierto] = useState<TipoPregunta | null>(null)
  const [eligiendoTipo, setEligiendoTipo] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Preguntas eliminadas durante la edición (para borrarlas en la BD al guardar)
  const eliminadasRef = useRef<string[]>([])

  useEffect(() => {
    let vigente = true
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }

      const [{ data: examen }, { data: mods }, { data: cohs }, { data: pregs }] = await Promise.all([
        supabase.from('exams').select('*').eq('id', examId).eq('teacher_id', user.id).single(),
        supabase.from('modules').select('id, name').order('order_index'),
        supabase.from('cohorts').select('id, name').eq('status', 'activa').eq('teacher_id', user.id),
        supabase.from('exam_questions').select('*').eq('exam_id', examId).order('order_index'),
      ])

      if (!vigente) return
      if (!examen) { router.replace('/crear-examen'); return }

      setTitulo(examen.title ?? '')
      setInstrucciones(examen.instructions ?? '')
      setModuloId(examen.module_id ?? '')
      setCohorteId(examen.cohort_id ?? '')
      setPuntajeMaximo(Number(examen.max_score) || 20)
      setDuracion(examen.duration_minutes ?? '')
      setModulos(mods ?? [])
      setCohortes(cohs ?? [])
      setPreguntas(
        (pregs ?? []).map((q) => ({
          id: `q${q.id}`,
          dbId: q.id,
          type: q.type as TipoPregunta,
          statement: q.statement,
          points: Number(q.points),
          options: q.options as Pregunta['options'],
          correct_answer: q.correct_answer,
          rubric: q.rubric,
        })),
      )
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router, examId])

  const puntosAsignados = preguntas.reduce((s, q) => s + q.points, 0)
  const puntosCuadran = puntosAsignados === puntajeMaximo
  const sePuedeGuardar = titulo.trim() !== '' && moduloId !== '' && preguntas.length > 0

  function agregarPregunta(datos: Omit<Pregunta, 'id'>) {
    if (editandoId) {
      setPreguntas((qs) =>
        qs.map((q) => q.id === editandoId ? { ...datos, id: editandoId, dbId: q.dbId } : q)
      )
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

  function eliminarPregunta(id: string) {
    const q = preguntas.find((p) => p.id === id)
    if (q?.dbId) eliminadasRef.current.push(q.dbId)
    setPreguntas((qs) => qs.filter((p) => p.id !== id))
  }

  async function guardar() {
    if (!sePuedeGuardar) return
    setGuardando(true)
    setError(null)

    const supabase = createClient()

    // 1. Actualizar metadatos del examen
    const { error: falloExamen } = await supabase
      .from('exams')
      .update({
        title: titulo.trim(),
        instructions: instrucciones.trim() || null,
        module_id: moduloId,
        cohort_id: cohorteId || null,
        max_score: puntajeMaximo,
        duration_minutes: duracion === '' ? null : duracion,
      })
      .eq('id', examId)

    if (falloExamen) {
      setError(falloExamen.message)
      setGuardando(false)
      return
    }

    // 2. Borrar preguntas eliminadas
    if (eliminadasRef.current.length > 0) {
      await supabase.from('exam_questions').delete().in('id', eliminadasRef.current)
      eliminadasRef.current = []
    }

    // 3. Upsert de preguntas (insertar nuevas, actualizar existentes)
    const preguntasParaUpsert = preguntas.map((q, i) => ({
      ...(q.dbId ? { id: q.dbId } : {}),
      exam_id: examId,
      order_index: i + 1,
      type: q.type,
      statement: q.statement,
      points: q.points,
      options: q.options ?? null,
      correct_answer: (q.correct_answer ?? null) as never,
      rubric: q.rubric ?? null,
    }))

    const { error: falloPregs } = await supabase
      .from('exam_questions')
      .upsert(preguntasParaUpsert, { onConflict: 'id' })

    if (falloPregs) {
      setError(falloPregs.message)
      setGuardando(false)
      return
    }

    router.push('/crear-examen')
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-zr-text-muted">Cargando examen…</p>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14 pb-10">
      <BotonVolver href="/crear-examen" />

      <Encabezado
        sobretitulo="Docencia"
        titulo="Editar examen"
        descripcion="Los cambios se guardan como borrador. Publica cuando los puntos cuadren."
      />

      <Regla delay={60} />

      {/* 01 — DATOS */}
      <Seccion numero={1} titulo="Datos del examen" delay={120}>
        <div className="zr-card space-y-5 p-6">
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Título</label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">
              Instrucciones <span className="font-normal text-zr-text-muted">(opcional)</span>
            </label>
            <textarea
              value={instrucciones}
              onChange={(e) => setInstrucciones(e.target.value)}
              className="min-h-20 w-full resize-none rounded-lg border border-zr-border bg-zr-bg px-4 py-3 text-base text-zr-text focus:border-zr-blue focus:outline-none"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-zr-text">Módulo</label>
              <select
                value={moduloId}
                onChange={(e) => setModuloId(e.target.value)}
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
              >
                {modulos.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zr-text">Cohorte</label>
              <select
                value={cohorteId}
                onChange={(e) => setCohorteId(e.target.value)}
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
              >
                <option value="">Todas las cohortes</option>
                {cohortes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zr-text">Puntaje máximo</label>
              <input
                type="number" min={1} value={puntajeMaximo}
                onChange={(e) => setPuntajeMaximo(Number(e.target.value) || 0)}
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base tabular-nums text-zr-text focus:border-zr-blue focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zr-text">
                Duración <span className="font-normal text-zr-text-muted">(min)</span>
              </label>
              <input
                type="number" min={1} value={duracion}
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
        <div className={`flex items-center justify-between rounded-lg border px-5 py-4 ${
          puntosCuadran
            ? 'border-zr-success/30 bg-zr-success/10 text-zr-success'
            : 'border-zr-error/30 bg-zr-error/10 text-zr-error'
        }`}>
          <p className="text-sm font-bold">Puntos asignados: {puntosAsignados} / {puntajeMaximo}</p>
          {!puntosCuadran && (
            <p className="text-xs font-medium">
              {puntosAsignados < puntajeMaximo ? `Faltan ${puntajeMaximo - puntosAsignados}` : `Sobran ${puntosAsignados - puntajeMaximo}`}
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
                    onClick={() => eliminarPregunta(q.id)}
                    className="rounded px-3 py-1.5 text-sm font-semibold text-zr-text-muted transition-colors hover:text-zr-error"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

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
            <button onClick={() => setEligiendoTipo(false)} className="w-full rounded-lg px-4 py-3 text-sm font-semibold text-zr-text-muted">
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
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  )
}
