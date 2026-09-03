'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Seccion } from '@/components/ui/Editorial'
import { SelectorCedula } from '@/components/ui/SelectorCedula'
import { SelectorCohorte, type OpcionCohorte } from '@/components/ui/SelectorCohorte'
import { esMenorDeEdad } from '@/lib/auth-helpers'
import { nombreCompletoValido, telefonoVenezolanoValido } from '@/lib/validators'

// Formulario de inscripción compartido entre /(vendedor)/carga-ventas y
// /(admin)/inscribir (R-17, docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md): la
// matriz de roles da a Dirección Académica y Administración el mismo
// formulario, como respaldo del vendedor — no una copia aparte que se pueda
// desincronizar. Cada página solo decide el `sobretitulo` que se ve arriba;
// el resto de la lógica es idéntica y vive aquí una sola vez.
export function FormularioInscripcion({ sobretitulo }: { sobretitulo: string }) {
  const [cohortes, setCohortes] = useState<OpcionCohorte[]>([])

  const [nombre, setNombre] = useState('')
  const [cedula, setCedula] = useState('V-')
  const [fechaNacimiento, setFechaNacimiento] = useState('')
  const [correo, setCorreo] = useState('')
  const [telefono, setTelefono] = useState('')
  // Segundo teléfono de contacto, obligatorio si es menor de edad (R-11).
  // Es `students.emergency_contact_phone` — distinto del teléfono del
  // representante de la sección de abajo, que sigue siendo opcional.
  const [telefonoEmergencia, setTelefonoEmergencia] = useState('')
  const [direccion, setDireccion] = useState('')
  const [cohorteId, setCohorteId] = useState('')

  // No hay ningún bloqueo por ser menor de edad EN ESTOS CAMPOS — es solo
  // referencia de contacto para el consentimiento, nunca un requisito para
  // inscribir (docs/18 §2.1). El segundo teléfono de arriba sí es requerido,
  // pero por otra razón: poder ubicar al estudiante, no por consentimiento.
  const [repNombre, setRepNombre] = useState('')
  const [repCedula, setRepCedula] = useState('V-')
  const [repTelefono, setRepTelefono] = useState('')
  const [repCorreo, setRepCorreo] = useState('')
  const [repParentesco, setRepParentesco] = useState('')
  const [repEdad, setRepEdad] = useState('')
  const [repNacionalidad, setRepNacionalidad] = useState('')
  const [repProfesion, setRepProfesion] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [erroresServidor, setErroresServidor] = useState<{ fila: number; motivo: string }[]>([])
  const [exito, setExito] = useState<string | null>(null)

  useEffect(() => {
    // R-12 filtraba por una ventana de 30 días desde el inicio — se revirtió
    // (migración 069) porque en la práctica dejaba un solo programa visible
    // y la academia sí necesita poder sumar estudiantes a uno ya en marcha.
    // Muestra todos los que están 'activa', sin más filtro. Sede y turno
    // viajan con el programa para poder mostrarlas como etiqueta.
    createClient()
      .from('cohorts')
      .select('id, name, sede, turno')
      .eq('status', 'activa')
      .order('name')
      .then(({ data }) => {
        setCohortes(
          (data ?? []).map((c) => ({ id: c.id, name: c.name, sede: c.sede, turno: c.turno })),
        )
      })
  }, [])

  const esMenor = fechaNacimiento ? esMenorDeEdad(new Date(fechaNacimiento)) : false

  function limpiar() {
    setNombre(''); setCedula('V-'); setFechaNacimiento(''); setCorreo(''); setTelefono('')
    setTelefonoEmergencia(''); setDireccion(''); setCohorteId('')
    setRepNombre(''); setRepCedula('V-'); setRepTelefono(''); setRepCorreo('')
    setRepParentesco(''); setRepEdad(''); setRepNacionalidad(''); setRepProfesion('')
  }

  async function inscribir() {
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
          telefonoEmergencia: esMenor ? (telefonoEmergencia || undefined) : undefined,
          direccion: direccion || undefined,
          cohorteId,
          representante: esMenor ? {
            nombre: repNombre || undefined,
            cedula: repCedula.trim() !== 'V-' ? repCedula.trim().toUpperCase() : undefined,
            telefono: repTelefono || undefined,
            correo: repCorreo || undefined,
            parentesco: repParentesco || undefined,
            edad: repEdad ? Number(repEdad) : undefined,
            nacionalidad: repNacionalidad || undefined,
            profesion: repProfesion || undefined,
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
        setErroresServidor([{ fila: 1, motivo: 'No se pudo inscribir. Revisa tu conexión.' }])
      }
      setEnviando(false)
      return
    }

    const codigo = (data as { creados?: { studentCode: string }[] } | null)?.creados?.[0]?.studentCode
    setExito(
      `Inscripción creada para ${nombre}. Cédula ${cedula.trim().toUpperCase()} · código/contraseña de su carnet: ${codigo ?? '—'}. Anótalo en la planilla física.`
    )
    setEnviando(false)
    limpiar()
  }

  // Presencia, no formato: el botón no se bloquea por un teléfono mal escrito
  // (el servidor es quien de verdad decide, y así no se traba una venta real
  // por un caso que la expresión regular no anticipó). Los avisos de formato
  // de abajo son solo eso, avisos.
  const completo = Boolean(
    nombre.trim() && cedula.trim() && fechaNacimiento && correo.trim() && telefono.trim() &&
    (!esMenor || telefonoEmergencia.trim()) && cohorteId,
  )

  const avisoNombre = nombre.trim() && !nombreCompletoValido(nombre)
    ? 'Escríbelo completo, como en la cédula, sin abreviar (ej. "María González", no "Ma. González").'
    : null

  const avisoTelefono = telefono.trim() && !telefonoVenezolanoValido(telefono)
    ? 'Verifica el formato: 0412-1234567.'
    : null

  return (
    <div className="space-y-11 px-5 pt-14 pb-10">
      <Encabezado sobretitulo={sobretitulo} titulo="Inscribir estudiante" />

      <Regla delay={60} />

      {exito && (
        <p className="rounded-lg border border-zr-success/30 bg-zr-success/12 px-4 py-3 text-sm font-medium text-zr-success">
          {exito}
        </p>
      )}

      {erroresServidor.length > 0 && (
        <div className="space-y-2 rounded-lg border border-zr-error/30 bg-zr-error/12 p-4">
          <p className="text-sm font-bold text-zr-error">No se pudo inscribir:</p>
          <ul className="space-y-1">
            {erroresServidor.map((e, i) => (
              <li key={i} className="text-sm text-zr-error">{e.motivo}</li>
            ))}
          </ul>
        </div>
      )}

      <Seccion numero={1} titulo="Datos del participante" delay={100}>
        <div className="zr-card space-y-5 p-6">
          <div>
            <Campo etiqueta="Nombre completo" valor={nombre} onChange={setNombre} placeholder="Como aparece en la cédula" />
            {avisoNombre && <p className="mt-1.5 text-xs text-zr-warning">{avisoNombre}</p>}
          </div>
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
                Es menor de edad: escribe abajo un segundo teléfono de contacto (obligatorio). El
                contacto del representante sigue siendo opcional.
              </p>
            )}
          </div>
          <Campo etiqueta="Correo de contacto" valor={correo} onChange={setCorreo} placeholder="Del estudiante o su representante" type="email" />
          <div>
            <Campo etiqueta="Teléfono" valor={telefono} onChange={setTelefono} placeholder="0412-1234567" />
            {avisoTelefono && <p className="mt-1.5 text-xs text-zr-warning">{avisoTelefono}</p>}
          </div>
          {esMenor && (
            <Campo
              etiqueta="Segundo teléfono de contacto (obligatorio por ser menor)"
              valor={telefonoEmergencia}
              onChange={setTelefonoEmergencia}
              placeholder="0412-1234567"
            />
          )}
          <Campo etiqueta="Dirección" valor={direccion} onChange={setDireccion} placeholder="Para la planilla" />
          <SelectorCohorte opciones={cohortes} valor={cohorteId} onChange={setCohorteId} />
        </div>
      </Seccion>

      {esMenor && (
        <Seccion numero={2} titulo="Contacto del representante (opcional)" delay={160}>
          <div className="zr-card space-y-5 p-6">
            <Campo etiqueta="Nombre completo" valor={repNombre} onChange={setRepNombre} placeholder="" />
            <SelectorCedula etiqueta="Cédula" value={repCedula} onChange={setRepCedula} />
            <Campo etiqueta="Parentesco" valor={repParentesco} onChange={setRepParentesco} placeholder="Madre, padre, tío…" />
            <Campo etiqueta="Edad" valor={repEdad} onChange={setRepEdad} placeholder="" type="number" />
            <Campo etiqueta="Nacionalidad" valor={repNacionalidad} onChange={setRepNacionalidad} placeholder="Venezolana" />
            <Campo etiqueta="Profesión u ocupación" valor={repProfesion} onChange={setRepProfesion} placeholder="" />
            <Campo etiqueta="Teléfono" valor={repTelefono} onChange={setRepTelefono} placeholder="" />
            <Campo etiqueta="Correo" valor={repCorreo} onChange={setRepCorreo} placeholder="" type="email" />
          </div>
          <p className="mt-2 px-1 text-xs text-zr-text-muted">
            Estos ocho campos son los que pide la planilla física. Anota lo que el representante
            traiga hoy; lo que falte se completa antes de la firma.
          </p>
        </Seccion>
      )}

      <button
        onClick={inscribir}
        disabled={!completo || enviando}
        className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {enviando ? 'Inscribiendo…' : 'Inscribir estudiante'}
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
