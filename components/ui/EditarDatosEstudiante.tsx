'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Campo } from '@/components/ui/Campo'
import { Boton } from '@/components/ui/Boton'
import { Aviso } from '@/components/ui/Aviso'
import { IconoLapiz } from '@/components/ui/Iconos'
import { nombreCompletoValido, telefonoVenezolanoValido } from '@/lib/validators'

/**
 * A pedido explícito del coordinador (transcripción de audio,
 * docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md): administración y ventas pueden
 * corregir nombre, correo y teléfono de un estudiante existente — por
 * ejemplo un dato mal tipeado al inscribir. Cédula, rol y estado NO se
 * editan aquí: `fn_profiles_guard` (migración 004) los bloquea para
 * cualquiera que no sea is_admin_up(), y ventas ni siquiera debería poder
 * tocarlos.
 *
 * La auditoría que pidió el coordinador ya existe sola: trg_profiles_audit
 * (migración 002) registra cada UPDATE con quién lo hizo y el antes/después.
 */

interface Props {
  estudianteId: string
  nombreInicial: string
  correoInicial: string
  telefonoInicial: string | null
  onGuardado: (datos: { nombre: string; correo: string; telefono: string }) => void
}

export function EditarDatosEstudiante({
  estudianteId, nombreInicial, correoInicial, telefonoInicial, onGuardado,
}: Props) {
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(nombreInicial)
  const [correo, setCorreo] = useState(correoInicial)
  const [telefono, setTelefono] = useState(telefonoInicial ?? '')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  function abrir() {
    setNombre(nombreInicial)
    setCorreo(correoInicial)
    setTelefono(telefonoInicial ?? '')
    setError(null)
    setEditando(true)
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!nombreCompletoValido(nombre)) {
      setError('Escribe el nombre completo, sin abreviar (al menos nombre y apellido).')
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(correo.trim())) {
      setError('Escribe un correo válido.')
      return
    }
    if (telefono.trim() && !telefonoVenezolanoValido(telefono)) {
      setError('El teléfono debe tener formato venezolano, ej. 0412-1234567.')
      return
    }

    setGuardando(true)
    const { error: fallo } = await createClient()
      .from('profiles')
      .update({
        full_name: nombre.trim(),
        contact_email: correo.trim(),
        phone: telefono.trim() || null,
      })
      .eq('id', estudianteId)

    setGuardando(false)

    if (fallo) {
      setError('No se pudo guardar. Revisa que tengas permiso sobre este estudiante.')
      return
    }

    setEditando(false)
    onGuardado({ nombre: nombre.trim(), correo: correo.trim(), telefono: telefono.trim() })
  }

  if (!editando) {
    return (
      <button
        onClick={abrir}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-zr-border px-6 text-sm font-semibold text-zr-text transition-colors active:border-zr-blue/40 active:text-zr-blue"
      >
        <IconoLapiz size={16} />
        Corregir nombre, correo o teléfono
      </button>
    )
  }

  return (
    <form onSubmit={guardar} className="zr-card space-y-4 p-5">
      <Campo etiqueta="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      <Campo etiqueta="Correo de contacto" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
      <Campo etiqueta="Teléfono" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="0412-1234567" ayuda="Opcional" />

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
