'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { esDireccionAcademica } from '@/lib/auth-helpers'
import type { UserRole } from '@/lib/types'

/**
 * spec/03_EDGE_FUNCTIONS.md · FUNCIÓN 6 create-staff-user.
 *
 * Es la ÚNICA vía para que exista personal — el disparador handle_new_user
 * siempre crea perfiles como 'estudiante', y ningún formulario público deja
 * elegir el rol. Esta pantalla llamaba a la función pero nunca se había
 * construido: la Edge Function existía y estaba desplegada sin que nada en
 * la app pudiera invocarla.
 *
 * Un admin normal puede dar de alta profesores. Solo un super_admin puede
 * dar de alta otro admin o super_admin — la Edge Function es la que de
 * verdad lo exige; el filtro de aquí es solo para no ofrecer una opción
 * que el servidor va a rechazar.
 */

interface Miembro {
  id: string
  cedula: string
  nombre: string
  correo: string | null
  rol: UserRole
  cohortes: string[]
}

interface Cohorte {
  id: string
  nombre: string
  moduloNombre: string | null
  profesorId: string | null
}

interface Modulo {
  id: string
  nombre: string
  orden: number
  programa: string
}

// Cómo se llama cada rol en pantalla. La base y el código siguen en inglés
// (CLAUDE.md §9); esto es lo único que ve el usuario.
const ETIQUETA_ROL: Partial<Record<UserRole, { texto: string; tono: 'info' | 'aviso' | 'exito' }>> = {
  super_admin:         { texto: 'Super admin',         tono: 'info' },
  direccion_academica: { texto: 'Dirección académica', tono: 'info' },
  admin:               { texto: 'Administración',      tono: 'aviso' },
  vendedor:            { texto: 'Vendedor',            tono: 'aviso' },
  profesor:            { texto: 'Profesor',            tono: 'exito' },
}

const ROLES: { valor: UserRole; etiqueta: string; soloSuper: boolean }[] = [
  { valor: 'profesor', etiqueta: 'Profesor', soloSuper: false },
  { valor: 'admin', etiqueta: 'Administrador', soloSuper: true },
  { valor: 'direccion_academica', etiqueta: 'Dirección Académica', soloSuper: true },
  { valor: 'super_admin', etiqueta: 'Super admin', soloSuper: true },
]

