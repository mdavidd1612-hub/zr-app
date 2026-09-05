'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { esAdmin, esDireccionAcademica } from '@/lib/auth-helpers'
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
 * División de trabajo reafirmada por el coordinador: un admin normal solo
 * da de alta (y ve) otras cuentas de Administración; Dirección Académica da
 * de alta profesores y les asigna módulos/programa; solo super_admin puede
 * dar de alta admin, dirección académica, vendedor u otro super_admin. La
 * Edge Function (create-staff-user) es la que de verdad lo exige — el
 * filtro de aquí es solo para no ofrecer una opción que el servidor va a
 * rechazar.
 */

interface Miembro {
  id: string
  cedula: string
  nombre: string
  correo: string | null
  rol: UserRole
  cohortes: string[]
}

// Roles adicionales por cuenta (migración 085 — pedido explícito del
// coordinador): Erika Hidalgo, vendedora, también necesita entrar como
// administración sin una segunda cuenta (la cédula es única por persona).
// `rol` sigue siendo el rol ACTIVO de cada quien; esto es la lista de roles
// que además tiene permitido usar — al iniciar sesión, si tiene más de uno,
// elige con cuál entra (app/elegir-rol).

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
  // Solo super_admin (R-16): un vendedor tiene acceso comercial, no es una
  // decisión de Dirección Académica.
  { valor: 'vendedor', etiqueta: 'Vendedor', soloSuper: true },
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
  const [guardandoAsignacionModulo, setGuardandoAsignacionModulo] = useState<string | null>(null)
  const [rolesExtra, setRolesExtra] = useState<Map<string, Set<UserRole>>>(new Map())
  const [expandidoRoles, setExpandidoRoles] = useState<string | null>(null)
  const [guardandoRol, setGuardandoRol] = useState<string | null>(null)

  // Sedes por administrador (migración 087 — pedido explícito del
  // coordinador): un admin sin sede asignada ve todo, sin restringir nada —
  // esto es solo para los dos administradores reales (Cecilia, con las dos
  // sedes; Erika, solo UCV) que sí necesitan sus listas separadas.
  const [sedes, setSedes] = useState<{ id: string; nombre: string }[]>([])
  const [sedesAsignadas, setSedesAsignadas] = useState<Map<string, Set<string>>>(new Map())
  const [expandidoSedes, setExpandidoSedes] = useState<string | null>(null)
  const [guardandoSede, setGuardandoSede] = useState<string | null>(null)

  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [cedula, setCedula] = useState('')
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState<UserRole>('profesor')
  const [cohorteId, setCohorteId] = useState('')
  const [modulosNuevo, setModulosNuevo] = useState<Set<string>>(new Set())
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
      // División de trabajo reafirmada por el coordinador: profesores,
      // asignación de módulos y roles/sedes de terceros siguen siendo de
      // Dirección Académica y super_admin. Un admin normal SÍ entra aquí,
      // pero solo para dar de alta y ver otras cuentas de Administración
      // (nada de profesores, nada de asignar roles o sedes ajenas) — se
      // filtra más abajo con `soloAdmin`.
      if (!esAdmin(rolActual)) {
        router.replace('/panel')
        return
      }
      setMiRol(rolActual)

      // Un admin normal solo ve (y da de alta) otras cuentas de
      // Administración — nada de profesores, dirección académica, super
      // admin o vendedor, eso lo sigue gestionando Dirección Académica.
      const rolesVisibles: UserRole[] = rolActual === 'admin'
        ? ['admin']
        : ['profesor', 'admin', 'super_admin', 'direccion_academica', 'vendedor']

      const [{ data }, { data: cohs }, { data: mods }, { data: asigs }, { data: rolesExtraData }, { data: sedesData }, { data: adminSedesData }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, cedula, full_name, contact_email, role')
          .in('role', rolesVisibles)
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
        supabase.from('profile_roles').select('profile_id, role'),
        supabase.from('sedes').select('id, nombre').eq('activa', true).order('nombre'),
        supabase.from('admin_sedes').select('profile_id, sede_id'),
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

      const mapaRolesExtra = new Map<string, Set<UserRole>>()
      for (const r of rolesExtraData ?? []) {
        const set = mapaRolesExtra.get(r.profile_id) ?? new Set<UserRole>()
        set.add(r.role as UserRole)
        mapaRolesExtra.set(r.profile_id, set)
      }
      setRolesExtra(mapaRolesExtra)

      setSedes(sedesData ?? [])
      const mapaSedes = new Map<string, Set<string>>()
      for (const s of adminSedesData ?? []) {
        const set = mapaSedes.get(s.profile_id) ?? new Set<string>()
        set.add(s.sede_id)
        mapaSedes.set(s.profile_id, set)
      }
      setSedesAsignadas(mapaSedes)

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

    // Asignar módulos/cohorte son pasos aparte, no algo que create-staff-user
    // deba saber hacer — esa función solo crea cuentas. Si esto falla, la
    // cuenta ya existe y se puede asignar después desde aquí mismo o desde
    // Programas; no vale la pena deshacer la creación por un problema en un
    // segundo paso.
    let avisoAsignacion = ''
    const nuevoId = (data as { userId?: string } | null)?.userId

    if (rol === 'profesor' && nuevoId) {
      // Lo normal es que un profesor dicte módulos específicos (a veces en
      // más de un programa), no que "sea dueño" de un programa completo —
      // pedido explícito del coordinador. La cohorte sigue siendo aparte
      // porque cohorts.teacher_id es lo que de verdad controla asistencia y
      // sesiones (migración 056); los módulos son solo para saber qué dicta.
      if (modulosNuevo.size > 0) {
        const { error: falloModulos } = await supabase
          .from('teacher_module_assignments')
          .insert([...modulosNuevo].map((moduleId) => ({ teacher_id: nuevoId, module_id: moduleId })))

        avisoAsignacion += falloModulos
          ? ' No se pudieron guardar los módulos — hazlo desde aquí abajo.'
          : ` Ya tiene ${modulosNuevo.size} módulo${modulosNuevo.size === 1 ? '' : 's'} asignado${modulosNuevo.size === 1 ? '' : 's'}.`
      }

      if (cohorteId) {
        const { error: falloCohorte } = await supabase
          .from('cohorts')
          .update({ teacher_id: nuevoId })
          .eq('id', cohorteId)

        avisoAsignacion += falloCohorte
          ? ' No se pudo asignar el programa — hazlo desde Programas.'
          : ' Ya tiene su programa asignado.'
      }
    }

    setExito(`Cuenta creada. Cédula ${cedula.trim().toUpperCase()} · contraseña temporal: ${password}.${avisoAsignacion}`)
    setNombre('')
    setCedula('')
    setCorreo('')
    setPassword('')
    setRol('profesor')
    setCohorteId('')
    setModulosNuevo(new Set())
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

  // Vista "por módulo" (pedido explícito del coordinador): en vez de ir
  // profesor por profesor marcando módulos sueltos, aquí se recorre el
  // programa completo módulo por módulo y se elige un solo profesor para
  // cada uno — más fácil de ver qué módulos quedaron sin cubrir. Escribe
  // en la misma tabla (teacher_module_assignments) que el toggle de abajo;
  // asignar aquí reemplaza cualquier profesor anterior de ese módulo.
  async function asignarProfesorDelModulo(moduloId: string, nuevoProfesorId: string) {
    setGuardandoAsignacionModulo(moduloId)
    const supabase = createClient()

    const profesoresAnteriores = [...asignaciones.entries()]
      .filter(([, mods]) => mods.has(moduloId))
      .map(([teacherId]) => teacherId)

    await supabase.from('teacher_module_assignments').delete().eq('module_id', moduloId)

    if (nuevoProfesorId) {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('teacher_module_assignments')
        .insert({ teacher_id: nuevoProfesorId, module_id: moduloId, assigned_by: user?.id ?? null })
    }

    setAsignaciones((prev) => {
      const copia = new Map(prev)
      for (const teacherId of profesoresAnteriores) {
        const set = new Set(copia.get(teacherId) ?? [])
        set.delete(moduloId)
        copia.set(teacherId, set)
      }
      if (nuevoProfesorId) {
        const set = new Set(copia.get(nuevoProfesorId) ?? [])
        set.add(moduloId)
        copia.set(nuevoProfesorId, set)
      }
      return copia
    })
    setGuardandoAsignacionModulo(null)
  }

  async function alternarRol(miembro: Miembro, rol: UserRole) {
    // El rol activo de la cuenta (miembro.rol) siempre debe seguir en su
    // lista de roles permitidos — si no, fn_cambiar_mi_rol jamás la dejaría
    // volver a él. Se ignora el click en vez de dejar que alguien se quite
    // sin querer el único rol con el que puede entrar hoy.
    if (rol === miembro.rol) return

    const claveOcupado = `${miembro.id}|${rol}`
    setGuardandoRol(claveOcupado)
    const supabase = createClient()
    const yaAsignado = rolesExtra.get(miembro.id)?.has(rol) ?? false

    if (yaAsignado) {
      await supabase.from('profile_roles').delete().eq('profile_id', miembro.id).eq('role', rol)
    } else {
      // Además del rol nuevo, se asegura que su rol activo actual también
      // esté en la lista (upsert, sin duplicar) — cuentas creadas después de
      // la migración 085 no lo tienen todavía, y sin esto se quedarían sin
      // forma de volver a su rol de siempre desde el selector al iniciar
      // sesión.
      await supabase.from('profile_roles').upsert(
        [{ profile_id: miembro.id, role: rol }, { profile_id: miembro.id, role: miembro.rol }],
        { onConflict: 'profile_id,role', ignoreDuplicates: true },
      )
    }

    setRolesExtra((prev) => {
      const copia = new Map(prev)
      const set = new Set(copia.get(miembro.id) ?? [])
      if (yaAsignado) {
        set.delete(rol)
      } else {
        set.add(rol)
        set.add(miembro.rol)
      }
      copia.set(miembro.id, set)
      return copia
    })
    setGuardandoRol(null)
  }

  async function alternarSede(profileId: string, sedeId: string) {
    const claveOcupado = `${profileId}|${sedeId}`
    setGuardandoSede(claveOcupado)
    const supabase = createClient()
    const yaAsignada = sedesAsignadas.get(profileId)?.has(sedeId) ?? false

    if (yaAsignada) {
      await supabase.from('admin_sedes').delete().eq('profile_id', profileId).eq('sede_id', sedeId)
    } else {
      await supabase.from('admin_sedes').insert({ profile_id: profileId, sede_id: sedeId })
    }

    setSedesAsignadas((prev) => {
      const copia = new Map(prev)
      const set = new Set(copia.get(profileId) ?? [])
      if (yaAsignada) set.delete(sedeId); else set.add(sedeId)
      copia.set(profileId, set)
      return copia
    })
    setGuardandoSede(null)
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

  // Un admin normal solo puede dar de alta (y asignar como rol adicional)
  // otras cuentas de Administración — todo lo demás sigue siendo de
  // Dirección Académica/super_admin.
  const rolesDisponibles = miRol === 'admin'
    ? ROLES.filter((r) => r.valor === 'admin')
    : ROLES.filter((r) => !r.soloSuper || miRol === 'super_admin')
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
        descripcion={
          miRol === 'admin'
            ? `${equipo.length} cuenta${equipo.length === 1 ? '' : 's'} de Administración.`
            : `${equipo.length} en total. Un profesor nunca se registra solo — así se crea su cuenta.`
        }
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
            <>
              <div>
                <label className="mb-2 block text-sm font-semibold text-zr-text">
                  Módulos que dicta <span className="font-normal text-zr-text-muted">(opcional)</span>
                </label>
                <p className="mb-2 text-xs text-zr-text-muted">
                  Lo normal: un profesor dicta módulos concretos, no un programa completo — puede
                  repetir el mismo módulo en varios programas.
                </p>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-zr-border bg-zr-bg p-2">
                  {modulos.map((mod) => {
                    const activo = modulosNuevo.has(mod.id)
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() =>
                          setModulosNuevo((prev) => {
                            const copia = new Set(prev)
                            if (activo) copia.delete(mod.id); else copia.add(mod.id)
                            return copia
                          })
                        }
                        className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
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
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-zr-text">
                  Cohorte que atiende esta semana <span className="font-normal text-zr-text-muted">(opcional)</span>
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
                  Aparte de los módulos: es lo que de verdad abre la sesión y controla la asistencia
                  de ese programa. Elegir uno que ya tiene profesor se lo quita a quien lo tenía antes.
                </p>
              </div>
            </>
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

      {/* Cobertura de módulos (pedido explícito del coordinador): en vez de
          asignar módulos profesor por profesor, aquí se ve el programa
          completo y por cada módulo se elige un solo profesor — así queda
          claro de un vistazo cuáles todavía no tienen a nadie asignado. Solo
          Dirección Académica/super_admin la ven; es trabajo académico, no
          administrativo. */}
      {esDireccionAcademica(miRol) && (() => {
        const profesores = equipo.filter((m) => m.rol === 'profesor')
        const programas = [...new Set(modulos.map((m) => m.programa))]
        return (
          <Seccion numero={1} titulo="Cobertura de módulos" delay={120}>
            <div className="space-y-6">
              {programas.map((programa) => (
                <div key={programa} className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-zr-text-muted">{programa}</p>
                  <div className="space-y-2">
                    {modulos
                      .filter((m) => m.programa === programa)
                      .sort((a, b) => a.orden - b.orden)
                      .map((m) => {
                        const profesorActualId = [...asignaciones.entries()]
                          .find(([, mods]) => mods.has(m.id))?.[0] ?? ''
                        const sinCubrir = !profesorActualId
                        const ocupado = guardandoAsignacionModulo === m.id
                        return (
                          <div
                            key={m.id}
                            className={`zr-card flex items-center justify-between gap-3 p-4 ${sinCubrir ? 'border-zr-warning/40 bg-zr-warning/8' : ''}`}
                          >
                            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-zr-text">
                              {m.orden}. {m.nombre}
                            </p>
                            <select
                              value={profesorActualId}
                              onChange={(e) => asignarProfesorDelModulo(m.id, e.target.value)}
                              disabled={ocupado}
                              className="shrink-0 max-w-[45%] rounded-lg border border-zr-border bg-zr-bg px-3 py-2 text-sm text-zr-text disabled:opacity-50"
                            >
                              <option value="">Sin profesor asignado</option>
                              {profesores.map((p) => (
                                <option key={p.id} value={p.id}>{p.nombre}</option>
                              ))}
                            </select>
                          </div>
                        )
                      })}
                  </div>
                </div>
              ))}
            </div>
          </Seccion>
        )
      })()}

      {equipo.length === 0 ? (
        <div className="zr-card p-8 text-center">
          <p className="text-base font-semibold text-zr-text">Todavía no hay personal registrado</p>
        </div>
      ) : (
        <Seccion numero={esDireccionAcademica(miRol) ? 2 : 1} titulo="Equipo" delay={120}>
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
                        {m.cohortes.length > 0 ? m.cohortes.join(' · ') : 'Sin programa asignado'}
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

                {/* Roles adicionales (migración 085): la misma cuenta puede
                    entrar con más de un rol — pedido explícito del
                    coordinador para Erika Hidalgo (vendedor + admin). El rol
                    activo (la etiqueta de arriba) no se puede desmarcar aquí:
                    dejarla sin ningún rol permitido la trabaría afuera. */}
                {(() => {
                  const misRolesExtra = rolesExtra.get(m.id) ?? new Set<UserRole>()
                  const extrasSinActivo = [...misRolesExtra].filter((r) => r !== m.rol)
                  return (
                    <div className="border-t border-zr-border/60 pt-3">
                      <button
                        onClick={() => setExpandidoRoles((e) => (e === m.id ? null : m.id))}
                        className="text-xs font-bold uppercase tracking-wide text-zr-blue-mid"
                      >
                        {expandidoRoles === m.id ? 'Ocultar roles' : `Roles adicionales (${extrasSinActivo.length})`}
                      </button>

                      {expandidoRoles === m.id && (
                        <div className="mt-3 space-y-1">
                          {rolesDisponibles.map((r) => {
                            const esActivo = r.valor === m.rol
                            const activo = esActivo || misRolesExtra.has(r.valor)
                            const ocupado = guardandoRol === `${m.id}|${r.valor}`
                            return (
                              <button
                                key={r.valor}
                                onClick={() => alternarRol(m, r.valor)}
                                disabled={ocupado || esActivo}
                                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-50 ${
                                  activo ? 'bg-zr-blue/15 text-zr-blue' : 'text-zr-text-muted active:bg-zr-border/40'
                                }`}
                              >
                                <span className="min-w-0 truncate">
                                  {r.etiqueta}
                                  {esActivo && <span className="ml-1.5 text-xs text-zr-text-muted">· rol activo ahora</span>}
                                </span>
                                {activo && <span className="shrink-0 text-xs font-bold">✓</span>}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Sedes asignadas (migración 087): solo aplica al rol
                    admin — super_admin y dirección académica siempre ven
                    todo, y un admin sin ninguna sede marcada tampoco se
                    restringe (para no dejar a nadie afuera por accidente).
                    Se fija en TODOS los roles de la cuenta (rolesExtra), no
                    solo en el activo ahora mismo — Erika, por ejemplo,
                    entra normalmente como vendedor, pero igual necesita su
                    sede asignada para cuando use su rol de administración.
                    Asignar sede es cosa de Dirección Académica/super_admin
                    — un admin normal no le toca la sede a otro admin. */}
                {esDireccionAcademica(miRol) && (m.rol === 'admin' || rolesExtra.get(m.id)?.has('admin')) && (() => {
                  const misSedes = sedesAsignadas.get(m.id) ?? new Set<string>()
                  return (
                    <div className="border-t border-zr-border/60 pt-3">
                      <button
                        onClick={() => setExpandidoSedes((e) => (e === m.id ? null : m.id))}
                        className="text-xs font-bold uppercase tracking-wide text-zr-blue-mid"
                      >
                        {expandidoSedes === m.id ? 'Ocultar sedes' : `Sedes asignadas (${misSedes.size})`}
                      </button>
                      <p className="mt-1 text-xs text-zr-text-muted">
                        Sin ninguna marcada, ve estudiantes y asistencia de todas las sedes.
                      </p>

                      {expandidoSedes === m.id && (
                        <div className="mt-3 space-y-1">
                          {sedes.map((sede) => {
                            const activo = misSedes.has(sede.id)
                            const ocupado = guardandoSede === `${m.id}|${sede.id}`
                            return (
                              <button
                                key={sede.id}
                                onClick={() => alternarSede(m.id, sede.id)}
                                disabled={ocupado}
                                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-50 ${
                                  activo ? 'bg-zr-blue/15 text-zr-blue' : 'text-zr-text-muted active:bg-zr-border/40'
                                }`}
                              >
                                <span className="min-w-0 truncate">{sede.nombre}</span>
                                {activo && <span className="shrink-0 text-xs font-bold">✓</span>}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
              )
            })}
          </div>
        </Seccion>
      )}
    </div>
  )
}
