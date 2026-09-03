'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IconoSalir, IconoCandado, IconoLapiz } from '@/components/ui/Iconos'
import { Campo } from '@/components/ui/Campo'
import { Boton } from '@/components/ui/Boton'
import { Aviso } from '@/components/ui/Aviso'
import { nombreCompletoValido, telefonoVenezolanoValido } from '@/lib/validators'
import type { UserRole } from '@/lib/types'

/**
 * Identidad de quien está dentro y la puerta de salida.
 *
 * Va en el /perfil de los tres roles. Antes solo el estudiante tenía dónde
 * cerrar sesión: un profesor que entraba en el teléfono equivocado se quedaba
 * dentro hasta que expirara el token.
 */

const NOMBRE_ROL: Record<UserRole, string> = {
  estudiante:  'Estudiante',
  profesor:    'Profesor',
  admin:       'Administración',
  super_admin: 'Super admin',
  direccion_academica: 'Dirección académica',
  vendedor: 'Ventas',
}

interface Props {
  nombre: string
  cedula: string
  rol: UserRole
  correo?: string | null
  /** Se llama después de guardar cambios de nombre o correo, para que la
   *  pantalla que envuelve este bloque (que muestra el nombre en su propio
   *  encabezado) también quede al día sin tener que recargar. */
  onActualizado?: (datos: { nombre: string; correo: string }) => void
}

export function BloqueCuenta({ nombre, cedula, rol, correo, onActualizado }: Props) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [saliendo, setSaliendo] = useState(false)

  async function salir() {
    setSaliendo(true)
    await createClient().auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="space-y-4">
      <EditarInformacion
        nombre={nombre}
        cedula={cedula}
        rol={rol}
        correo={correo ?? ''}
        onActualizado={onActualizado}
      />

      <CambiarPassword />

      {!confirmando ? (
        <button
          onClick={() => setConfirmando(true)}
          className="flex min-h-14 w-full items-center justify-center gap-2.5 rounded-lg border border-zr-border px-6 text-base font-semibold text-zr-text transition-colors active:border-zr-error/40 active:text-zr-error"
        >
          <IconoSalir size={20} />
          Cerrar sesión
        </button>
      ) : (
        <div className="zr-card space-y-4 p-5">
          <p className="text-sm text-zr-text-muted">
            Tendrás que escribir tu cédula y contraseña otra vez para volver a entrar.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmando(false)}
              className="min-h-14 flex-1 rounded-lg border border-zr-border text-base font-semibold text-zr-text"
            >
              Quedarme
            </button>
            <button
              onClick={salir}
              disabled={saliendo}
              className="min-h-14 flex-1 rounded-lg bg-zr-error/15 text-base font-bold text-zr-error disabled:opacity-50"
            >
              {saliendo ? 'Saliendo…' : 'Salir'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Nombre, correo y teléfono los puede editar cualquier rol desde aquí —
// la cédula y el rol NO, esos los cambia solo administración (bloqueado en
// el servidor por el trigger fn_profiles_guard, migración 004). El teléfono
// no llega como prop desde la pantalla que envuelve este bloque (ninguna de
// las 4 lo necesitaba para otra cosa), así que se busca aparte, una sola vez.
function EditarInformacion({
  nombre, cedula, rol, correo, onActualizado,
}: { nombre: string; cedula: string; rol: UserRole; correo: string; onActualizado?: (d: { nombre: string; correo: string }) => void }) {
  const [editando, setEditando] = useState(false)
  const [nombreActual, setNombreActual] = useState(nombre)
  const [correoActual, setCorreoActual] = useState(correo)
  const [telefono, setTelefono] = useState('')
  const [nombreEdit, setNombreEdit] = useState(nombre)
  const [correoEdit, setCorreoEdit] = useState(correo)
  const [telefonoEdit, setTelefonoEdit] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    let vigente = true
    async function cargarTelefono() {
      const { data: { user } } = await createClient().auth.getUser()
      if (!user) return
      const { data } = await createClient().from('profiles').select('phone').eq('id', user.id).single()
      if (vigente && data?.phone) {
        setTelefono(data.phone)
        setTelefonoEdit(data.phone)
      }
    }
    cargarTelefono()
    return () => { vigente = false }
  }, [])

  function abrir() {
    setNombreEdit(nombreActual)
    setCorreoEdit(correoActual)
    setTelefonoEdit(telefono)
    setError(null)
    setExito(false)
    setEditando(true)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!nombreCompletoValido(nombreEdit)) {
      setError('Escribe tu nombre completo, sin abreviar (al menos nombre y apellido).')
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(correoEdit.trim())) {
      setError('Escribe un correo válido.')
      return
    }
    if (telefonoEdit.trim() && !telefonoVenezolanoValido(telefonoEdit)) {
      setError('El teléfono debe tener formato venezolano, ej. 0412-1234567.')
      return
    }

    setGuardando(true)
    const { data: { user } } = await createClient().auth.getUser()
    if (!user) { setGuardando(false); return }

    const { error: fallo } = await createClient()
      .from('profiles')
      .update({
        full_name: nombreEdit.trim(),
        contact_email: correoEdit.trim(),
        phone: telefonoEdit.trim() || null,
      })
      .eq('id', user.id)

    setGuardando(false)

    if (fallo) {
      setError('No se pudo guardar. Intenta de nuevo.')
      return
    }

    setNombreActual(nombreEdit.trim())
    setCorreoActual(correoEdit.trim())
    setTelefono(telefonoEdit.trim())
    setEditando(false)
    setExito(true)
    onActualizado?.({ nombre: nombreEdit.trim(), correo: correoEdit.trim() })
  }

  if (!editando) {
    return (
      <div className="space-y-3">
        <div className="zr-card divide-y divide-zr-border">
          <Fila etiqueta="Nombre" valor={nombreActual} />
          <Fila etiqueta="Cédula" valor={cedula} mono />
          <Fila etiqueta="Rol" valor={NOMBRE_ROL[rol]} />
          {correoActual && <Fila etiqueta="Correo" valor={correoActual} />}
          {telefono && <Fila etiqueta="Teléfono" valor={telefono} mono />}
        </div>
        <button
          onClick={abrir}
          className="flex min-h-14 w-full items-center justify-center gap-2.5 rounded-lg border border-zr-border px-6 text-base font-semibold text-zr-text transition-colors active:border-zr-blue/40 active:text-zr-blue"
        >
          <IconoLapiz size={18} />
          Editar información
        </button>
        {exito && <Aviso tipo="exito">Tu información quedó actualizada.</Aviso>}
      </div>
    )
  }

  return (
    <form onSubmit={guardar} className="zr-card space-y-4 p-5">
      <Campo etiqueta="Nombre completo" value={nombreEdit} onChange={(e) => setNombreEdit(e.target.value)} required />
      <Campo etiqueta="Correo de contacto" type="email" value={correoEdit} onChange={(e) => setCorreoEdit(e.target.value)} required />
      <Campo
        etiqueta="Teléfono"
        type="tel"
        value={telefonoEdit}
        onChange={(e) => setTelefonoEdit(e.target.value)}
        placeholder="0412-1234567"
        ayuda="Opcional"
      />

      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => { setEditando(false); setError(null) }}
          className="min-h-14 flex-1 rounded-lg border border-zr-border text-base font-semibold text-zr-text"
        >
          Cancelar
        </button>
        <Boton type="submit" cargando={guardando} className="flex-1">
          Guardar
        </Boton>
      </div>
    </form>
  )
}

