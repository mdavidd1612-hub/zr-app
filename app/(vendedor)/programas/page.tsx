'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'

interface Cohorte {
  id: string
  name: string
  sede: string | null
  turno: string | null
  misEstudiantes: number
}

interface Programa {
  id: string
  name: string
  cohortes: Cohorte[]
}

export default function ProgramasVendedor() {
  const router = useRouter()
  const [programas, setProgramas] = useState<Programa[]>([])
  const [cargando, setCargando] = useState(true)

  const [creando, setCreando] = useState<string | null>(null) // program_id
  const [nombreCohorte, setNombreCohorte] = useState('')
  const [sede, setSede] = useState('')
  const [sedeNueva, setSedeNueva] = useState('')
  const [turno, setTurno] = useState<'mañana' | 'tarde'>('mañana')
  // La fecha de inicio define el AÑO del código de carnet de todos los
  // estudiantes de esta cohorte (PTMA-2026-02-...), así que se pide siempre.
  // Antes no se pedía y quedaba en la fecha de hoy por defecto.
  const [fechaInicio, setFechaInicio] = useState('')
  const [dias, setDias] = useState('Sábados')
  const [horario, setHorario] = useState('')
  const [sedesConocidas, setSedesConocidas] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creada, setCreada] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const [{ data: progs }, { data: mias }] = await Promise.all([
        supabase.from('programs').select('id, name, cohorts(id, name, sede, turno)').order('name'),
        supabase.from('students').select('cohort_id').eq('enrolled_by', user.id),
      ])

      const conteoPorCohorte = new Map<string, number>()
      for (const m of mias ?? []) {
        if (!m.cohort_id) continue
        conteoPorCohorte.set(m.cohort_id, (conteoPorCohorte.get(m.cohort_id) ?? 0) + 1)
      }

      const filas = (progs ?? []) as unknown as {
        id: string; name: string
        cohorts: { id: string; name: string; sede: string | null; turno: string | null }[]
      }[]

      setProgramas(filas.map((p) => ({
        id: p.id,
        name: p.name,
        cohortes: p.cohorts.map((c) => ({
          id: c.id, name: c.name, sede: c.sede, turno: c.turno,
          misEstudiantes: conteoPorCohorte.get(c.id) ?? 0,
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

  async function crearCohorte(programId: string) {
    setGuardando(true)
    setError(null)
    setCreada(null)

    const sedeFinal = (sede === '__nueva__' ? sedeNueva : sede).trim()

    // El correlativo (code_number) NO se manda desde aquí: lo asigna el
    // servidor por (programa, año de la fecha de inicio) — migración 057,
    // regla 2 de AGENTS.md. Se lee de vuelta solo para confirmárselo a ventas.
    const { data, error: fallo } = await createClient().from('cohorts').insert({
      program_id: programId,
      name: nombreCohorte.trim(),
      sede: sedeFinal || null,
      turno,
      start_date: fechaInicio,
      days: dias.trim() || null,
      schedule: horario.trim() || null,
      status: 'activa',
    }).select('name, code_number').single()

    if (fallo) {
      setError(
        fallo.code === '23505'
          ? 'Ya existe una cohorte con ese nombre o ese número en el programa. Revisa la lista de arriba.'
          : fallo.message,
      )
      setGuardando(false)
      return
    }

    const anio = fechaInicio.slice(0, 4)
    setCreada(
      `Cohorte "${data.name}" creada: corte ${String(data.code_number).padStart(2, '0')} de ${anio}. ` +
      `Los carnets de sus estudiantes empezarán por ${nombreCohorte.trim().slice(0, 4).toUpperCase()}-${anio}-${String(data.code_number).padStart(2, '0')}.`,
    )

    setNombreCohorte(''); setSede(''); setSedeNueva(''); setTurno('mañana')
    setFechaInicio(''); setDias('Sábados'); setHorario('')
    setCreando(null)
    setGuardando(false)
    setVersion((v) => v + 1)
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

      {creada && (
        <p className="rounded-lg border border-zr-success/30 bg-zr-success/12 px-4 py-3 text-sm font-medium text-zr-success">
          {creada}
        </p>
      )}

      {programas.map((p, i) => (
        <Seccion key={p.id} numero={i + 1} titulo={p.name} delay={100 + i * 60}>
          <div className="space-y-3">
            {p.cohortes.length === 0 && (
              <p className="zr-card p-5 text-sm text-zr-text-muted">Todavía no hay cohortes en este programa.</p>
            )}
            {p.cohortes.map((c) => (
              <div key={c.id} className="zr-card flex items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zr-text">{c.name}</p>
                  <p className="mt-0.5 text-xs text-zr-text-muted">
                    {c.sede ?? '—'} · {c.turno ?? '—'}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-bold tabular-nums text-zr-blue-mid">
                  {c.misEstudiantes} inscritos por mí
                </span>
              </div>
            ))}

            {creando === p.id ? (
              <div className="zr-card space-y-4 p-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zr-text">Nombre de la cohorte</label>
                  <input
                    value={nombreCohorte}
                    onChange={(e) => setNombreCohorte(e.target.value)}
                    placeholder={`${p.name.split(' ')[0]}-2027-I`}
                    className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zr-text">Fecha de inicio</label>
                  <input
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
                  />
                  <p className="mt-1.5 text-xs text-zr-text-muted">
                    Define el año del carnet de sus estudiantes. El número de corte lo asigna el sistema.
                  </p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zr-text">Sede</label>
                  <select
                    value={sede}
                    onChange={(e) => setSede(e.target.value)}
                    className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
                  >
                    <option value="">Selecciona una sede</option>
                    {sedesConocidas.map((s) => (
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
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zr-text">Días</label>
                  <input
                    value={dias}
                    onChange={(e) => setDias(e.target.value)}
                    placeholder="Sábados"
                    className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zr-text">Horario</label>
                  <input
                    value={horario}
                    onChange={(e) => setHorario(e.target.value)}
                    placeholder="9:00 a.m. – 12:00 p.m."
                    className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
                  />
                </div>
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
                {error && <p className="text-sm font-medium text-zr-error">{error}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={() => setCreando(null)}
                    className="min-h-14 flex-1 rounded-lg border border-zr-border text-base font-semibold text-zr-text"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => crearCohorte(p.id)}
                    disabled={
                      !nombreCohorte.trim() || !fechaInicio ||
                      !(sede === '__nueva__' ? sedeNueva.trim() : sede) ||
                      guardando
                    }
                    className="min-h-14 flex-1 rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-40"
                  >
                    {guardando ? 'Creando…' : 'Crear'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreando(p.id)}
                className="zr-card zr-card-interactive flex min-h-14 w-full items-center justify-center px-6 text-sm font-bold text-zr-blue"
              >
                + Nueva cohorte de {p.name.split(' ')[0]}
              </button>
            )}
          </div>
        </Seccion>
      ))}
    </div>
  )
}
