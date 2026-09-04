'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Campo } from '@/components/ui/Campo'
import { Boton } from '@/components/ui/Boton'
import { Aviso } from '@/components/ui/Aviso'
import { SelectorCedula } from '@/components/ui/SelectorCedula'
import { IconoLapiz } from '@/components/ui/Iconos'
import { nombreCompletoValido, telefonoVenezolanoValido, cedulaSchema } from '@/lib/validators'

/**
 * A pedido explícito del coordinador: desde /estudiantes/[id] (administración,
 * dirección académica, super_admin) se puede corregir CUALQUIER dato de la
 * planilla, no solo nombre/correo/teléfono como en EditarDatosEstudiante
 * (esa sigue siendo la versión simple que también usa ventas). Incluye la
 * cédula — `fn_profiles_guard` (migración 011) ya deja tocarla a is_admin_up(),
 * y la migración 078 recalcula solo el código de carnet cuando cambia.
 *
 * La contraseña NO se sincroniza sola con el código nuevo (no se escribe
 * auth.users desde un trigger en este proyecto — ver comentario de la
 * migración 078). Si la cédula cambió, este componente se lo recuerda al
 * que edita y deja el botón de "Restablecer contraseña" ya abierto.
 */

export interface Representante {
  nombre: string
  cedula: string
  telefono: string
  correo: string
  parentesco: string
  edad: string
  nacionalidad: string
  profesion: string
}

const REPRESENTANTE_VACIO: Representante = {
  nombre: '', cedula: 'V-', telefono: '', correo: '', parentesco: '', edad: '', nacionalidad: '', profesion: '',
}

interface Props {
  estudianteId: string
  nombreInicial: string
  cedulaInicial: string
  correoInicial: string
  telefonoInicial: string | null
  direccionInicial: string | null
  representanteInicial: Representante | null
  onGuardado: (datos: {
    nombre: string; cedula: string; correo: string; telefono: string; direccion: string
    representante: Representante; cedulaCambio: boolean
  }) => void
}

