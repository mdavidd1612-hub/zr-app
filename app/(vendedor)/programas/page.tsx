'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'
import { EtiquetaSede } from '@/components/ui/EtiquetaSede'

interface Cohorte {
  id: string
  name: string
  sede: string | null
  turno: string | null
  startDate: string
  dias: string | null
  horario: string | null
  codeNumber: number | null
  estado: 'activa' | 'finalizada' | 'suspendida'
  misEstudiantes: number
  totalEstudiantes: number
}

interface Programa {
  id: string
  name: string
  siglas: string
  cohortes: Cohorte[]
}

const ROMANOS = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']

// Vista previa del nombre que va a generar el servidor (migración 060). Aquí es
// solo para que ventas vea qué va a salir antes de guardar — el nombre de
// verdad lo pone la base, nunca este cálculo.
function nombrePrevisto(siglas: string, fecha: string, cortesDelAnio: number) {
  if (!fecha) return null
  const anio = fecha.slice(0, 4)
  const siguiente = cortesDelAnio + 1
  return `${siglas}-${anio}-${ROMANOS[siguiente] ?? siguiente}`
}

export default function ProgramasVendedor() {
  const router = useRouter()
  const [programas, setProgramas] = useState<Programa[]>([])
  const [sedesConocidas, setSedesConocidas] = useState<string[]>([])
  const [cargando, setCargando] = useState(true)
  const [version, setVersion] = useState(0)

  const [creando, setCreando] = useState<string | null>(null)   // program_id
  const [editando, setEditando] = useState<string | null>(null) // cohort_id
  const [borrando, setBorrando] = useState<string | null>(null)  // cohort_id

  const [sede, setSede] = useState('')
  const [sedeNueva, setSedeNueva] = useState('')
  const [turno, setTurno] = useState<'mañana' | 'tarde'>('mañana')
  const [fechaInicio, setFechaInicio] = useState('')
  const [dias, setDias] = useState('Sábados')
  const [horario, setHorario] = useState('')
  // Solo se usa al editar: al crear, el nombre lo pone el servidor.
  const [nombre, setNombre] = useState('')

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const [{ data: progs }, { data: mias }] = await Promise.all([
        supabase
          .from('programs')
          .select('id, name, cohorts(id, name, sede, turno, start_date, days, schedule, code_number, status, students(id))')
          .order('name'),
        supabase.from('students').select('cohort_id').eq('enrolled_by', user.id),
      ])

      const conteoPorCohorte = new Map<string, number>()
      for (const m of mias ?? []) {
        if (!m.cohort_id) continue
        conteoPorCohorte.set(m.cohort_id, (conteoPorCohorte.get(m.cohort_id) ?? 0) + 1)
      }

      const filas = (progs ?? []) as unknown as {
        id: string; name: string
        cohorts: {
          id: string; name: string; sede: string | null; turno: string | null
          start_date: string; days: string | null; schedule: string | null
          code_number: number | null; status: 'activa' | 'finalizada' | 'suspendida'
          students: { id: string }[] | null
        }[]
      }[]

      setProgramas(filas.map((p) => ({
        id: p.id,
        name: p.name,
        siglas: p.name.split(' ')[0],
        cohortes: [...p.cohorts]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => ({
            id: c.id,
            name: c.name,
            sede: c.sede,
            turno: c.turno,
            startDate: c.start_date,
            dias: c.days,
            horario: c.schedule,
            codeNumber: c.code_number,
            estado: c.status,
            misEstudiantes: conteoPorCohorte.get(c.id) ?? 0,
            totalEstudiantes: c.students?.length ?? 0,
          })),
      })))

      // Las sedes salen de las cohortes que ya existen, no de una lista escrita
      // en el código: así «UCV» y «U.C.V.» no terminan siendo dos sedes
      // distintas para la base. (El catálogo de sedes propiamente dicho es R-20.)
      setSedesConocidas([...new Set(
        filas.flatMap((p) => p.cohorts.map((c) => c.sede)).filter((s): s is string => Boolean(s)),
      )].sort())

      setCargando(false)
    }

    cargar()
  }, [router, version])

  function limpiar() {
    setSede(''); setSedeNueva(''); setTurno('mañana')
    setFechaInicio(''); setDias('Sábados'); setHorario(''); setNombre('')
    setCreando(null); setEditando(null); setBorrando(null)
    setError(null)
  }

  const sedeElegida = () => (sede === '__nueva__' ? sedeNueva : sede).trim()

  function mensajeDeError(codigo?: string, texto?: string) {
    if (codigo === '23505') return 'Ya existe una cohorte con ese nombre en el programa.'
    if (codigo === '23503') return 'No se puede borrar: la cohorte tiene estudiantes inscritos.'
    return texto ?? 'No se pudo guardar. Revisa tu conexión.'
  }

  async function crearCohorte(p: Programa) {
    setGuardando(true); setError(null); setAviso(null)

    // Ni el nombre ni el correlativo se mandan desde aquí: los genera el
    // servidor (migraciones 057 y 060, regla 2 de AGENTS.md). Se leen de vuelta
    // para confirmarle a ventas qué quedó.
    const { data, error: fallo } = await createClient().from('cohorts').insert({
      program_id: p.id,
      sede: sedeElegida() || null,
      turno,
      start_date: fechaInicio,
      days: dias.trim() || null,
      schedule: horario.trim() || null,
      status: 'activa',
    }).select('name, code_number').single()

    if (fallo) {
      setError(mensajeDeError(fallo.code, fallo.message))
      setGuardando(false)
      return
    }

    const corte = String(data.code_number).padStart(2, '0')
    setAviso(
      `Cohorte ${data.name} creada en ${sedeElegida() || 'sin sede'}. ` +
      `Los carnets de sus estudiantes empezarán por ${p.siglas}-${fechaInicio.slice(0, 4)}-${corte}.`,
    )

    limpiar()
    setGuardando(false)
    setVersion((v) => v + 1)
  }

  async function guardarEdicion(c: Cohorte) {
    setGuardando(true); setError(null); setAviso(null)

    const { error: fallo } = await createClient().from('cohorts').update({
      name: nombre.trim(),
      sede: sedeElegida() || null,
      turno,
      days: dias.trim() || null,
      schedule: horario.trim() || null,
    }).eq('id', c.id)

    if (fallo) {
      setError(mensajeDeError(fallo.code, fallo.message))
      setGuardando(false)
      return
    }

    // La fecha de inicio no se puede cambiar desde aquí a propósito: define el
    // año del código de carnet, y moverla dejaría los carnets ya entregados sin
    // relación con su cohorte. Si hay que corregirla, lo hace administración.
    setAviso(`Cohorte ${nombre.trim()} actualizada.`)
    limpiar()
    setGuardando(false)
    setVersion((v) => v + 1)
  }

  // Terminar una cohorte la saca del desplegable de inscripción sin tocar nada
  // de lo que ya pasó dentro de ella. Es reversible: si se terminó por error,
  // "Reabrir" la devuelve a activa.
  async function cambiarEstado(c: Cohorte, estado: 'activa' | 'finalizada') {
    setGuardando(true); setError(null); setAviso(null)

    const { error: fallo } = await createClient()
      .from('cohorts').update({ status: estado }).eq('id', c.id)

    if (fallo) {
      setError(mensajeDeError(fallo.code, fallo.message))
      setGuardando(false)
      return
    }

    setAviso(
      estado === 'finalizada'
        ? `Cohorte ${c.name} terminada. Ya no aparece al inscribir.`
        : `Cohorte ${c.name} reabierta. Vuelve a aparecer al inscribir.`,
    )
    setGuardando(false)
    setVersion((v) => v + 1)
  }

  async function borrarCohorte(c: Cohorte) {
    setGuardando(true); setError(null); setAviso(null)

    const { error: fallo } = await createClient().from('cohorts').delete().eq('id', c.id)

    if (fallo) {
      setError(mensajeDeError(fallo.code, fallo.message))
      setGuardando(false)
      return
    }

    setAviso(`Cohorte ${c.name} eliminada.`)
    limpiar()
    setGuardando(false)
    setVersion((v) => v + 1)
  }

  function empezarEdicion(c: Cohorte) {
    setEditando(c.id); setCreando(null); setBorrando(null); setError(null)
    setNombre(c.name)
    setSede(c.sede ?? '')
    setTurno((c.turno as 'mañana' | 'tarde') ?? 'mañana')
    setDias(c.dias ?? 'Sábados')
    setHorario(c.horario ?? '')
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14 pb-10">
      <Encabezado sobretitulo="Ventas" titulo="Programas" descripcion="PTMA y PFTA, con sus cohortes activas" />
      <Regla delay={60} />

      {aviso && (
        <p className="rounded-lg border border-zr-success/30 bg-zr-success/12 px-4 py-3 text-sm font-medium text-zr-success">
          {aviso}
        </p>
      )}

      {programas.map((p, i) => {
        const cortesDelAnio = fechaInicio
          ? p.cohortes.filter((c) => c.startDate.slice(0, 4) === fechaInicio.slice(0, 4)).length
          : 0
        const previsto = nombrePrevisto(p.siglas, fechaInicio, cortesDelAnio)

        return (
          <Seccion key={p.id} numero={i + 1} titulo={p.name} delay={100 + i * 60}>
            <div className="space-y-3">
              {p.cohortes.length === 0 && (
                <p className="zr-card p-5 text-sm text-zr-text-muted">Todavía no hay cohortes en este programa.</p>
              )}

              {p.cohortes.map((c) => (
                <div key={c.id} className="zr-card space-y-3 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-2">
                      <p className="truncate text-sm font-semibold text-zr-text">{c.name}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <EtiquetaSede sede={c.sede} turno={c.turno} />
                        {c.estado !== 'activa' && (
                          <span className="inline-flex shrink-0 items-center rounded-full border border-zr-border bg-zr-bg px-2.5 py-1 text-[11px] font-bold leading-none text-zr-text-muted">
                            {c.estado === 'finalizada' ? 'Terminada' : 'Suspendida'}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-bold tabular-nums text-zr-blue-mid">
                      {c.misEstudiantes} inscritos por mí
                    </span>
                  </div>

                  {editando !== c.id && borrando !== c.id && (
                    <div className="flex flex-wrap gap-3 pt-1">
                      <button
                        onClick={() => empezarEdicion(c)}
                        className="min-h-11 flex-1 rounded-lg border border-zr-border text-sm font-semibold text-zr-text"
                      >
                        Corregir
                      </button>

                      {/* Terminar es lo que se usa a fin de corte. Borrar solo
                          sirve para una cohorte que nunca llegó a arrancar:
                          con estudiantes dentro hay asistencias, notas y
                          carnets emitidos, y eso no se tira. */}
                      <button
                        onClick={() => cambiarEstado(c, c.estado === 'activa' ? 'finalizada' : 'activa')}
                        disabled={guardando}
                        className="min-h-11 flex-1 rounded-lg border border-zr-blue-mid/50 text-sm font-semibold text-zr-blue-light disabled:opacity-40"
                      >
                        {c.estado === 'activa' ? 'Terminar' : 'Reabrir'}
                      </button>

                      <button
                        onClick={() => { setBorrando(c.id); setEditando(null); setError(null) }}
                        disabled={c.totalEstudiantes > 0}
                        title={c.totalEstudiantes > 0 ? 'Tiene estudiantes inscritos: se termina, no se borra' : undefined}
                        className="min-h-11 flex-1 rounded-lg border border-zr-error/40 text-sm font-semibold text-zr-error disabled:opacity-35"
                      >
                        Eliminar
                      </button>
                    </div>
                  )}

                  {borrando === c.id && (
                    <div className="space-y-3 rounded-lg border border-zr-error/30 bg-zr-error/10 p-4">
                      <p className="text-sm font-medium text-zr-error">
                        ¿Eliminar {c.name}? No se puede deshacer.
                      </p>
                      {error && <p className="text-sm font-medium text-zr-error">{error}</p>}
                      <div className="flex gap-3">
                        <button
                          onClick={limpiar}
                          className="min-h-11 flex-1 rounded-lg border border-zr-border text-sm font-semibold text-zr-text"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => borrarCohorte(c)}
                          disabled={guardando}
                          className="min-h-11 flex-1 rounded-lg bg-zr-error text-sm font-bold text-white disabled:opacity-40"
                        >
                          {guardando ? 'Eliminando…' : 'Sí, eliminar'}
                        </button>
                      </div>
                    </div>
                  )}

                  {editando === c.id && (
                    <div className="space-y-4 border-t border-zr-border pt-4">
                      <Texto etiqueta="Nombre" valor={nombre} onChange={setNombre} />
                      <SelectorSede
                        sede={sede} setSede={setSede}
                        sedeNueva={sedeNueva} setSedeNueva={setSedeNueva}
                        conocidas={sedesConocidas}
                      />
                      <SelectorTurno turno={turno} setTurno={setTurno} />
                      <Texto etiqueta="Días" valor={dias} onChange={setDias} placeholder="Sábados" />
                      <Texto etiqueta="Horario" valor={horario} onChange={setHorario} placeholder="9:00 a.m. – 12:00 p.m." />
                      {error && <p className="text-sm font-medium text-zr-error">{error}</p>}
                      <div className="flex gap-3">
                        <button
                          onClick={limpiar}
                          className="min-h-14 flex-1 rounded-lg border border-zr-border text-base font-semibold text-zr-text"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => guardarEdicion(c)}
                          disabled={!nombre.trim() || guardando}
                          className="min-h-14 flex-1 rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-40"
                        >
                          {guardando ? 'Guardando…' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {creando === p.id ? (
                <div className="zr-card space-y-4 p-5">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-zr-text">Fecha de inicio</label>
                    <input
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
                    />
                  </div>

                  <SelectorSede
                    sede={sede} setSede={setSede}
                    sedeNueva={sedeNueva} setSedeNueva={setSedeNueva}
                    conocidas={sedesConocidas}
                  />
                  <SelectorTurno turno={turno} setTurno={setTurno} />
                  <Texto etiqueta="Días" valor={dias} onChange={setDias} placeholder="Sábados" />
                  <Texto etiqueta="Horario" valor={horario} onChange={setHorario} placeholder="9:00 a.m. – 12:00 p.m." />

                  <div className="rounded-lg border border-zr-blue-mid/30 bg-zr-blue/10 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zr-text-muted">
                      Se llamará
                    </p>
                    <p className="mt-1 text-base font-bold text-zr-blue-light">
                      {previsto ?? 'Elige la fecha de inicio'}
                    </p>
                    <p className="mt-1.5 text-xs text-zr-text-muted">
                      El nombre y el número de corte los pone el sistema, para que no haya dos cohortes iguales.
                    </p>
                  </div>

                  {error && <p className="text-sm font-medium text-zr-error">{error}</p>}

                  <div className="flex gap-3">
                    <button
                      onClick={limpiar}
                      className="min-h-14 flex-1 rounded-lg border border-zr-border text-base font-semibold text-zr-text"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => crearCohorte(p)}
                      disabled={!fechaInicio || !sedeElegida() || guardando}
                      className="min-h-14 flex-1 rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-40"
                    >
                      {guardando ? 'Creando…' : 'Crear'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { limpiar(); setCreando(p.id) }}
                  className="zr-card zr-card-interactive flex min-h-14 w-full items-center justify-center px-6 text-sm font-bold text-zr-blue"
                >
                  + Nueva cohorte de {p.siglas}
                </button>
              )}
            </div>
          </Seccion>
        )
      })}
    </div>
  )
}

function Texto({
  etiqueta, valor, onChange, placeholder = '',
}: { etiqueta: string; valor: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-zr-text">{etiqueta}</label>
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
      />
    </div>
  )
}

function SelectorSede({
  sede, setSede, sedeNueva, setSedeNueva, conocidas,
}: {
  sede: string; setSede: (v: string) => void
  sedeNueva: string; setSedeNueva: (v: string) => void
  conocidas: string[]
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-zr-text">Sede</label>
      <select
        value={sede}
        onChange={(e) => setSede(e.target.value)}
        className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
      >
        <option value="">Selecciona una sede</option>
        {conocidas.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
        <option value="__nueva__">Otra sede…</option>
      </select>
      {sede === '__nueva__' && (
        <input
          value={sedeNueva}
          onChange={(e) => setSedeNueva(e.target.value)}
          placeholder="Nombre de la sede nueva"
          className="mt-2 w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
        />
      )}
    </div>
  )
}

function SelectorTurno({
  turno, setTurno,
}: { turno: 'mañana' | 'tarde'; setTurno: (v: 'mañana' | 'tarde') => void }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-zr-text">Turno</label>
      <select
        value={turno}
        onChange={(e) => setTurno(e.target.value as 'mañana' | 'tarde')}
        className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
      >
        <option value="mañana">Mañana</option>
        <option value="tarde">Tarde</option>
      </select>
    </div>
  )
}
