'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { SelectorCedula } from '@/components/ui/SelectorCedula'
import { esMenorDeEdad } from '@/lib/auth-helpers'

export default function NuevoEstudiante() {
  const router = useRouter()
  const [cohortes, setCohortes] = useState<{ id: string; name: string }[]>([])

  const [nombre, setNombre] = useState('')
  const [cedula, setCedula] = useState('V-')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [correo, setCorreo] = useState('')
  const [telefono, setTelefono] = useState('')
  const [direccion, setDireccion] = useState('')
  const [cohorteId, setCohorteId] = useState('')

  const [repNombre, setRepNombre] = useState('')
  const [repCedula, setRepCedula] = useState('V-')
  const [repTelefono, setRepTelefono] = useState('')
  const [repCorreo, setRepCorreo] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [erroresServidor, setErroresServidor] = useState<{ fila: number; motivo: string }[]>([])
  const [exito, setExito] = useState<string | null>(null)

  useEffect(() => {
    createClient().from('cohorts').select('id, name').eq('status', 'activa').then(({ data }) => {
      setCohortes(data ?? [])
    })
  }, [])

  const esMenor = fechaNacimiento ? esMenorDeEdad(new Date(fechaNacimiento)) : false

  async function enviarIndividual() {
    setEnviando(true)
    setErroresServidor([])
    setExito(null)

    const { data, error } = await createClient().functions.invoke('create-student', {
      body: {
        estudiantes: [{
          nombreCompleto: nombre,
          cedula: cedula.trim().toUpperCase(),
          fechaNacimiento,
          correoContacto: correo,
          telefono: telefono || undefined,
          direccion: direccion || undefined,
          cohorteId: cohorteId || null,
          representante: esMenor ? {
            nombre: repNombre || undefined,
            cedula: repCedula.trim() !== 'V-' ? repCedula.trim().toUpperCase() : undefined,
            telefono: repTelefono || undefined,
            correo: repCorreo || undefined,
          } : undefined,
        }],
      },
    })

    if (error) {
      const contexto = (error as { context?: { json?: () => Promise<unknown> } }).context
      if (contexto?.json) {
        const cuerpo = (await contexto.json()) as { error?: { message: string; errores?: { fila: number; motivo: string }[] } }
        setErroresServidor(cuerpo.error?.errores ?? [{ fila: 1, motivo: cuerpo.error?.message ?? 'Error desconocido' }])
      } else {
        setErroresServidor([{ fila: 1, motivo: 'No se pudo crear la cuenta. Revisa tu conexión.' }])
      }
      setEnviando(false)
      return
    }

    const codigo = (data as { creados?: { studentCode: string }[] } | null)?.creados?.[0]?.studentCode
    setExito(`Cuenta creada para ${nombre}. Código/contraseña de su carnet: ${codigo ?? '—'}.`)
    setEnviando(false)
    setTimeout(() => router.push('/estudiantes'), 1800)
  }

  // La cohorte ya no es opcional: el código de carnet (que también es la
  // contraseña de la cuenta) necesita una cohorte real para generarse. Sin
  // eso quedaría en un código "pendiente" que después, al asignar cohorte,
  // cambia — pero la contraseña ya fijada no se actualiza sola.
  const individualCompleto = Boolean(nombre.trim() && cedula.trim() && fechaNacimiento && correo.trim() && cohorteId)

  return (
    <div className="space-y-11 px-5 pt-14 pb-10">
      <BotonVolver href="/estudiantes" />

      <Encabezado sobretitulo="Administración · Estudiantes" titulo="Nuevo estudiante" />

      <Regla delay={60} />

      {exito && (
        <p className="rounded-lg border border-zr-success/30 bg-zr-success/12 px-4 py-3 text-sm font-medium text-zr-success">
          {exito}
        </p>
      )}

      {erroresServidor.length > 0 && (
        <div className="space-y-2 rounded-lg border border-zr-error/30 bg-zr-error/12 p-4">
          <p className="text-sm font-bold text-zr-error">
            No se pudo crear el estudiante:
          </p>
          <ul className="space-y-1">
            {erroresServidor.map((e, i) => (
              <li key={i} className="text-sm text-zr-error">
                {e.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Seccion numero={1} titulo="Datos del participante" delay={100}>
        <div className="zr-card space-y-5 p-6">
          <Campo etiqueta="Nombre completo" valor={nombre} onChange={setNombre} placeholder="Como aparece en la cédula" />
          <SelectorCedula etiqueta="Cédula" value={cedula} onChange={setCedula} required />
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Fecha de nacimiento</label>
            <input
              type="date"
              value={fechaNacimiento}
              onChange={(e) => setFechaNacimiento(e.target.value)}
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
            />
            {esMenor && (
              <p className="mt-1.5 text-xs text-zr-text-muted">
                Es menor de edad — puedes anotar abajo el contacto de su representante (opcional).
              </p>
            )}
          </div>
          <Campo etiqueta="Correo de contacto" valor={correo} onChange={setCorreo} placeholder="Del estudiante o su representante" type="email" />
          <Campo etiqueta="Teléfono (opcional)" valor={telefono} onChange={setTelefono} placeholder="" />
          <Campo etiqueta="Dirección" valor={direccion} onChange={setDireccion} placeholder="Para la planilla" />
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Cohorte</label>
            <select
              value={cohorteId}
              onChange={(e) => setCohorteId(e.target.value)}
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
            >
              <option value="">Selecciona una cohorte</option>
              {cohortes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Seccion>

      {esMenor && (
        <Seccion numero={2} titulo="Contacto del representante (opcional)" delay={160}>
          <div className="zr-card space-y-5 p-6">
            <Campo etiqueta="Nombre completo" valor={repNombre} onChange={setRepNombre} placeholder="" />
            <SelectorCedula etiqueta="Cédula" value={repCedula} onChange={setRepCedula} />
            <Campo etiqueta="Teléfono" valor={repTelefono} onChange={setRepTelefono} placeholder="" />
            <Campo etiqueta="Correo" valor={repCorreo} onChange={setRepCorreo} placeholder="" type="email" />
          </div>
        </Seccion>
      )}

      <button
        onClick={enviarIndividual}
        disabled={!individualCompleto || enviando}
        className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {enviando ? 'Creando cuenta…' : 'Crear estudiante'}
      </button>
    </div>
  )
}

function Campo({
  etiqueta, valor, onChange, placeholder, type = 'text',
}: {
  etiqueta: string; valor: string; onChange: (v: string) => void; placeholder: string; type?: string
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-zr-text">{etiqueta}</label>
      <input
        type={type}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
      />
    </div>
  )
}
