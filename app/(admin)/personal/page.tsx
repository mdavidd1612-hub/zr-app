'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
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
}

const ROLES: { valor: UserRole; etiqueta: string; soloSuper: boolean }[] = [
  { valor: 'profesor', etiqueta: 'Profesor', soloSuper: false },
  { valor: 'admin', etiqueta: 'Administrador', soloSuper: true },
  { valor: 'super_admin', etiqueta: 'Dirección académica', soloSuper: true },
]

export default function Personal() {
  const router = useRouter()
  const [miRol, setMiRol] = useState<UserRole | null>(null)
  const [equipo, setEquipo] = useState<Miembro[]>([])
  const [cargando, setCargando] = useState(true)
  const [version, setVersion] = useState(0)

  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState('')
  const [cedula, setCedula] = useState('')
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const [rol, setRol] = useState<UserRole>('profesor')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState<string | null>(null)

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
      setMiRol((perfil?.role as UserRole) ?? null)

      const { data } = await supabase
        .from('profiles')
        .select('id, cedula, full_name, contact_email, role')
        .in('role', ['profesor', 'admin', 'super_admin'])
        .order('role')

      if (!vigente) return

      setEquipo(
        (data ?? []).map((p) => ({
          id: p.id,
          cedula: p.cedula,
          nombre: p.full_name,
          correo: p.contact_email,
          rol: p.role as UserRole,
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

    const { error: fallo } = await createClient().functions.invoke('create-staff-user', {
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

    setExito(`Cuenta creada. Cédula ${cedula.trim().toUpperCase()} · contraseña temporal: ${password}`)
    setNombre('')
    setCedula('')
    setCorreo('')
    setPassword('')
    setRol('profesor')
    setCreando(false)
    setGuardando(false)
    setVersion((v) => v + 1)
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
            {equipo.map((m) => (
              <div key={m.id} className="zr-card flex items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-zr-text">{m.nombre}</p>
                  <p className="mt-1 text-sm tabular-nums text-zr-text-muted">{m.cedula}</p>
                </div>
                <Etiqueta tono={m.rol === 'super_admin' ? 'info' : m.rol === 'admin' ? 'aviso' : 'exito'}>
                  {m.rol === 'super_admin' ? 'Dirección' : m.rol === 'admin' ? 'Admin' : 'Profesor'}
                </Etiqueta>
              </div>
            ))}
          </div>
        </Seccion>
      )}
    </div>
  )
}
