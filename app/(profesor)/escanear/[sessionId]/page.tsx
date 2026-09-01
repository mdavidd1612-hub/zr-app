'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import { createClient } from '@/lib/supabase/client'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { encolar, sincronizar, contarPendientes, listenToOnline, type PendingScan } from '@/lib/scan-queue'

/**
 * T-207 · `/escanear/[sessionId]` — spec/04_PANTALLAS.md.
 *
 * La pantalla crítica: de pie, con una mano, mientras entran los estudiantes.
 * Cámara arriba, resultado grande abajo, cuenta atrás de 2s y vuelve a
 * escanear sola. Todo pasa primero por IndexedDB (encolar) y se sincroniza
 * después — un escaneo nunca se pierde por perder señal en el taller.
 */

type Resultado =
  | { tipo: 'exito'; nombre: string; duplicado: boolean }
  | { tipo: 'error'; mensaje: string }
  | null

interface EstudianteCohorte {
  id: string
  fullName: string
  cedula: string
}

const MOTIVOS = ['Olvidó el teléfono', 'Teléfono sin batería', 'Otro'] as const

export default function Escanear() {
  const params = useParams()
  const sessionId = params.sessionId as string

  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const bloqueadoRef = useRef(false)

  const [modo, setModo] = useState<'asistencia' | 'refrigerio'>('asistencia')
  const [resultado, setResultado] = useState<Resultado>(null)
  const [presentes, setPresentes] = useState(0)
  const [inscritos, setInscritos] = useState(0)
  const [pendientes, setPendientes] = useState(0)
  const [errorCamara, setErrorCamara] = useState<string | null>(null)

  const [buscadorAbierto, setBuscadorAbierto] = useState(false)
  const [estudiantes, setEstudiantes] = useState<EstudianteCohorte[]>([])
  const [filtro, setFiltro] = useState('')
  const [eligiendoMotivo, setEligiendoMotivo] = useState<EstudianteCohorte | null>(null)
  const [motivoOtro, setMotivoOtro] = useState('')

  const cargarResumen = useCallback(async () => {
    const supabase = createClient()
    const { data: sesion } = await supabase
      .from('class_sessions')
      .select('cohort_id')
      .eq('id', sessionId)
      .single()
    if (!sesion) return

    const [{ count: pres }, { count: insc }] = await Promise.all([
      supabase.from('attendance_events').select('id', { count: 'exact', head: true }).eq('session_id', sessionId),
      supabase.from('students').select('id', { count: 'exact', head: true }).eq('cohort_id', sesion.cohort_id),
    ])
    setPresentes(pres ?? 0)
    setInscritos(insc ?? 0)
  }, [sessionId])

  const llamarFuncion = useCallback(async (nombre: string, cuerpo: Record<string, unknown>) => {
    const supabase = createClient()
    const { data, error } = await supabase.functions.invoke(nombre, { body: cuerpo })
    if (error) {
      // El body del error viene en error.context para FunctionsHttpError.
      const contexto = (error as { context?: Response }).context
      if (contexto) {
        try {
          const cuerpoError = await contexto.json()
          return { ok: false as const, error: cuerpoError.error }
        } catch {
          // sigue abajo
        }
      }
      return { ok: false as const, error: { code: 'ERROR_INTERNO', message: 'No se pudo conectar' } }
    }
    return data as { ok: true; student?: { fullName: string }; duplicate?: boolean } | { ok: false; error: { code: string; message: string } }
  }, [])

  const procesarQR = useCallback(async (qrCode: string) => {
    if (bloqueadoRef.current) return
    bloqueadoRef.current = true

    const scannedAt = new Date().toISOString()
    const deviceId = typeof window !== 'undefined' ? (localStorage.getItem('zr-device-id') ?? crypto.randomUUID()) : crypto.randomUUID()
    if (typeof window !== 'undefined') localStorage.setItem('zr-device-id', deviceId)

    const fn = modo === 'asistencia' ? 'validate-scan' : 'claim-snack'
    const cuerpo = modo === 'asistencia'
      ? { sessionId, qrCode, scannedAt, deviceId }
      : { sessionId, qrCode }

    let respuesta: Awaited<ReturnType<typeof llamarFuncion>> | null = null
    try {
      respuesta = await llamarFuncion(fn, cuerpo)
    } catch {
      respuesta = null
    }

    // Sin red o fallo de conexión: se encola y se cuenta como aceptado a
    // ojos del profesor — ya se sincronizará solo.
    if (!respuesta) {
      if (modo === 'asistencia') {
        await encolar({ sessionId, qrCode, scannedAt, deviceId })
        setPendientes(await contarPendientes())
      }
      setResultado({ tipo: 'error', mensaje: 'Sin conexión. Se guardó para sincronizar después.' })
    } else if (respuesta.ok) {
      setResultado({
        tipo: 'exito',
        nombre: respuesta.student?.fullName ?? 'Estudiante',
        duplicado: respuesta.duplicate ?? false,
      })
      if (modo === 'asistencia') await cargarResumen()
    } else {
      setResultado({ tipo: 'error', mensaje: respuesta.error.message })
    }

    setTimeout(() => {
      setResultado(null)
      bloqueadoRef.current = false
    }, 2000)
  }, [modo, sessionId, llamarFuncion, cargarResumen])

  // Cámara
  useEffect(() => {
    let cancelado = false
    const lector = new BrowserQRCodeReader()

    async function iniciar() {
      try {
        const dispositivos = await BrowserQRCodeReader.listVideoInputDevices()
        const trasera = dispositivos.find((d) => /back|trasera|rear|environment/i.test(d.label)) ?? dispositivos[0]

        const controles = await lector.decodeFromVideoDevice(
          trasera?.deviceId,
          videoRef.current!,
          (resultado) => {
            if (resultado && !cancelado) void procesarQR(resultado.getText())
          },
        )
        controlsRef.current = controles
      } catch {
        setErrorCamara('No se pudo acceder a la cámara. Usa la búsqueda por cédula.')
      }
    }

    iniciar()
    return () => {
      cancelado = true
      controlsRef.current?.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Resumen inicial + cola pendiente
  useEffect(() => {
    let vigente = true

    async function cargar() {
      await cargarResumen()
      if (!vigente) return
      setPendientes(await contarPendientes())
    }

    cargar()
    return () => { vigente = false }
  }, [cargarResumen])

  // Sincronización automática al volver la conexión
  useEffect(() => {
    async function intentarSincronizar() {
      const { sincronizados } = await sincronizar(async (scan: PendingScan) => {
        const r = await llamarFuncion('validate-scan', {
          sessionId: scan.sessionId,
          qrCode: scan.qrCode,
          scannedAt: scan.scannedAt,
          deviceId: scan.deviceId,
        })
        return { ok: r.ok, duplicate: r.ok ? r.duplicate : false }
      })
      if (sincronizados > 0) {
        setPendientes(await contarPendientes())
        await cargarResumen()
      }
    }

    const quitar = listenToOnline(intentarSincronizar)
    intentarSincronizar()
    return quitar
  }, [llamarFuncion, cargarResumen])

  async function abrirBuscador() {
    setBuscadorAbierto(true)
    const supabase = createClient()
    const { data: sesion } = await supabase.from('class_sessions').select('cohort_id').eq('id', sessionId).single()
    if (!sesion) return

    const { data } = await supabase
      .from('students')
      .select('id, profiles!students_id_fkey(full_name, cedula)')
      .eq('cohort_id', sesion.cohort_id)

    const filas = (data ?? []) as unknown as { id: string; profiles: { full_name: string; cedula: string } | null }[]
    setEstudiantes(filas.map((f) => ({ id: f.id, fullName: f.profiles?.full_name ?? '', cedula: f.profiles?.cedula ?? '' })))
  }

  async function registrarManual(motivo: string) {
    if (!eligiendoMotivo) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('attendance_events').insert({
      session_id: sessionId,
      student_id: eligiendoMotivo.id,
      scanned_by: user.id,
      method: 'manual',
      manual_reason: motivo,
    })

    if (!error) {
      setResultado({ tipo: 'exito', nombre: eligiendoMotivo.fullName, duplicado: false })
      await cargarResumen()
    } else {
      setResultado({ tipo: 'error', mensaje: error.code === '23505' ? 'Ya registrado' : 'No se pudo registrar' })
    }

    setEligiendoMotivo(null)
    setMotivoOtro('')
    setBuscadorAbierto(false)
    setTimeout(() => setResultado(null), 2000)
  }

  const estudiantesFiltrados = estudiantes.filter(
    (e) => e.fullName.toLowerCase().includes(filtro.toLowerCase()) || e.cedula.includes(filtro.toUpperCase()),
  )

  return (
    <div className="flex min-h-dvh flex-col bg-black">
      {/* Cámara */}
      <div className="relative h-[68vh] w-full overflow-hidden bg-zr-bg">
        <div className="absolute left-3 top-3 z-10">
          <BotonVolver href="/sesiones" texto="Salir" />
        </div>

        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />

        {errorCamara && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6 text-center">
            <p className="text-sm text-white">{errorCamara}</p>
          </div>
        )}

        {/* Interruptor de modo */}
        <div className="absolute right-3 top-3 z-10 flex overflow-hidden rounded-full border border-white/20 bg-black/60 backdrop-blur">
          <button
            onClick={() => setModo('asistencia')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wide ${modo === 'asistencia' ? 'bg-zr-blue text-white' : 'text-white/70'}`}
          >
            Asistencia
          </button>
          <button
            onClick={() => setModo('refrigerio')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wide ${modo === 'refrigerio' ? 'bg-zr-blue text-white' : 'text-white/70'}`}
          >
            Refrigerio
          </button>
        </div>

        {/* Franja de resultado */}
        {resultado && (
          <div
            className={`absolute inset-x-0 bottom-0 flex flex-col items-center justify-center px-6 py-8 text-center ${
              resultado.tipo === 'exito'
                ? resultado.duplicado ? 'bg-zr-warning' : 'bg-zr-success'
                : 'bg-zr-error'
            }`}
          >
            {resultado.tipo === 'exito' ? (
              <>
                <p className="text-3xl font-bold text-white">{resultado.duplicado ? 'Ya registrado' : resultado.nombre}</p>
                {!resultado.duplicado && <p className="mt-1 text-sm text-white/80">{resultado.nombre}</p>}
              </>
            ) : (
              <p className="text-xl font-bold text-white">{resultado.mensaje}</p>
            )}
          </div>
        )}
      </div>

      {/* Panel inferior */}
      <div className="flex flex-1 flex-col justify-between bg-zr-bg px-5 py-5">
        <div className="flex items-center justify-between">
          <p className="zr-metric text-2xl text-zr-text">
            Asistencia: {presentes} / {inscritos}
          </p>
          {pendientes > 0 && (
            <span className="rounded-full bg-zr-warning/20 px-3 py-1.5 text-xs font-bold text-zr-warning">
              {pendientes} sin sincronizar
            </span>
          )}
        </div>

        <button
          onClick={abrirBuscador}
          className="mt-5 min-h-14 w-full rounded-lg border border-zr-border text-base font-semibold text-zr-text"
        >
          Buscar por cédula
        </button>
      </div>

      {/* Buscador manual */}
      {buscadorAbierto && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60" onClick={() => setBuscadorAbierto(false)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[80vh] w-full overflow-y-auto rounded-t-2xl bg-zr-surface pb-10 pt-4">
            <div className="mx-auto h-1 w-10 rounded-full bg-zr-border" />

            {eligiendoMotivo ? (
              <div className="space-y-4 px-5 pt-6">
                <p className="text-base font-bold text-zr-text">{eligiendoMotivo.fullName}</p>
                <p className="text-sm text-zr-text-muted">¿Por qué se registra a mano?</p>
                {MOTIVOS.map((m) => (
                  <button
                    key={m}
                    onClick={() => (m === 'Otro' ? null : registrarManual(m))}
                    className="block w-full rounded-lg border border-zr-border px-4 py-3.5 text-left text-base text-zr-text"
                  >
                    {m}
                  </button>
                ))}
                <input
                  value={motivoOtro}
                  onChange={(e) => setMotivoOtro(e.target.value)}
                  placeholder="Escribe el motivo…"
                  className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted"
                />
                <button
                  onClick={() => registrarManual(motivoOtro)}
                  disabled={!motivoOtro.trim()}
                  className="min-h-14 w-full rounded-lg bg-zr-blue text-base font-bold text-white disabled:opacity-40"
                >
                  Registrar
                </button>
                <button onClick={() => setEligiendoMotivo(null)} className="w-full py-2 text-sm text-zr-text-muted">
                  Volver
                </button>
              </div>
            ) : (
              <div className="space-y-3 px-5 pt-4">
                <input
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  placeholder="Buscar por nombre o cédula…"
                  className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted"
                  autoFocus
                />
                <div className="space-y-1">
                  {estudiantesFiltrados.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setEligiendoMotivo(e)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-3.5 text-left active:bg-zr-border/40"
                    >
                      <span className="text-base font-medium text-zr-text">{e.fullName}</span>
                      <span className="text-sm tabular-nums text-zr-text-muted">{e.cedula}</span>
                    </button>
                  ))}
                  {estudiantesFiltrados.length === 0 && (
                    <p className="px-3 py-6 text-center text-sm text-zr-text-muted">Sin resultados</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
