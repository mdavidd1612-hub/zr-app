'use client'

import { Select } from '@/components/ui/Select'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { QuestionEditor } from '@/components/QuestionEditor'
import { Encabezado, Regla, Seccion, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { PantallaEsqueleto } from '@/components/ui/Esqueleto'
import { ordenarCohortesPorPrioridad } from '@/lib/cohortes'
import { ModalEvaluacionAgregada } from '@/components/ui/ModalEvaluacionAgregada'
import { sumaPesoOcupado, mensajeSiExcedePeso } from '@/lib/peso-notas'
import { ImportarPreguntas } from '@/components/ui/ImportarPreguntas'
import type { PreguntaImportada } from '@/lib/importar-preguntas'

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
  return (
    <Suspense fallback={<PantallaEsqueleto />}>
      <NuevoExamenInterno />
    </Suspense>
  )
}

/**
 * Pedido explícito del coordinador (reunión 31-oct-2026): el examen se crea
 * desde DENTRO de la unidad, no aparte. Con `?unitId=` en la URL (llegó desde
 * la unidad) se precarga su módulo y, al guardar, el examen se engancha solo
 * a esa unidad (unit_items) en vez de mandar al profesor a buscarlo y
 * agregarlo a mano.
 */
function NuevoExamenInterno() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const unitId = searchParams.get('unitId')

  const [titulo, setTitulo] = useState('')
  const [instrucciones, setInstrucciones] = useState('')
  const [moduloId, setModuloId] = useState('')
  const [modulos, setModulos] = useState<{ id: string; name: string }[]>([])
  const [cohorteId, setCohorteId] = useState('')
  const [cohortes, setCohortes] = useState<{ id: string; name: string }[]>([])
  const [puntajeMaximo, setPuntajeMaximo] = useState(20)
  const [duracion, setDuracion] = useState<number | ''>(10)

  // Fecha propia del examen (pendiente de la reunión 7-nov-2026, §8.12): ya
  // existía en la base (opens_at/closes_at, migración 176/179 -- alimenta el
  // calendario solo) pero nunca se podía fijar desde la app ni bloqueaba
  // nada. Ambas opcionales: sin opens_at, el examen está disponible en
  // cuanto se publica (igual que siempre).
  const [abreEl, setAbreEl] = useState('')
  const [cierraEl, setCierraEl] = useState('')

  // Modelo de evaluación (migración 176). Antes solo se podía configurar por
  // SQL; ahora el profesor elige desde la app si el examen abre la siguiente
  // unidad (certificación) y con qué reglas.
  const [tipo, setTipo] = useState<'formativo' | 'certificacion'>('formativo')
  const [notaMinima, setNotaMinima] = useState<number | ''>(10)
  const [intentos, setIntentos] = useState<number | ''>(2)
  const [enfriamiento, setEnfriamiento] = useState<number | ''>(24)

  // Fusión con Notas (H.33, pedido del coordinador 7-nov-2026): el examen,
  // al crearse, YA es una evaluación de Notas (migración 193) -- este % es
  // lo que vale en la nota del módulo. Se fija aquí mismo, sin volver a
  // Notas a registrarlo aparte.
  const [peso, setPeso] = useState<number | ''>(0)
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)
  const [destinoTrasConfirmar, setDestinoTrasConfirmar] = useState<string | null>(null)

  const [preguntas, setPreguntas] = useState<Pregunta[]>([])
  const [editorAbierto, setEditorAbierto] = useState<TipoPregunta | null>(null)
  const [eligiendoTipo, setEligiendoTipo] = useState(false)
  const [importando, setImportando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tituloUnidad, setTituloUnidad] = useState('')


  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Solo las cohortes que este profesor dicta. Sin este filtro, el
      // selector mostraba TODAS las cohortes de la academia y el profesor
      // podía terminar publicando un examen en la clase de otro profesor.
      const [{ data: mods }, { data: cohs }, { data: asig }] = await Promise.all([
        supabase.from('modules').select('id, name').order('order_index'),
        // Sin filtrar por dueño: la base entrega las cohortes de los programas donde
        // este profesor tiene módulos asignados (migración 150).
        supabase.from('cohorts').select('id, name').eq('status', 'activa'),
        supabase.from('teacher_module_assignments').select('module_id').eq('teacher_id', user.id),
      ])

      const cohortesOrdenadas = ordenarCohortesPorPrioridad(cohs ?? [])
      // Solo los módulos que dicta (si tiene asignados); si no, todos como antes.
      const suyos = new Set((asig ?? []).map((a) => a.module_id))
      const modsVisibles = suyos.size > 0 ? (mods ?? []).filter((m) => suyos.has(m.id)) : (mods ?? [])
      setModulos(modsVisibles)
      setCohortes(cohortesOrdenadas)
      if (modsVisibles.length) setModuloId(modsVisibles[0].id)
      if (cohortesOrdenadas.length) setCohorteId(cohortesOrdenadas[0].id)

      // Viene de una unidad: su módulo manda, no el primero de la lista.
      if (unitId) {
        const { data: unidad } = await supabase.from('units').select('title, module_id').eq('id', unitId).maybeSingle()
        if (unidad) {
          setTituloUnidad(unidad.title)
          setModuloId(unidad.module_id)
        }
      }
    }

    cargar()
  }, [unitId])

  const puntosAsignados = preguntas.reduce((s, q) => s + q.points, 0)
  const puntosCuadran = puntosAsignados === puntajeMaximo
  const sePuedeGuardar = titulo.trim() !== '' && moduloId !== '' && preguntas.length > 0

  function agregarPregunta(datos: Omit<Pregunta, 'id'>) {
    if (editandoId) {
      setPreguntas((qs) => qs.map((q) => q.id === editandoId ? { ...datos, id: editandoId } : q))
      setEditandoId(null)
    } else {
      setPreguntas((qs) => [...qs, { id: `q${Date.now()}`, ...datos }])
    }
    setEditorAbierto(null)
  }

  function importarPreguntas(leidas: PreguntaImportada[]) {
    setPreguntas((qs) => [
      ...qs,
      ...leidas.map((p, i) => ({
        id: `qimp${Date.now()}-${i}`,
        type: p.type,
        statement: p.statement,
        points: p.points,
        options: p.options,
        correct_answer: p.correct_answer ?? undefined,
        rubric: p.rubric,
      })),
    ])
    setImportando(false)
  }

  function iniciarEdicion(pregunta: Pregunta) {
    setEditandoId(pregunta.id)
    setEditorAbierto(pregunta.type)
    setEligiendoTipo(false)
  }

  async function guardar() {
    if (!sePuedeGuardar) return
    setError(null)

    const pesoNuevo = peso === '' ? 0 : peso

    // Pedido explícito del coordinador (reunión 7-nov-2026): una certificación
    // no tiene sentido que valga 0% -- si no vale nada, no tiene sentido que
    // tenga intentos ni enfriamiento. Una práctica sí puede valer 0.
    if (tipo === 'certificacion' && pesoNuevo <= 0) {
      setError('Una certificación tiene que valer más de 0% en la nota del módulo.')
      return
    }

    const supabase = createClient()

    // Bug real de la reunión: se podía crear un examen que hiciera pasar la
    // suma de pesos de 100% sin avisar antes -- la única señal era la
    // excepción SQL de fn_validar_suma_pesos al insertar. Se anticipa aquí,
    // igual que ya hace RegistrarEvaluacion.tsx.
    if (pesoNuevo > 0) {
      const ocupado = await sumaPesoOcupado(supabase, moduloId, cohorteId || null)
      const msg = mensajeSiExcedePeso(ocupado, pesoNuevo)
      if (msg) { setError(msg); return }
    }

    // Mismo caso que el material (reunión 31-oct-2026): crear dos veces un
    // examen con el mismo nombre en la misma unidad no debe duplicarlo.
    if (unitId) {
      const { data: yaEstan } = await supabase
        .from('unit_items')
        .select('exams(title)')
        .eq('unit_id', unitId)
        .eq('type', 'quiz')
      const titulos = (yaEstan ?? [])
        .map((f) => (f.exams as unknown as { title: string } | null)?.title?.trim().toLowerCase())
      if (titulos.includes(titulo.trim().toLowerCase())) {
        setError('Ya existe un examen con este nombre en esta unidad.')
        return
      }
    }

    setGuardando(true)

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
        kind: tipo,
        passing_score: tipo === 'certificacion' ? (notaMinima === '' ? 10 : notaMinima) : 10,
        max_attempts: intentos === '' ? 2 : intentos,
        cooldown_hours: enfriamiento === '' ? 24 : enfriamiento,
        weight: peso === '' ? 0 : peso,
        opens_at: abreEl ? new Date(abreEl).toISOString() : null,
        closes_at: cierraEl ? new Date(cierraEl).toISOString() : null,
        // Bug real reportado en vivo (8-nov-2026): exams.unit_id nunca se
        // guardaba aquí (solo en la fila de unit_items) -- fn_calendar_sync_exam
        // depende de este campo para decidir si el examen entra al calendario,
        // así que un examen con fecha pero sin unit_id nunca aparecía ahí.
        unit_id: unitId || null,
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

    // Viene de una unidad: se engancha solo (unit_items) y se vuelve ahí --
    // el profesor no tiene que ir a buscarlo a la lista para agregarlo.
    if (unitId) {
      const { count } = await supabase
        .from('unit_items').select('id', { count: 'exact', head: true }).eq('unit_id', unitId)
      await supabase.from('unit_items').insert({
        unit_id: unitId,
        type: 'quiz',
        order_index: (count ?? 0) + 1,
        exam_id: examen.id,
      })
      setGuardando(false)
      setDestinoTrasConfirmar(`/unidades-docente/${unitId}`)
      setMostrarConfirmacion(true)
      return
    }

    setGuardando(false)
    setDestinoTrasConfirmar('/crear-examen')
    setMostrarConfirmacion(true)
  }

  return (
    <div className="space-y-11 px-5 pt-[calc(3.5rem+env(safe-area-inset-top))]">
      <BotonVolver href={unitId ? `/unidades-docente/${unitId}` : '/crear-examen'} />

      <Encabezado
        sobretitulo="Docencia"
        titulo="Nuevo examen"
        descripcion={
          unitId
            ? `Para la unidad "${tituloUnidad}" — se guarda y se agrega solo. Se publica después, cuando los puntos cuadren.`
            : 'Se guarda como borrador. Se publica después, cuando los puntos cuadren.'
        }
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

          {/* Pedido explícito del coordinador (reunión 7-nov-2026): viniendo de
              una unidad, el módulo y el programa ya quedaron elegidos antes de
              entrar -- no tiene sentido volver a mostrarlos como si hubiera
              algo que decidir aquí. Solo se informan en texto. */}
          {unitId ? (
            <p className="text-xs text-zr-text-muted">
              Módulo: <span className="font-semibold text-zr-text">{tituloUnidad || '…'}</span>
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="modulo" className="mb-2 block text-sm font-semibold text-zr-text">
                  Módulo
                </label>
                <Select
                  id="modulo"
                  value={moduloId}
                  onChange={(e) => setModuloId(e.target.value)}
                  className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
                >
                  {modulos.length === 0 && <option value="">Sin módulos cargados</option>}
                  {modulos.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Select>
              </div>

              <div>
                <label htmlFor="cohorte" className="mb-2 block text-sm font-semibold text-zr-text">
                  Programa
                </label>
                <Select
                  id="cohorte"
                  value={cohorteId}
                  onChange={(e) => setCohorteId(e.target.value)}
                  className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
                >
                  <option value="">Todos los programas</option>
                  {cohortes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
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

          {/* Fecha propia del examen (pendiente de la reunión 7-nov-2026):
              opcional -- sin "Se abre", el examen queda disponible en cuanto
              se publica, igual que siempre. Con fecha, el servidor la valida
              de verdad al empezar un intento (migración 200), no solo aquí. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="abre-el" className="mb-2 block text-sm font-semibold text-zr-text">
                Se abre <span className="font-normal text-zr-text-muted">(opcional)</span>
              </label>
              <input
                id="abre-el"
                type="datetime-local"
                value={abreEl}
                onChange={(e) => setAbreEl(e.target.value)}
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
              />
              <p className="mt-1.5 text-xs text-zr-text-muted">Antes de esta fecha, el examen se ve bloqueado.</p>
            </div>
            <div>
              <label htmlFor="cierra-el" className="mb-2 block text-sm font-semibold text-zr-text">
                Se cierra <span className="font-normal text-zr-text-muted">(opcional)</span>
              </label>
              <input
                id="cierra-el"
                type="datetime-local"
                value={cierraEl}
                onChange={(e) => setCierraEl(e.target.value)}
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
              />
              <p className="mt-1.5 text-xs text-zr-text-muted">Pasada esta fecha, ya no se puede empezar un intento.</p>
            </div>
          </div>

          {/* Modelo de evaluación. El profesor elige esto desde la app -- antes
              solo se podía por SQL (hueco detectado en la auditoría, nov 2026). */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">¿Qué tipo de examen es?</label>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setTipo('formativo')}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  tipo === 'formativo' ? 'border-zr-blue bg-zr-blue/8' : 'border-zr-border bg-zr-bg'
                }`}
              >
                <p className="text-sm font-bold text-zr-text">Práctica</p>
                <p className="mt-1 text-xs text-zr-text-muted">No bloquea nada. El estudiante practica.</p>
              </button>
              <button
                type="button"
                onClick={() => setTipo('certificacion')}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  tipo === 'certificacion' ? 'border-zr-blue bg-zr-blue/8' : 'border-zr-border bg-zr-bg'
                }`}
              >
                <p className="text-sm font-bold text-zr-text">Certificación</p>
                <p className="mt-1 text-xs text-zr-text-muted">Hay que aprobarlo para abrir la unidad siguiente.</p>
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {tipo === 'certificacion' && (
              <div>
                <label htmlFor="nota-minima" className="mb-2 block text-sm font-semibold text-zr-text">
                  Nota mínima <span className="font-normal text-zr-text-muted">(sobre {puntajeMaximo})</span>
                </label>
                <input
                  id="nota-minima"
                  type="number"
                  min={1}
                  max={puntajeMaximo}
                  value={notaMinima}
                  onChange={(e) => setNotaMinima(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base tabular-nums text-zr-text focus:border-zr-blue focus:outline-none"
                />
              </div>
            )}

            <div>
              <label htmlFor="intentos" className="mb-2 block text-sm font-semibold text-zr-text">
                Intentos
              </label>
              <input
                id="intentos"
                type="number"
                min={1}
                value={intentos}
                onChange={(e) => setIntentos(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base tabular-nums text-zr-text focus:border-zr-blue focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="enfriamiento" className="mb-2 block text-sm font-semibold text-zr-text">
                Espera entre intentos <span className="font-normal text-zr-text-muted">(h)</span>
              </label>
              <input
                id="enfriamiento"
                type="number"
                min={0}
                value={enfriamiento}
                onChange={(e) => setEnfriamiento(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base tabular-nums text-zr-text focus:border-zr-blue focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="peso" className="mb-2 block text-sm font-semibold text-zr-text">
                % que vale en la nota del módulo
              </label>
              <input
                id="peso"
                type="number"
                min={0}
                max={100}
                value={peso}
                onChange={(e) => setPeso(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base tabular-nums text-zr-text focus:border-zr-blue focus:outline-none"
              />
              <p className="mt-1.5 text-xs text-zr-text-muted">
                Este examen ya queda registrado como evaluación en Notas -- no hay que volver a crearlo ahí.
              </p>
            </div>
          </div>
        </div>
      </Seccion>

      {/* 02 — PREGUNTAS */}
      <Seccion numero={2} titulo="Preguntas" delay={200}>
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
          <div className="space-y-3">
            <button
              onClick={() => setEligiendoTipo(true)}
              className="w-full rounded-lg border border-dashed border-zr-border px-6 py-5 text-sm font-semibold text-zr-blue transition-colors hover:border-zr-blue/45 hover:bg-zr-blue/5"
            >
              + Agregar pregunta
            </button>
            <button
              onClick={() => setImportando(true)}
              className="w-full rounded-lg px-4 py-2 text-xs font-bold text-zr-text-muted"
            >
              Importar preguntas desde Word/Excel/CSV
            </button>
          </div>
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
            onClick={() => router.push(unitId ? `/unidades-docente/${unitId}` : '/crear-examen')}
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

      {mostrarConfirmacion && destinoTrasConfirmar && (
        <ModalEvaluacionAgregada
          peso={typeof peso === 'number' ? peso : 0}
          onCerrar={() => router.push(destinoTrasConfirmar)}
        />
      )}

      {importando && (
        <ImportarPreguntas onImportar={importarPreguntas} onCerrar={() => setImportando(false)} />
      )}
    </div>
  )
}
