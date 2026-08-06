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
  const [programaId, setProgramaId] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [version, setVersion] = useState(0)

  const [creando, setCreando] = useState(false)
  const [nombreNueva, setNombreNueva] = useState('')
  const [ubicacionNueva, setUbicacionNueva] = useState('')
  const [moduloNueva, setModuloNueva] = useState('')
  const [profesorNueva, setProfesorNueva] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        supabase.from('cohorts').select('id, name, location, current_module_id, teacher_id, status, modules(name), teachers(profiles(full_name)), students(id)'),
        supabase.from('modules').select('id, name, order_index').order('order_index'),
        supabase.from('teachers').select('id, profiles(full_name)').eq('is_active', true),
        supabase.from('programs').select('id').limit(1).single(),
      ])

      if (!vigente) return

      const filas = cohs as unknown as {
        id: string; name: string; location: string | null
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
      setProgramaId(programa?.id ?? null)
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router, version])

  async function crearCohorte() {
    if (!nombreNueva.trim() || !programaId) return
    setGuardando(true)
    setError(null)

    const { error: fallo } = await createClient().from('cohorts').insert({
      program_id: programaId,
      name: nombreNueva.trim(),
      location: ubicacionNueva.trim() || null,
      current_module_id: moduloNueva || null,
      teacher_id: profesorNueva || null,
    })

    if (fallo) {
      setError(fallo.message)
      setGuardando(false)
      return
    }

    setNombreNueva('')
    setUbicacionNueva('')
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

      {creando && (
        <div className="zr-card space-y-4 p-6">
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
            <label className="mb-2 block text-sm font-semibold text-zr-text">Ubicación</label>
            <input
              value={ubicacionNueva}
              onChange={(e) => setUbicacionNueva(e.target.value)}
              placeholder="Ej: Taller 2"
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
            />
          </div>
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
            disabled={!nombreNueva.trim() || guardando}
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