export function EditarFichaCompleta({
  estudianteId, nombreInicial, cedulaInicial, correoInicial, telefonoInicial, direccionInicial,
  representanteInicial, onGuardado,
}: Props) {
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(nombreInicial)
  const [cedula, setCedula] = useState(cedulaInicial)
  const [correo, setCorreo] = useState(correoInicial)
  const [telefono, setTelefono] = useState(telefonoInicial ?? '')
  const [direccion, setDireccion] = useState(direccionInicial ?? '')
  const [rep, setRep] = useState<Representante>(representanteInicial ?? REPRESENTANTE_VACIO)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [cedulaCambioAviso, setCedulaCambioAviso] = useState(false)

  function abrir() {
    setNombre(nombreInicial)
    setCedula(cedulaInicial)
    setCorreo(correoInicial)
    setTelefono(telefonoInicial ?? '')
    setDireccion(direccionInicial ?? '')
    setRep(representanteInicial ?? REPRESENTANTE_VACIO)
    setError(null)
    setCedulaCambioAviso(false)
    setEditando(true)
  }

  function setRepCampo<K extends keyof Representante>(campo: K, valor: Representante[K]) {
    setRep((r) => ({ ...r, [campo]: valor }))
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!nombreCompletoValido(nombre)) {
      setError('Escribe el nombre completo, sin abreviar (al menos nombre y apellido).')
      return
    }
    const cedulaValidada = cedulaSchema.safeParse(cedula.trim().toUpperCase())
    if (!cedulaValidada.success) {
      setError(cedulaValidada.error.issues[0].message)
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
    const supabase = createClient()
    const cedulaNueva = cedulaValidada.data
    const cedulaCambio = cedulaNueva !== cedulaInicial

    const { error: falloPerfil } = await supabase
      .from('profiles')
      .update({
        full_name: nombre.trim(),
        cedula: cedulaNueva,
        contact_email: correo.trim(),
        phone: telefono.trim() || null,
      })
      .eq('id', estudianteId)

    if (falloPerfil) {
      setError(
        falloPerfil.code === '23505'
          ? 'Ya existe otro estudiante con esa cédula.'
          : 'No se pudo guardar. Revisa los datos.',
      )
      setGuardando(false)
      return
    }

    const { error: falloDireccion } = await supabase
      .from('students')
      .update({ address: direccion.trim() || null })
      .eq('id', estudianteId)

    if (falloDireccion) {
      setError('El nombre/cédula se guardaron, pero la dirección no. Intenta de nuevo.')
      setGuardando(false)
      return
    }

    // Solo se guarda si hay algo que guardar — no crea una fila vacía por
    // abrir y cerrar el formulario sin tocar esta sección.
    const hayDatosRepresentante = Object.values(rep).some((v, i) => i !== 1 && v.trim()) || rep.cedula.trim() !== 'V-'
    if (hayDatosRepresentante) {
      const { error: falloRep } = await supabase
        .from('parental_consents')
        .upsert(
          {
            student_id: estudianteId,
            consent_type: 'account_creation',
            representative_name: rep.nombre.trim(),
            representative_cedula: rep.cedula.trim().toUpperCase(),
            representative_email: rep.correo.trim(),
            representative_phone: rep.telefono.trim() || null,
            representative_relationship: rep.parentesco.trim() || null,
            representative_age: rep.edad.trim() ? Number(rep.edad) : null,
            representative_nationality: rep.nacionalidad.trim() || null,
            representative_occupation: rep.profesion.trim() || null,
            method: 'fisico',
          },
          { onConflict: 'student_id,consent_type' },
        )

      if (falloRep) {
        setError('El resto se guardó, pero los datos del representante no. Intenta de nuevo.')
        setGuardando(false)
        return
      }
    }

    setGuardando(false)
    setEditando(false)

    if (cedulaCambio) {
      setCedulaCambioAviso(true)
    }

    onGuardado({
      nombre: nombre.trim(),
      cedula: cedulaNueva,
      correo: correo.trim(),
      telefono: telefono.trim(),
      direccion: direccion.trim(),
      representante: rep,
      cedulaCambio,
    })
  }

  if (!editando) {
    return (
      <div className="space-y-3">
        <button
          onClick={abrir}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-zr-border px-6 text-sm font-semibold text-zr-text transition-colors active:border-zr-blue/40 active:text-zr-blue"
        >
          <IconoLapiz size={16} />
          Editar todos los datos de la ficha
        </button>
        {cedulaCambioAviso && (
          <Aviso tipo="advertencia">
            La cédula cambió y el código de carnet ya se recalculó solo. Su contraseña sigue siendo
            el código anterior — usa &quot;Restablecer contraseña&quot; abajo para ponerla al día.
          </Aviso>
        )}
      </div>
    )
  }

  return (
    <form onSubmit={guardar} className="zr-card space-y-5 p-5">
      <Campo etiqueta="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      <SelectorCedula etiqueta="Cédula" value={cedula} onChange={setCedula} required />
      <Campo etiqueta="Correo de contacto" type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
      <Campo etiqueta="Teléfono" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="0412-1234567" ayuda="Opcional" />
      <Campo etiqueta="Dirección" value={direccion} onChange={(e) => setDireccion(e.target.value)} ayuda="Opcional" />

      <div className="space-y-4 border-t border-zr-border pt-5">
        <p className="text-xs font-bold uppercase tracking-wider text-zr-text-muted">
          Datos del representante <span className="font-normal normal-case">(si es menor de edad)</span>
        </p>
        <Campo etiqueta="Nombre completo" value={rep.nombre} onChange={(e) => setRepCampo('nombre', e.target.value)} />
        <SelectorCedula etiqueta="Cédula" value={rep.cedula} onChange={(v) => setRepCampo('cedula', v)} />
        <Campo etiqueta="Parentesco" value={rep.parentesco} onChange={(e) => setRepCampo('parentesco', e.target.value)} placeholder="Madre, padre, tío…" />
        <Campo etiqueta="Edad" type="number" value={rep.edad} onChange={(e) => setRepCampo('edad', e.target.value)} />
        <Campo etiqueta="Nacionalidad" value={rep.nacionalidad} onChange={(e) => setRepCampo('nacionalidad', e.target.value)} placeholder="Venezolana" />
        <Campo etiqueta="Profesión u ocupación" value={rep.profesion} onChange={(e) => setRepCampo('profesion', e.target.value)} />
        <Campo etiqueta="Teléfono" type="tel" value={rep.telefono} onChange={(e) => setRepCampo('telefono', e.target.value)} />
        <Campo etiqueta="Correo" type="email" value={rep.correo} onChange={(e) => setRepCampo('correo', e.target.value)} />
      </div>

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
          Guardar todo
        </Boton>
      </div>
    </form>
  )
}
