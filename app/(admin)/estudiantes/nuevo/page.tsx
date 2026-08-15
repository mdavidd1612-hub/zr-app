'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'

export default function NuevoEstudiante() {
  const router = useRouter()
  const [cohortes, setCohortes] = useState<{ id: string; name: string }[]>([])

  const [nombre, setNombre] = useState('')
  const [cedula, setCedula] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [correo, setCorreo] = useState('')
  const [telefono, setTelefono] = useState('')
  const [cohorteId, setCohorteId] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [erroresServidor, setErroresServidor] = useState<{ fila: number; motivo: string }[]>([])
  const [exito, setExito] = useState<string | null>(null)

  useEffect(() => {
    createClient().from('cohorts').select('id, name').eq('status', 'activa').then(({ data }) => {
      setCohortes(data ?? [])
    })
  }, [])

  async function enviarIndividual() {
    setEnviando(true)
    setErroresServidor([])
    setExito(null)

    const { error } = await createClient().functions.invoke('create-student', {
      body: {
        estudiantes: [{
          nombreCompleto: nombre,
          cedula: cedula.trim().toUpperCase(),
          fechaNacimiento,
          correoContacto: correo,
          telefono: telefono || undefined,
          cohorteId: cohorteId || null,
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

    setExito(`Cuenta creada para ${nombre}.`)
    setEnviando(false)
    setTimeout(() => router.push('/estudiantes'), 1200)
  }

  const individualCompleto = nombre.trim() && cedula.trim() && fechaNacimiento && correo.trim()

  return (
    <div className="space-y-11 px-5 pt-14">
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

      <div className="zr-card space-y-5 p-6">
        <Campo etiqueta="Nombre completo" valor={nombre} onChange={setNombre} placeholder="Como aparece en la cédula" />
        <Campo etiqueta="Cédula" valor={cedula} onChange={(v) => setCedula(v.toUpperCase())} placeholder="V-12345678" />
        <div>
          <label className="mb-2 block text-sm font-semibold text-zr-text">Fecha de nacimiento</label>
          <input
            type="date"
            value={fechaNacimiento}
            onChange={(e) => setFechaNacimiento(e.target.value)}
            className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
          />
        </div>
        <Campo etiqueta="Correo de contacto" valor={correo} onChange={setCorreo} placeholder="Del estudiante o su representante" type="email" />
        <Campo etiqueta="Teléfono (opcional)" valor={telefono} onChange={setTelefono} placeholder="" />
        <div>
          <label className="mb-2 block text-sm font-semibold text-zr-text">Cohorte (opcional)</label>
          <select
            value={cohorteId}
            onChange={(e) => setCohorteId(e.target.value)}
            className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
          >
            <option value="">Sin asignar</option>
            {cohortes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <button
          onClick={enviarIndividual}
          disabled={!individualCompleto || enviando}
          className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {enviando ? 'Creando cuenta…' : 'Crear estudiante'}
        </button>
      </div>
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
