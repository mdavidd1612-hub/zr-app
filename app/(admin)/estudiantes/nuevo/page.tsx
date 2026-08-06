'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla } from '@/components/ui/Editorial'

/**
 * T-113 · Alta de estudiante, a mano o por CSV.
 *
 * Las columnas del CSV son las exactas de spec/04 §5, en ese orden:
 *   nombre_completo,cedula,fecha_nacimiento,correo_contacto,telefono,cohorte
 *
 * La importación es todo o nada: se valida el archivo completo en el
 * servidor antes de crear una sola cuenta. Una fila mala no deja cuentas
 * huérfanas a medio crear.
 */

interface FilaCSV {
  nombreCompleto: string
  cedula: string
  fechaNacimiento: string
  correoContacto: string
  telefono: string
  cohorteNombre: string
}

const COLUMNAS = ['nombre_completo', 'cedula', 'fecha_nacimiento', 'correo_contacto', 'telefono', 'cohorte']

export default function NuevoEstudiante() {
  const router = useRouter()
  const [modo, setModo] = useState<'individual' | 'csv'>('individual')
  const [cohortes, setCohortes] = useState<{ id: string; name: string }[]>([])

  // Formulario individual
  const [nombre, setNombre] = useState('')
  const [cedula, setCedula] = useState('')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [correo, setCorreo] = useState('')
  const [telefono, setTelefono] = useState('')
  const [cohorteId, setCohorteId] = useState('')

  // CSV
  const [filasCSV, setFilasCSV] = useState<FilaCSV[]>([])
  const [erroresParseo, setErroresParseo] = useState<string[]>([])
  const [nombreArchivo, setNombreArchivo] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [erroresServidor, setErroresServidor] = useState<{ fila: number; motivo: string }[]>([])
  const [exito, setExito] = useState<string | null>(null)

  useEffect(() => {
    createClient().from('cohorts').select('id, name').eq('status', 'activa').then(({ data }) => {
      setCohortes(data ?? [])
    })
  }, [])

  function parsearCSV(texto: string) {
    const lineas = texto.split(/\r?\n/).filter((l) => l.trim() !== '')
    if (lineas.length === 0) {
      setErroresParseo(['El archivo está vacío.'])
      setFilasCSV([])
      return
    }

    const encabezado = lineas[0].split(',').map((c) => c.trim().toLowerCase())
    if (encabezado.join(',') !== COLUMNAS.join(',')) {
      setErroresParseo([
        `Las columnas deben ser exactamente: ${COLUMNAS.join(',')}`,
        `El archivo trae: ${encabezado.join(',')}`,
      ])
      setFilasCSV([])
      return
    }

    const filas: FilaCSV[] = lineas.slice(1).map((linea) => {
      const [nombreCompleto, ced, fecha, corr, tel, coh] = linea.split(',').map((c) => c.trim())
      return {
        nombreCompleto: nombreCompleto ?? '',
        cedula: ced ?? '',
        fechaNacimiento: fecha ?? '',
        correoContacto: corr ?? '',
        telefono: tel ?? '',
        cohorteNombre: coh ?? '',
      }
    })

    setFilasCSV(filas)
    setErroresParseo([])
  }

  function alSeleccionarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    if (!archivo) return
    setNombreArchivo(archivo.name)
    setExito(null)
    setErroresServidor([])

    const lector = new FileReader()
    lector.onload = () => parsearCSV(String(lector.result))
    lector.readAsText(archivo)
  }

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
      // El body del error trae los detalles por fila cuando la causa es de datos.
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

  async function enviarCSV() {
    setEnviando(true)
    setErroresServidor([])
    setExito(null)

    const porNombre = new Map(cohortes.map((c) => [c.name.toLowerCase(), c.id]))

    const estudiantes = filasCSV.map((f) => ({
      nombreCompleto: f.nombreCompleto,
      cedula: f.cedula.trim().toUpperCase(),
      fechaNacimiento: f.fechaNacimiento,
      correoContacto: f.correoContacto,
      telefono: f.telefono || undefined,
      cohorteId: f.cohorteNombre ? porNombre.get(f.cohorteNombre.toLowerCase()) ?? null : null,
    }))

    const { data, error } = await createClient().functions.invoke('create-student', {
      body: { estudiantes },
    })

    if (error) {
      const contexto = (error as { context?: { json?: () => Promise<unknown> } }).context
      if (contexto?.json) {
        const cuerpo = (await contexto.json()) as { error?: { message: string; errores?: { fila: number; motivo: string }[] } }
        setErroresServidor(cuerpo.error?.errores ?? [{ fila: 0, motivo: cuerpo.error?.message ?? 'Error desconocido' }])
      } else {
        setErroresServidor([{ fila: 0, motivo: 'No se pudo procesar el archivo. Revisa tu conexión.' }])
      }
      setEnviando(false)
      return
    }

    setExito(`${(data as { creados: number }).creados} estudiantes importados.`)
    setEnviando(false)
    setTimeout(() => router.push('/estudiantes'), 1500)
  }

  const individualCompleto = nombre.trim() && cedula.trim() && fechaNacimiento && correo.trim()

  return (
    <div className="space-y-11 px-5 pt-14">
      <Encabezado sobretitulo="Administración · Estudiantes" titulo="Nuevo estudiante" />

      <Regla delay={60} />

      {/* Selector de modo */}
      <div className="flex gap-2 rounded-lg border border-zr-border p-1">
        <button
          onClick={() => setModo('individual')}
          className={`flex-1 rounded-md py-3 text-sm font-bold transition-colors ${
            modo === 'individual' ? 'bg-zr-blue text-white' : 'text-zr-text-muted'
          }`}
        >
          Uno a la vez
        </button>
        <button
          onClick={() => setModo('csv')}
          className={`flex-1 rounded-md py-3 text-sm font-bold transition-colors ${
            modo === 'csv' ? 'bg-zr-blue text-white' : 'text-zr-text-muted'
          }`}
        >
          Cargar CSV
        </button>
      </div>

      {exito && (
        <p className="rounded-lg border border-zr-success/30 bg-zr-success/12 px-4 py-3 text-sm font-medium text-zr-success">
          {exito}
        </p>
      )}

      {erroresServidor.length > 0 && (
        <div className="space-y-2 rounded-lg border border-zr-error/30 bg-zr-error/12 p-4">
          <p className="text-sm font-bold text-zr-error">
            No se importó nada. Corrige estas filas e inténtalo de nuevo:
          </p>
          <ul className="space-y-1">
            {erroresServidor.map((e, i) => (
              <li key={i} className="text-sm text-zr-error">
                {e.fila > 0 ? `Fila ${e.fila}: ` : ''}{e.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}

      {modo === 'individual' ? (
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
      ) : (
        <div className="space-y-5">
          <div className="zr-card space-y-3 p-6">
            <p className="text-sm font-semibold text-zr-text">Columnas exactas, en este orden:</p>
            <code className="block overflow-x-auto whitespace-pre rounded-lg bg-zr-bg p-3 text-xs text-zr-blue-mid">
              {COLUMNAS.join(',')}
            </code>
            <p className="text-xs text-zr-text-muted">
              El nombre de cohorte debe coincidir exactamente con el de una cohorte activa, o
              déjalo vacío para no asignar ninguna.
            </p>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-zr-text">Archivo CSV</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={alSeleccionarArchivo}
                className="block w-full text-sm text-zr-text-muted file:mr-4 file:rounded-lg file:border-0 file:bg-zr-blue file:px-4 file:py-3 file:text-sm file:font-bold file:text-white"
              />
            </label>
            {nombreArchivo && <p className="text-xs text-zr-text-muted">{nombreArchivo}</p>}
          </div>

          {erroresParseo.length > 0 && (
            <div className="space-y-1 rounded-lg border border-zr-error/30 bg-zr-error/12 p-4">
              {erroresParseo.map((e, i) => (
                <p key={i} className="text-sm text-zr-error">{e}</p>
              ))}
            </div>
          )}

          {filasCSV.length > 0 && erroresParseo.length === 0 && (
            <>
              <div className="zr-card overflow-hidden">
                <p className="border-b border-zr-border px-5 py-3 text-sm font-semibold text-zr-text">
                  Vista previa · {filasCSV.length} fila{filasCSV.length === 1 ? '' : 's'}
                </p>
                <div className="divide-y divide-zr-border">
                  {filasCSV.slice(0, 8).map((f, i) => (
                    <div key={i} className="px-5 py-3">
                      <p className="text-sm font-medium text-zr-text">{f.nombreCompleto || '(sin nombre)'}</p>
                      <p className="text-xs tabular-nums text-zr-text-muted">
                        {f.cedula || '(sin cédula)'} · {f.fechaNacimiento || '(sin fecha)'}
                      </p>
                    </div>
                  ))}
                  {filasCSV.length > 8 && (
                    <p className="px-5 py-3 text-xs text-zr-text-muted">
                      + {filasCSV.length - 8} más
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={enviarCSV}
                disabled={enviando}
                className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-40"
              >
                {enviando ? 'Importando…' : `Importar ${filasCSV.length} estudiantes`}
              </button>
            </>
          )}
        </div>
      )}
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