export default function Personal() {
  const router = useRouter()
  const [miRol, setMiRol] = useState<UserRole | null>(null)
  const [equipo, setEquipo] = useState<Miembro[]>([])
  const [cargando, setCargando] = useState(true)
  const [version, setVersion] = useState(0)

  const [cohortes, setCohortes] = useState<Cohorte[]>([])
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [asignaciones, setAsignaciones] = useState<Map<string, Set<string>>>(new Map())
  const [expandido, setExpandido] = useState<string | null>(null)
  const [guardandoModulo, setGuardandoModulo] = useState<string | null>(null)

  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [cedula, setCedula] = useState('')
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState<UserRole>('profesor')
  const [cohorteId, setCohorteId] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!vigente) return

      const rolActual = (perfil?.role as UserRole) ?? null
      // Gestionar personal es de Dirección Académica y super_admin — un
      // admin normal ya no da de alta profesores (eso pasó a ser trabajo
      // académico, no administrativo).
      if (!esDireccionAcademica(rolActual)) {
        router.replace('/panel')
        return
      }
      setMiRol(rolActual)

      const [{ data }, { data: cohs }, { data: mods }, { data: asigs }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, cedula, full_name, contact_email, role')
          .in('role', ['profesor', 'admin', 'super_admin', 'direccion_academica', 'vendedor'])
          .order('role'),
        // "A qué curso da clase" es, en el modelo de datos, "qué cohorte
        // tiene asignada": cohorts.teacher_id es lo único que vincula a un
        // profesor con lo que dicta — no hay un campo separado de
        // "programa" en el profesor. Se listan todas las activas, con o
        // sin profesor, para poder tanto asignar como reasignar.
        supabase
          .from('cohorts')
          .select('id, name, teacher_id, modules(name)')
          .eq('status', 'activa'),
        // C-2 (docs/18_BRECHAS_SPEC_FUNCIONAL_ZRM.md): además de la cohorte,
        // un profesor puede tener módulos propios asignados (spec §7).
        supabase.from('modules').select('id, name, order_index, programs(name)').order('order_index'),
        supabase.from('teacher_module_assignments').select('teacher_id, module_id'),
      ])

      if (!vigente) return

      const filasCohorte = (cohs ?? []) as unknown as {
        id: string; name: string; teacher_id: string | null; modules: { name: string } | null
      }[]

      const cohortesMapeadas = filasCohorte.map((c) => ({
        id: c.id,
        nombre: c.name,
        moduloNombre: c.modules?.name ?? null,
        profesorId: c.teacher_id,
      }))
      setCohortes(cohortesMapeadas)

      setModulos(
        ((mods ?? []) as unknown as { id: string; name: string; order_index: number; programs: { name: string } | null }[])
          .map((m) => ({ id: m.id, nombre: m.name, orden: m.order_index, programa: m.programs?.name ?? '—' })),
      )

      const mapaAsignaciones = new Map<string, Set<string>>()
      for (const a of asigs ?? []) {
        const set = mapaAsignaciones.get(a.teacher_id) ?? new Set<string>()
        set.add(a.module_id)
        mapaAsignaciones.set(a.teacher_id, set)
      }
      setAsignaciones(mapaAsignaciones)

      setEquipo(
        (data ?? []).map((p) => ({
          id: p.id,
          cedula: p.cedula,
          nombre: p.full_name,
          correo: p.contact_email,
          rol: p.role as UserRole,
          cohortes: cohortesMapeadas.filter((c) => c.profesorId === p.id).map((c) => c.nombre),
        })),
      )
      setCargando(false)
    }

    cargar()
    return () => { vigente = false }
  }, [router, version])

  function generarPassword() {
    // Contraseña temporal legible, no la definitiva: el nuevo profesor la
    // cambia desde "¿Olvidaste tu contraseña?" en su primer ingreso.
    const parte = Math.random().toString(36).slice(-6)
    setPassword(`ZR-${parte}!1`)
  }

  async function crear() {
    setGuardando(true)
    setError(null)
    setExito(null)

    const supabase = createClient()
    const { data, error: fallo } = await supabase.functions.invoke('create-staff-user', {
      body: {
        cedula: cedula.trim().toUpperCase(),
        fullName: nombre.trim(),
        email: correo.trim(),
        password,
        role: rol,
      },
    })

    if (fallo) {
      const contexto = (fallo as { context?: { json?: () => Promise<unknown> } }).context
      if (contexto?.json) {
        const cuerpo = (await contexto.json()) as { error?: { message: string } }
        setError(cuerpo.error?.message ?? 'No se pudo crear la cuenta.')
      } else {
        setError('No se pudo crear la cuenta. Revisa tu conexión.')
      }
      setGuardando(false)
      return
    }

    // Asignar la cohorte es un paso aparte, no algo que create-staff-user
    // deba saber hacer — esa función solo crea cuentas. Si esto falla, la
    // cuenta ya existe y se puede asignar después desde /cohortes; no vale
    // la pena deshacer la creación por un problema en el segundo paso.
    let avisoCohorte = ''
    const nuevoId = (data as { userId?: string } | null)?.userId
    if (rol === 'profesor' && cohorteId && nuevoId) {
      const { error: falloCohorte } = await supabase
        .from('cohorts')
        .update({ teacher_id: nuevoId })
        .eq('id', cohorteId)

      avisoCohorte = falloCohorte
        ? ' No se pudo asignar la cohorte — hazlo desde Cohortes.'
        : ' Ya tiene su cohorte asignada.'
    }

    setExito(`Cuenta creada. Cédula ${cedula.trim().toUpperCase()} · contraseña temporal: ${password}.${avisoCohorte}`)
    setNombre('')
    setCedula('')
    setCorreo('')
    setPassword('')
    setRol('profesor')
    setCohorteId('')
    setCreando(false)
    setGuardando(false)
    setVersion((v) => v + 1)
  }

  async function alternarModulo(teacherId: string, moduleId: string) {
    const claveOcupado = `${teacherId}|${moduleId}`
    setGuardandoModulo(claveOcupado)
    const supabase = createClient()
    const yaAsignado = asignaciones.get(teacherId)?.has(moduleId) ?? false

    if (yaAsignado) {
      await supabase.from('teacher_module_assignments')
        .delete().eq('teacher_id', teacherId).eq('module_id', moduleId)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('teacher_module_assignments')
        .insert({ teacher_id: teacherId, module_id: moduleId, assigned_by: user?.id ?? null })
    }

    setAsignaciones((prev) => {
      const copia = new Map(prev)
      const set = new Set(copia.get(teacherId) ?? [])
      if (yaAsignado) set.delete(moduleId); else set.add(moduleId)
      copia.set(teacherId, set)
      return copia
    })
    setGuardandoModulo(null)
  }

  async function eliminar(id: string, nombre: string) {
    if (!confirm(`¿Borrar la cuenta de ${nombre}? Esto no se puede deshacer.`)) return
    setEliminando(id)
    setError(null)

    const supabase = createClient()
    const { error: fallo } = await supabase.functions.invoke('delete-account', {
      body: { profileId: id },
    })

    if (fallo) {
      const contexto = (fallo as { context?: { json?: () => Promise<unknown> } }).context
      if (contexto?.json) {
        const cuerpo = (await contexto.json()) as { error?: { message: string } }
        setError(cuerpo.error?.message ?? 'No se pudo borrar la cuenta.')
      } else {
        setError('No se pudo borrar la cuenta. Revisa tu conexión.')
      }
      setEliminando(null)
      return
    }

    setEquipo((eq) => eq.filter((m) => m.id !== id))
    setEliminando(null)
  }

  const rolesDisponibles = ROLES.filter((r) => !r.soloSuper || miRol === 'super_admin')
  const formularioCompleto = nombre.trim() && cedula.trim() && correo.trim() && password.trim().length >= 8

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando personal…</p>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14 pb-10">
      <BotonVolver href="/panel" />

      <Encabezado
        sobretitulo="Administración"
        titulo="Personal"
        descripcion={`${equipo.length} en total. Un profesor nunca se registra solo — así se crea su cuenta.`}
        accion={
          <button
            onClick={() => { setCreando((c) => !c); setExito(null); setError(null) }}
            className="rounded-lg bg-zr-blue px-5 py-3.5 text-sm font-bold text-white"
          >
            {creando ? 'Cancelar' : '+ Nuevo'}
          </button>
        }
      />

      <Regla delay={60} />

      {exito && (
        <p className="rounded-lg border border-zr-success/30 bg-zr-success/12 px-4 py-3 text-sm font-medium text-zr-success">
          {exito}
        </p>
      )}

      {creando && (
        <div className="zr-card space-y-4 p-6">
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Nombre completo</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Prof. Nombre Apellido"
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Cédula</label>
            <input
              value={cedula}
              onChange={(e) => setCedula(e.target.value.toUpperCase())}
              placeholder="V-12345678"
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Correo de contacto</label>
            <input
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="profesor@correo.com"
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Rol</label>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as UserRole)}
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
            >
              {rolesDisponibles.map((r) => (
                <option key={r.valor} value={r.valor}>{r.etiqueta}</option>
              ))}
            </select>
          </div>

          {rol === 'profesor' && (
            <div>
              <label className="mb-2 block text-sm font-semibold text-zr-text">
                Cohorte a cargo <span className="font-normal text-zr-text-muted">(opcional)</span>
              </label>
              <select
                value={cohorteId}
                onChange={(e) => setCohorteId(e.target.value)}
                className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
              >
                <option value="">Sin asignar por ahora</option>
                {cohortes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}{c.moduloNombre ? ` · ${c.moduloNombre}` : ''}{c.profesorId ? ' (ya tiene profesor)' : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-zr-text-muted">
                Elegir una cohorte que ya tiene profesor se la quita a quien la tenía antes.
              </p>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Contraseña temporal</label>
            <div className="flex gap-2">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="min-w-0 flex-1 rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
              />
              <button
                onClick={generarPassword}
                className="shrink-0 rounded-lg border border-zr-border px-4 text-sm font-semibold text-zr-text"
              >
                Generar
              </button>
            </div>
            <p className="mt-1.5 text-xs text-zr-text-muted">
              Se la das tú por fuera de la app. El profesor la cambia en su primer ingreso.
            </p>
          </div>

          {error && <p className="text-sm font-medium text-zr-error">{error}</p>}

          <button
            onClick={crear}
            disabled={!formularioCompleto || guardando}
            className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-40"
          >
            {guardando ? 'Creando…' : 'Crear cuenta'}
          </button>
        </div>
      )}

      {equipo.length === 0 ? (
        <div className="zr-card p-8 text-center">
          <p className="text-base font-semibold text-zr-text">Todavía no hay personal registrado</p>
        </div>
      ) : (
        <Seccion numero={1} titulo="Equipo" delay={120}>
          <div className="space-y-3">
            {equipo.map((m) => {
              const misModulos = asignaciones.get(m.id) ?? new Set<string>()
              return (
              <div key={m.id} className="zr-card space-y-3 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-zr-text">{m.nombre}</p>
                    <p className="mt-1 text-sm tabular-nums text-zr-text-muted">{m.cedula}</p>
                    {m.rol === 'profesor' && (
                      <p className="mt-1 truncate text-xs text-zr-text-muted">
                        {m.cohortes.length > 0 ? m.cohortes.join(' · ') : 'Sin cohorte asignada'}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <Etiqueta tono={ETIQUETA_ROL[m.rol]?.tono ?? 'exito'}>
                      {ETIQUETA_ROL[m.rol]?.texto ?? m.rol}
                    </Etiqueta>
                    {/* Mostrar Eliminar según jerarquía: direccion_academica puede borrar
                        profesores y admins; super_admin puede borrar a cualquiera */}
                    {miRol && (() => {
                      const puedeEliminar =
                        miRol === 'super_admin' ||
                        (miRol === 'direccion_academica' && (m.rol === 'profesor' || m.rol === 'admin'))
                      return puedeEliminar ? (
                        <button
                          onClick={() => eliminar(m.id, m.nombre)}
                          disabled={eliminando === m.id}
                          className="rounded-lg border border-zr-error/40 px-3 py-1.5 text-xs font-semibold text-zr-error disabled:opacity-50"
                        >
                          {eliminando === m.id ? '…' : 'Eliminar'}
                        </button>
                      ) : null
                    })()}
                  </div>
                </div>

                {m.rol === 'profesor' && (
                  <div className="border-t border-zr-border/60 pt-3">
                    <button
                      onClick={() => setExpandido((e) => (e === m.id ? null : m.id))}
                      className="text-xs font-bold uppercase tracking-wide text-zr-blue-mid"
                    >
                      {expandido === m.id ? 'Ocultar módulos' : `Módulos asignados (${misModulos.size})`}
                    </button>

                    {expandido === m.id && (
                      <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                        {modulos.map((mod) => {
                          const activo = misModulos.has(mod.id)
                          const ocupado = guardandoModulo === `${m.id}|${mod.id}`
                          return (
                            <button
                              key={mod.id}
                              onClick={() => alternarModulo(m.id, mod.id)}
                              disabled={ocupado}
                              className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-50 ${
                                activo ? 'bg-zr-blue/15 text-zr-blue' : 'text-zr-text-muted active:bg-zr-border/40'
                              }`}
                            >
                              <span className="min-w-0 truncate">
                                {mod.orden}. {mod.nombre}
                                <span className="ml-1.5 text-xs text-zr-text-muted">· {mod.programa}</span>
                              </span>
                              {activo && <span className="shrink-0 text-xs font-bold">✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
              )
            })}
          </div>
        </Seccion>
      )}
    </div>
  )
}
