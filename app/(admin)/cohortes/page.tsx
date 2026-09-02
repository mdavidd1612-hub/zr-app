'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'

/**
 * T-211 · Gestión de cohortes.
 *
 * Avanzar de módulo pide confirmación explícita: cambia de golpe el
 * contenido y los exámenes que ve toda la cohorte. No es un ajuste que se
 * deshaga con un clic accidental.
 */

interface Cohorte {
  id: string
  nombre: string
  ubicacion: string | null
  moduloId: string | null
  moduloNombre: string | null
  profesorId: string | null
  profesorNombre: string | null
  estudiantes: number
  estado: string
}

interface Modulo { id: string; name: string; order_index: number }
interface Profesor { id: string; full_name: string }

export default function Cohortes() {
  const router = useRouter()
  const [cohortes, setCohortes] = useState<Cohorte[]>([])
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [profesores, setProfesores] = useState<Profesor[]>([])
  const [programas, setProgramas] = useState<{ id: string; name: string }[]>([])
  const [programaId, setProgramaId] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [version, setVersion] = useState(0)

  const [creando, setCreando] = useState(false)
  const [nombreNueva, setNombreNueva] = useState('')
  const [ubicacionNueva, setUbicacionNueva] = useState('')
  // Días y horario de la cohorte: es lo que sale impreso en la planilla del
  // estudiante (migración 052). No se le pide al vendedor.
  const [diasNueva, setDiasNueva] = useState('Sábados')
  const [horarioNueva, setHorarioNueva] = useState('')
  // La fecha de inicio define el año del código de carnet, y la sede y el turno
  // eran campos que esta pantalla nunca pidió aunque la cohorte los tiene
  // (migración 043). Sin ellos la cohorte nacía a medias.
  const [fechaInicioNueva, setFechaInicioNueva] = useState('')
  const [sedeNueva, setSedeNueva] = useState('')
  const [sedeLibre, setSedeLibre] = useState('')
  const [turnoNueva, setTurnoNueva] = useState<'mañana' | 'tarde'>('mañana')
  const [sedesConocidas, setSedesConocidas] = useState<string[]>([])
  const [moduloNueva, setModuloNueva] = useState('')
  const [profesorNueva, setProfesorNueva] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [creada, setCreada] = useState<string | null>(null)

  const [confirmandoAvance, setConfirmandoAvance] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true

    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const [{ data: cohs }, { data: mods }, { data: profs }, { data: programa }] = await Promise.all([
        supabase.from('cohorts').select('id, name, location, sede, current_module_id, teacher_id, status, modules(name), teachers(profiles(full_name)), students(id)'),
        supabase.from('modules').select('id, name, order_index').order('order_index'),
        supabase.from('teachers').select('id, profiles(full_name)').eq('is_active', true),
        // Antes se tomaba `limit(1).single()`: la cohorte nueva caía siempre en
        // el primer programa que devolviera la base, así que una cohorte de PFTA
        // podía quedar colgada de PTMA — y el prefijo del carnet sale del
        // programa. Ahora se eligen todos y el usuario dice cuál.
        supabase.from('programs').select('id, name').order('name'),
      ])

      if (!vigente) return

      const filas = cohs as unknown as {
        id: string; name: string; location: string | null; sede: string | null
        current_module_id: string | null; teacher_id: string | null; status: string
        modules: { name: string } | null
        teachers: { profiles: { full_name: string } | null } | null
        students: { id: string }[] | null
      }[] | null

      setCohortes(
        (filas ?? []).map((c) => ({
          id: c.id,
          nombre: c.name,
          ubicacion: c.location,
          moduloId: c.current_module_id,
          moduloNombre: c.modules?.name ?? null,
          profesorId: c.teacher_id,
          profesorNombre: c.teachers?.profiles?.full_name ?? null,
          estudiantes: c.students?.length ?? 0,
          estado: c.status,
        })),
      )

      setModulos(mods ?? [])
      const listaProfes = (profs as unknown as { id: string; profiles: { full_name: string } | null }[] | null) ?? []
      setProfesores(listaProfes.map((p) => ({ id: p.id, full_name: p.profiles?.full_name ?? 'Sin nombre' })))

      setProgramas(programa ?? [])
      setProgramaId((actual) => actual ?? programa?.[0]?.id ?? null)

      setSedesConocidas([...new Set(
        (filas ?? []).map((c) => c.sede).filter((s): s is string => Boolean(s)),
      )].sort())

      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router, version])

  async function crearCohorte() {
    if (!nombreNueva.trim() || !programaId || !fechaInicioNueva) return
    setGuardando(true)
    setError(null)
    setCreada(null)

    const sedeFinal = (sedeNueva === '__nueva__' ? sedeLibre : sedeNueva).trim()

    // code_number lo asigna el servidor (migración 057). Se lee de vuelta para
    // confirmarle a administración qué número de corte quedó.
    const { data, error: fallo } = await createClient().from('cohorts').insert({
      program_id: programaId,
      name: nombreNueva.trim(),
      location: ubicacionNueva.trim() || null,
      sede: sedeFinal || null,
      turno: turnoNueva,
      start_date: fechaInicioNueva,
      days: diasNueva.trim() || null,
      schedule: horarioNueva.trim() || null,
      current_module_id: moduloNueva || null,
      teacher_id: profesorNueva || null,
    }).select('name, code_number').single()

    if (fallo) {
      setError(
        fallo.code === '23505'
          ? 'Ya existe una cohorte con ese nombre o ese número de corte en el programa.'
          : fallo.message,
      )
      setGuardando(false)
      return
    }

    setCreada(
      `Cohorte "${data.name}" creada: corte ${String(data.code_number).padStart(2, '0')} de ${fechaInicioNueva.slice(0, 4)}.`,
    )

    setNombreNueva('')
    setUbicacionNueva('')
    setDiasNueva('Sábados')
    setHorarioNueva('')
    setFechaInicioNueva('')
    setSedeNueva('')
    setSedeLibre('')
    setTurnoNueva('mañana')
    setModuloNueva('')
    setProfesorNueva('')
    setCreando(false)
    setGuardando(false)
    setVersion((v) => v + 1)
  }

  async function asignarProfesor(cohorteId: string, profesorId: string) {
    await createClient().from('cohorts').update({ teacher_id: profesorId || null }).eq('id', cohorteId)
    setVersion((v) => v + 1)
  }

  async function avanzarModulo(cohorteId: string, moduloId: string) {
    await createClient().from('cohorts').update({ current_module_id: moduloId }).eq('id', cohorteId)
    setConfirmandoAvance(null)
    setVersion((v) => v + 1)
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando cohortes…</p>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14">
      <BotonVolver href="/panel" />

      <Encabezado
        sobretitulo="Administración"
        titulo="Cohortes"
        descripcion={`${cohortes.length} en total`}
        accion={
          <button
            onClick={() => setCreando((c) => !c)}
            className="rounded-lg bg-zr-blue px-5 py-3.5 text-sm font-bold text-white"
          >
            {creando ? 'Cancelar' : '+ Nueva'}
          </button>
        }
      />

      <Regla delay={60} />

      {creada && (
        <p className="rounded-lg border border-zr-success/30 bg-zr-success/12 px-4 py-3 text-sm font-medium text-zr-success">
          {creada}
        </p>
      )}

      {creando && (
        <div className="zr-card space-y-4 p-6">
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Programa</label>
            <select
              value={programaId ?? ''}
              onChange={(e) => setProgramaId(e.target.value || null)}
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
            >
              {programas.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-zr-text-muted">
              Define el prefijo del carnet de sus estudiantes (PTMA o PFTA).
            </p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Nombre</label>
            <input
              value={nombreNueva}
              onChange={(e) => setNombreNueva(e.target.value)}
              placeholder="Ej: Cohorte 2026-C · Sábado 2:00 pm"
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Fecha de inicio</label>
            <input
              type="date"
              value={fechaInicioNueva}
              onChange={(e) => setFechaInicioNueva(e.target.value)}
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
            />
            <p className="mt-1.5 text-xs text-zr-text-muted">
              Define el año del carnet. El número de corte lo asigna el sistema.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-sm font-semibold text-zr-text">Sede</label>
              <select
                value={sedeNueva}
                onChange={(e) => setSedeNueva(e.target.value)}
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
              >
                <option value="">Sin asignar</option>
                {sedesConocidas.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
                <option value="__nueva__">Otra sede…</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-zr-text">Turno</label>
              <select
                value={turnoNueva}
                onChange={(e) => setTurnoNueva(e.target.value as 'mañana' | 'tarde')}
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
              >
                <option value="mañana">Mañana</option>
                <option value="tarde">Tarde</option>
              </select>
            </div>
          </div>
          {sedeNueva === '__nueva__' && (
            <input
              value={sedeLibre}
              onChange={(e) => setSedeLibre(e.target.value)}
              placeholder="Nombre de la sede nueva"
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
            />
          )}
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Ubicación</label>
            <input
              value={ubicacionNueva}
              onChange={(e) => setUbicacionNueva(e.target.value)}
              placeholder="Ej: Taller 2"
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-sm font-semibold text-zr-text">Días</label>
              <input
                value={diasNueva}
                onChange={(e) => setDiasNueva(e.target.value)}
                placeholder="Sábados"
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-zr-text">Horario</label>
              <input
                value={horarioNueva}
                onChange={(e) => setHorarioNueva(e.target.value)}
                placeholder="9:00 a.m. – 12:00 p.m."
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
              />
            </div>
          </div>
          <p className="-mt-1 text-xs text-zr-text-muted">
            Es lo que se imprime como &quot;Días y horario&quot; en la planilla del estudiante.
          </p>

          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Módulo inicial</label>
            <select
              value={moduloNueva}
              onChange={(e) => setModuloNueva(e.target.value)}
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
            >
              <option value="">Sin asignar</option>
              {modulos.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Profesor</label>
            <select
              value={profesorNueva}
              onChange={(e) => setProfesorNueva(e.target.value)}
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
            >
              <option value="">Sin asignar</option>
              {profesores.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm font-medium text-zr-error">{error}</p>}

          <button
            onClick={crearCohorte}
            disabled={!nombreNueva.trim() || !programaId || !fechaInicioNueva || guardando}
            className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-40"
          >
            {guardando ? 'Creando…' : 'Crear cohorte'}
          </button>
        </div>
      )}

      {cohortes.length === 0 ? (
        <div className="zr-card p-8 text-center">
          <p className="text-base font-semibold text-zr-text">No hay cohortes todavía</p>
        </div>
      ) : (
        <Seccion numero={1} titulo="Todas" delay={120}>
          <div className="space-y-4">
            {cohortes.map((c) => (
              <div key={c.id} className="zr-card overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-zr-text">{c.nombre}</p>
                      <p className="mt-1 text-sm text-zr-text-muted">{c.ubicacion ?? 'Sin ubicación'}</p>
                    </div>
                    <Etiqueta tono={c.estado === 'activa' ? 'exito' : 'neutro'}>{c.estado}</Etiqueta>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 border-t border-zr-border/60 pt-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-zr-text-muted">Módulo actual</p>
                      <p className="mt-1 text-sm font-medium text-zr-text">{c.moduloNombre ?? 'Sin asignar'}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-zr-text-muted">Estudiantes</p>
                      <p className="mt-1 text-sm font-medium text-zr-text">{c.estudiantes}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 border-t border-zr-border bg-zr-bg/40 p-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-zr-text-muted">Profesor</label>
                    <select
                      value={c.profesorId ?? ''}
                      onChange={(e) => asignarProfesor(c.id, e.target.value)}
                      className="w-full rounded-lg border border-zr-border bg-zr-surface px-3 py-2.5 text-sm text-zr-text focus:border-zr-blue focus:outline-none"
                    >
                      <option value="">Sin asignar</option>
                      {profesores.map((p) => (
                        <option key={p.id} value={p.id}>{p.full_name}</option>
                      ))}
                    </select>
                  </div>

                  {confirmandoAvance === c.id ? (
                    <div className="space-y-2 rounded-lg border border-zr-warning/30 bg-zr-warning/10 p-3">
                      <p className="text-xs text-zr-text">
                        Esto cambia de golpe el contenido y los exámenes que ve toda la
                        cohorte. ¿Seguro?
                      </p>
                      <select
                        id={`avance-${c.id}`}
                        defaultValue=""
                        className="w-full rounded-lg border border-zr-border bg-zr-surface px-3 py-2.5 text-sm text-zr-text"
                      >
                        <option value="" disabled>Elige el módulo siguiente</option>
                        {modulos.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmandoAvance(null)}
                          className="flex-1 rounded-lg border border-zr-border py-2.5 text-sm font-semibold text-zr-text"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => {
                            const sel = document.getElementById(`avance-${c.id}`) as HTMLSelectElement
                            if (sel.value) avanzarModulo(c.id, sel.value)
                          }}
                          className="flex-1 rounded-lg bg-zr-warning py-2.5 text-sm font-bold text-zr-bg"
                        >
                          Confirmar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmandoAvance(c.id)}
                      className="min-h-12 w-full rounded-lg border border-zr-border text-sm font-semibold text-zr-text"
                    >
                      Avanzar de módulo
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Seccion>
      )}
    </div>
  )
}