// R-50 (docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md, Fase 5): antes solo existía
// /recuperar por correo, y el correo de contacto de muchos estudiantes es el
// del representante — no siempre lo tienen a mano. Con sesión activa no hace
// falta ese rodeo: `auth.updateUser` alcanza.
function CambiarPassword() {
  const [abierto, setAbierto] = useState(false)
  const [nueva, setNueva] = useState('')
  const [repetida, setRepetida] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [exito, setExito] = useState(false)
  const [cargando, setCargando] = useState(false)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setExito(false)

    if (nueva.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (nueva !== repetida) {
      setError('Las dos contraseñas no coinciden.')
      return
    }

    setCargando(true)
    const { error: fallo } = await createClient().auth.updateUser({ password: nueva })
    setCargando(false)

    if (fallo) {
      setError('No se pudo cambiar la contraseña. Intenta de nuevo.')
      return
    }

    setNueva('')
    setRepetida('')
    setExito(true)
    setAbierto(false)
  }

  if (!abierto) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => { setAbierto(true); setExito(false) }}
          className="flex min-h-14 w-full items-center justify-center gap-2.5 rounded-lg border border-zr-border px-6 text-base font-semibold text-zr-text transition-colors active:border-zr-blue/40 active:text-zr-blue"
        >
          <IconoCandado size={20} />
          Cambiar contraseña
        </button>
        {exito && <Aviso tipo="exito">Tu contraseña quedó actualizada.</Aviso>}
      </div>
    )
  }

  return (
    <form onSubmit={guardar} className="zr-card space-y-4 p-5">
      <Campo
        etiqueta="Contraseña nueva"
        type="password"
        autoComplete="new-password"
        value={nueva}
        onChange={(e) => setNueva(e.target.value)}
        ayuda="Mínimo 8 caracteres"
        required
      />
      <Campo
        etiqueta="Repite la contraseña"
        type="password"
        autoComplete="new-password"
        value={repetida}
        onChange={(e) => setRepetida(e.target.value)}
        required
      />

      {error && <Aviso tipo="error">{error}</Aviso>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => { setAbierto(false); setError(null) }}
          className="min-h-14 flex-1 rounded-lg border border-zr-border text-base font-semibold text-zr-text"
        >
          Cancelar
        </button>
        <Boton type="submit" cargando={cargando} className="flex-1">
          Guardar
        </Boton>
      </div>
    </form>
  )
}

function Fila({ etiqueta, valor, mono }: { etiqueta: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-4">
      <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-zr-text-muted">
        {etiqueta}
      </span>
      <span className={`min-w-0 truncate text-right text-base text-zr-text ${mono ? 'tabular-nums' : ''}`}>
        {valor}
      </span>
    </div>
  )
}
