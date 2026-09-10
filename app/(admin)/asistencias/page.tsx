'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Dato } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'
import { IconoCheck } from '@/components/ui/Iconos'

/**
 * Asistencia — cuadro completo (sept. 2026, pedido explícito del
 * coordinador, con foto de la planilla física de referencia): antes esta
 * pantalla solo mostraba el día de hoy, y para ver cualquier fecha pasada
 * había que entrar a una pantalla aparte ("Ver asistencia general e
 * histórico") con filtros de sede/módulo/rango de fechas. Esa pantalla
 * aparte se elimina — "lo principal no se puede ocultar lo que ya pasó".
 *
 * Ahora es UN SOLO cuadro, igual que la hoja de firmas en papel: cada fila
 * un estudiante (con cédula y teléfono, como en la planilla), cada columna
 * una fecha de sábado ya dada de la cohorte elegida, la celda dice si vino,
 * a qué hora, o si está justificado — y se puede justificar una ausencia
 * directo desde ahí, sin ir a otra pantalla.
 *
 * En computadora se ve como tabla completa (columna de nombre fija, fechas
 * deslizables si son muchas). En teléfono una tabla así no cabe, así que
 * cada estudiante es una tarjeta con una tira horizontal de chips, uno por
 * fecha — mismos datos, otra forma de leerlos.
 */

interface Cohorte { id: string; nombre: string }
interface Sesion { id: string; fecha: string; status: string }
interface Estudiante { id: string; nombre: string; cedula: string; telefono: string | null }

type Estado = 'presente' | 'tarde' | 'ausente' | 'justificado'

interface Celda {
  sessionId: string
  fecha: string
  estado: Estado
  hora: string | null
  justificacion: string | null
  esHoy: boolean
}

const RAZON_MANUAL = 'Registrado a mano desde el panel de administración'

function fechaCorta(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const ETIQUETA_ESTADO: Record<Estado, string> = {
  presente: 'Presente', tarde: 'Tarde', ausente: 'Ausente', justificado: 'Justificado',
}

export default function Asistencias() {
  const router = useRouter()
  const [cohortes, setCohortes] = useState<Cohorte[]>([])
  const [cohorteId, setCohorteId] = useState('')
  const [sesiones, setSesiones] = useState<Sesion[]>([])
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([])
  const [eventos, setEventos] = useState<Map<string, { hora: string; estado: Estado }>>(new Map())
  const [justificaciones, setJustificaciones] = useState<Map<string, string>>(new Map())
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [cargandoCuadro, setCargandoCuadro] = useState(false)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [marcando, setMarcando] = useState<string | null>(null)

  const hoyISO = new Date().toISOString().slice(0, 10)
  const sesionHoy = sesiones.find((s) => s.fecha === hoyISO) ?? null

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: cohs } = await supabase.from('cohorts').select('id, name').order('name')
      const lista = (cohs ?? []).map((c) => ({ id: c.id, nombre: c.name }))
      setCohortes(lista)
      if (lista.length) setCohorteId(lista[0].id)

      setCargando(false)
    }
    cargar()
  }, [router])

  // Crea la sesión de hoy para esta cohorte si todavía no existe — mismo
  // criterio que ya usaba esta pantalla y que el cron de la migración 077,
  // para que "marcar a mano" y "abrir/cerrar" funcionen aunque el cron aún
  // no haya corrido o la cohorte no tenga profesor asignado.
  async function asegurarSesionDeHoy(supabase: ReturnType<typeof createClient>): Promise<{ id: string; status: string } | null> {
    const { data: cohorte } = await supabase
      .from('cohorts').select('current_module_id').eq('id', cohorteId).single()
    if (!cohorte?.current_module_id) return null

    const { data: ultima } = await supabase
      .from('class_sessions').select('week_number').eq('cohort_id', cohorteId)
      .order('week_number', { ascending: false }).limit(1).maybeSingle()

    const { data: nueva } = await supabase
      .from('class_sessions')
      .insert({
        cohort_id: cohorteId,
        module_id: cohorte.current_module_id,
        session_date: hoyISO,
        week_number: (ultima?.week_number ?? 0) + 1,
        status: 'programada',
      })
      .select('id, status')
      .single()

    return nueva as { id: string; status: string } | null
  }

  const cargarCuadro = useCallback(async () => {
    if (!cohorteId) return
    setCargandoCuadro(true)
    const supabase = createClient()

    const [{ data: sesionesRaw }, { data: alumnosRaw }] = await Promise.all([
      supabase
        .from('class_sessions')
        .select('id, session_date, status')
        .eq('cohort_id', cohorteId)
        .order('session_date', { ascending: true }),
      supabase
        .from('students')
        .select('id, profiles!students_id_fkey(full_name, cedula, phone)')
        .eq('cohort_id', cohorteId),
    ])

    const listaSesiones = (sesionesRaw ?? []).map((s) => ({ id: s.id, fecha: s.session_date, status: s.status }))
    setSesiones(listaSesiones)

    setEstudiantes(
      ((alumnosRaw ?? []) as unknown as {
        id: string; profiles: { full_name: string; cedula: string; phone: string | null } | null
      }[])
        .map((a) => ({
          id: a.id, nombre: a.profiles?.full_name ?? '', cedula: a.profiles?.cedula ?? '',
          telefono: a.profiles?.phone ?? null,
        }))
        .sort((x, y) => x.nombre.localeCompare(y.nombre)),
    )

    if (listaSesiones.length === 0) {
      setEventos(new Map())
      setJustificaciones(new Map())
      setCargandoCuadro(false)
      return
    }

    const sessionIds = listaSesiones.map((s) => s.id)
    const [{ data: eventosRaw }, { data: justifsRaw }] = await Promise.all([
      supabase
        .from('attendance_events')
        .select('session_id, student_id, scanned_at, status')
        .in('session_id', sessionIds),
      supabase
        .from('attendance_justifications')
        .select('session_id, student_id, reason')
        .in('session_id', sessionIds),
    ])

    setEventos(new Map(
      ((eventosRaw ?? []) as { session_id: string; student_id: string; scanned_at: string; status: string | null }[])
        .map((e) => [`${e.session_id}|${e.student_id}`, {
          hora: new Date(e.scanned_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }),
          estado: (e.status === 'tarde' ? 'tarde' : 'presente') as Estado,
        }]),
    ))
    setJustificaciones(new Map(
      ((justifsRaw ?? []) as { session_id: string; student_id: string; reason: string }[])
        .map((j) => [`${j.session_id}|${j.student_id}`, j.reason]),
    ))

    setCargandoCuadro(false)
  }, [cohorteId])

  useEffect(() => {
    void cargarCuadro()
  }, [cargarCuadro])

  async function marcarAMano(estudianteId: string) {
    setMarcando(estudianteId)
    const supabase = createClient()

    let idSesion = sesionHoy?.id ?? null
    if (!idSesion) {
      const nueva = await asegurarSesionDeHoy(supabase)
      idSesion = nueva?.id ?? null
    }
    if (!idSesion) {
      setMarcando(null)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('attendance_events').insert({
      session_id: idSesion,
      student_id: estudianteId,
      scanned_by: user?.id,
      method: 'manual',
      manual_reason: RAZON_MANUAL,
    })

    await cargarCuadro()
    setMarcando(null)
  }

  async function justificar(sessionId: string, estudianteId: string) {
    const motivo = window.prompt('Motivo de la justificación (ej. reposo médico, fallecimiento familiar):')
    if (!motivo || !motivo.trim()) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('attendance_justifications').insert({
      session_id: sessionId,
      student_id: estudianteId,
      reason: motivo.trim(),
      justified_by: user?.id ?? null,
    })

    if (!error) {
      setJustificaciones((prev) => new Map(prev).set(`${sessionId}|${estudianteId}`, motivo.trim()))
    }
  }

  // Solo importa para la entrega de refrigerio (claim-snack exige la sesión
  // "abierta"); la asistencia por QR ya funciona con la sesión "programada".
  // Respaldo por si el profesor todavía no tiene cuenta creada un sábado.
  async function abrirOCerrar() {
    setCambiandoEstado(true)
    const supabase = createClient()

    let idSesion = sesionHoy?.id ?? null
    if (!idSesion) {
      const nueva = await asegurarSesionDeHoy(supabase)
      idSesion = nueva?.id ?? null
    }
    if (!idSesion) {
      setCambiandoEstado(false)
      return
    }

    const nuevoEstado = sesionHoy?.status === 'abierta' ? 'cerrada' : 'abierta'
    await supabase.from('class_sessions').update({ status: nuevoEstado }).eq('id', idSesion)
    await cargarCuadro()
    setCambiandoEstado(false)
  }

  // El cruce estudiante × sesión: la ausencia no es una fila en la base, es
  // la falta de un evento. Si esa ausencia tiene justificación, se muestra
  // "justificado" en vez de "ausente".
  const filas = useMemo(() => estudiantes.map((e) => ({
    ...e,
    celdas: sesiones.map((s): Celda => {
      const clave = `${s.id}|${e.id}`
      const evento = eventos.get(clave)
      const justificacion = justificaciones.get(clave) ?? null
      return {
        sessionId: s.id,
        fecha: s.fecha,
        estado: evento ? evento.estado : (justificacion ? 'justificado' : 'ausente'),
        hora: evento?.hora ?? null,
        justificacion,
        esHoy: s.fecha === hoyISO,
      }
    }),
  })), [estudiantes, sesiones, eventos, justificaciones, hoyISO])

  const texto = busqueda.trim().toLowerCase()
  const filasFiltradas = filas.filter(
    (f) => !texto || f.nombre.toLowerCase().includes(texto) || f.cedula.toLowerCase().includes(texto),
  )

  const registradosHoy = sesionHoy
    ? filas.filter((f) => f.celdas.some((c) => c.esHoy && (c.estado === 'presente' || c.estado === 'tarde'))).length
    : 0

  // Tabla de Excel sin depender de ninguna librería externa (npm audit marcó
  // la única disponible, `xlsx`/SheetJS, con vulnerabilidades altas sin
  // parche). Excel abre nativamente una tabla HTML con este tipo MIME y
  // extensión .xls — mismo resultado, sin ese riesgo.
  function descargarExcel() {
    const cohorte = cohortes.find((c) => c.id === cohorteId)
    const escapar = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    const encabezados = `<th>Nombre y apellido</th><th>Cédula</th><th>Teléfono</th>`
      + sesiones.map((s) => `<th>${s.fecha}</th>`).join('')

    const filasHTML = filasFiltradas
      .map((f) => `<tr>
        <td>${escapar(f.nombre)}</td>
        <td>${escapar(f.cedula)}</td>
        <td>${escapar(f.telefono ?? '')}</td>
        ${f.celdas.map((c) => `<td>${
          c.estado === 'presente' || c.estado === 'tarde' ? `Sí (${c.hora})`
          : c.estado === 'justificado' ? 'Justificado'
          : 'No'
        }</td>`).join('')}
      </tr>`)
      .join('')

    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="utf-8">
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
        <x:Name>${escapar(cohorte?.nombre ?? 'Asistencia')}</x:Name>
        <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
        </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
      </head>
      <body>
        <table border="1">
          <thead><tr>${encabezados}</tr></thead>
          <tbody>${filasHTML}</tbody>
        </table>
      </body>
    </html>`

    const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `asistencia_${(cohorte?.nombre ?? 'programa').replace(/[^a-zA-Z0-9]/g, '_')}.xls`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14">
      <BotonVolver href="/panel" />

      <Encabezado
        sobretitulo="Administración"
        titulo="Asistencia"
        descripcion="Todas las fechas, de un vistazo — igual que la hoja de firmas."
      />

      <Regla delay={60} />

      {sesionHoy && (
        <Dato
          valor={registradosHoy}
          etiqueta={`Registrados hoy · ${cohortes.find((c) => c.id === cohorteId)?.nombre ?? 'este programa'}`}
          tono="exito"
        />
      )}

      {cohortes.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-zr-border bg-zr-surface px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zr-text">
              Sesión de hoy {sesionHoy?.status === 'abierta' ? 'abierta' : sesionHoy?.status === 'cerrada' ? 'cerrada' : 'sin abrir'}
            </p>
            <p className="mt-0.5 text-xs text-zr-text-muted">
              Solo hace falta abrirla para entregar refrigerio. El QR de asistencia funciona igual sin esto.
            </p>
          </div>
          <button
            onClick={abrirOCerrar}
            disabled={cambiandoEstado}
            className={`shrink-0 rounded-lg px-4 py-2.5 text-sm font-bold disabled:opacity-50 ${
              sesionHoy?.status === 'abierta'
                ? 'border border-zr-border text-zr-text'
                : 'bg-zr-blue text-white'
            }`}
          >
            {cambiandoEstado ? '…' : sesionHoy?.status === 'abierta' ? 'Cerrar' : 'Abrir'}
          </button>
        </div>
      )}

      {cohortes.length === 0 ? (
        <EstadoVacio titulo="Sin programas" explicacion="Todavía no hay programas creados." />
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1 zr-scroll-x">
            {cohortes.map((c) => (
              <button
                key={c.id}
                onClick={() => setCohorteId(c.id)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                  cohorteId === c.id
                    ? 'border-zr-blue bg-zr-blue/15 text-zr-blue'
                    : 'border-zr-border text-zr-text-muted'
                }`}
              >
                {c.nombre}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre o cédula…"
            className="w-full rounded-lg border border-zr-border bg-zr-surface px-5 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
          />

          {filasFiltradas.length > 0 && (
            <button
              onClick={descargarExcel}
              className="w-full rounded-lg border border-zr-border py-3 text-sm font-semibold text-zr-text"
            >
              Descargar este programa (Excel)
            </button>
          )}

          {cargandoCuadro ? (
            <p className="text-sm text-zr-text-muted">Cargando…</p>
          ) : filasFiltradas.length === 0 ? (
            <EstadoVacio
              titulo="Sin resultados"
              explicacion={filas.length === 0 ? 'Este programa todavía no tiene estudiantes.' : 'Nadie coincide con la búsqueda.'}
            />
          ) : sesiones.length === 0 ? (
            <EstadoVacio
              titulo="Todavía no hay sesiones"
              explicacion="En cuanto exista la primera sesión de este programa, aquí aparece la primera columna."
            />
          ) : (
            <>
              {/* Computadora (≥1024px): tabla completa, columna de nombre
                  fija, fechas deslizables. */}
              <div className="hidden overflow-x-auto rounded-lg border border-zr-border lg:block">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-zr-surface">
                      <th className="sticky left-0 z-10 min-w-[220px] border-b border-r border-zr-border bg-zr-surface px-4 py-3 text-left font-bold text-zr-text">
                        Estudiante
                      </th>
                      {sesiones.map((s) => (
                        <th
                          key={s.id}
                          className={`min-w-[92px] border-b border-zr-border px-3 py-3 text-center font-bold text-zr-text-muted ${
                            s.fecha === hoyISO ? 'bg-zr-blue/10 text-zr-blue' : ''
                          }`}
                        >
                          {fechaCorta(s.fecha)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filasFiltradas.map((f) => (
                      <tr key={f.id} className="border-b border-zr-border last:border-b-0">
                        <td className="sticky left-0 z-10 border-r border-zr-border bg-zr-surface px-4 py-3">
                          <p className="truncate font-semibold text-zr-text">{f.nombre}</p>
                          <p className="text-xs tabular-nums text-zr-text-muted">{f.cedula} · {f.telefono ?? 'sin teléfono'}</p>
                        </td>
                        {f.celdas.map((c) => (
                          <CeldaAsistencia
                            key={c.sessionId}
                            celda={c}
                            marcando={marcando === f.id}
                            onMarcar={() => marcarAMano(f.id)}
                            onJustificar={() => justificar(c.sessionId, f.id)}
                          />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Teléfono: una tarjeta por estudiante, con una tira
                  horizontal de chips (uno por fecha) en vez de una tabla
                  que no cabría en la pantalla. */}
              <div className="space-y-3 lg:hidden">
                {filasFiltradas.map((f) => (
                  <div key={f.id} className="zr-card p-4">
                    <p className="truncate text-sm font-semibold text-zr-text">{f.nombre}</p>
                    <p className="text-xs tabular-nums text-zr-text-muted">{f.cedula} · {f.telefono ?? 'sin teléfono'}</p>
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1 zr-scroll-x">
                      {f.celdas.map((c) => (
                        <ChipAsistencia
                          key={c.sessionId}
                          celda={c}
                          marcando={marcando === f.id}
                          onMarcar={() => marcarAMano(f.id)}
                          onJustificar={() => justificar(c.sessionId, f.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function CeldaAsistencia({
  celda, marcando, onMarcar, onJustificar,
}: { celda: Celda; marcando: boolean; onMarcar: () => void; onJustificar: () => void }) {
  if (celda.estado === 'presente' || celda.estado === 'tarde') {
    return (
      <td className="border-l border-zr-border px-2 py-3 text-center" title={ETIQUETA_ESTADO[celda.estado]}>
        <div className="flex flex-col items-center gap-0.5">
          <IconoCheck size={16} className={celda.estado === 'tarde' ? 'text-zr-warning' : 'text-zr-success'} />
          <span className="text-[10px] text-zr-text-muted">{celda.hora}</span>
        </div>
      </td>
    )
  }

  if (celda.estado === 'justificado') {
    return (
      <td className="border-l border-zr-border px-2 py-3 text-center" title={celda.justificacion ?? ''}>
        <span className="text-xs font-bold text-zr-text-muted">J</span>
      </td>
    )
  }

  // Ausente: hoy se puede marcar a mano (llegó y se le olvidó el QR); una
  // fecha pasada solo se puede justificar, no inventar que sí vino.
  return (
    <td className="border-l border-zr-border px-2 py-3 text-center">
      {celda.esHoy ? (
        <button
          onClick={onMarcar}
          disabled={marcando}
          className="text-xs font-bold text-zr-blue-mid underline decoration-dotted disabled:opacity-50"
        >
          {marcando ? '…' : 'Marcar'}
        </button>
      ) : (
        <button
          onClick={onJustificar}
          className="text-xs font-bold text-zr-error/70 underline decoration-dotted"
        >
          Justificar
        </button>
      )}
    </td>
  )
}

function ChipAsistencia({
  celda, marcando, onMarcar, onJustificar,
}: { celda: Celda; marcando: boolean; onMarcar: () => void; onJustificar: () => void }) {
  const base = 'flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-2.5 py-2 text-center min-w-[52px]'

  if (celda.estado === 'presente' || celda.estado === 'tarde') {
    return (
      <div className={`${base} bg-zr-success/12`}>
        <IconoCheck size={14} className={celda.estado === 'tarde' ? 'text-zr-warning' : 'text-zr-success'} />
        <span className="text-[10px] font-semibold text-zr-text-muted">{fechaCorta(celda.fecha)}</span>
      </div>
    )
  }

  if (celda.estado === 'justificado') {
    return (
      <div className={`${base} bg-zr-border/40`}>
        <span className="text-xs font-bold text-zr-text-muted">J</span>
        <span className="text-[10px] font-semibold text-zr-text-muted">{fechaCorta(celda.fecha)}</span>
      </div>
    )
  }

  return (
    <button
      onClick={celda.esHoy ? onMarcar : onJustificar}
      disabled={marcando}
      className={`${base} border border-dashed border-zr-error/40 bg-zr-error/8 disabled:opacity-50`}
    >
      <span className="text-[10px] font-bold text-zr-error/80">{celda.esHoy ? (marcando ? '…' : 'Marcar') : 'Justif.'}</span>
      <span className="text-[10px] font-semibold text-zr-text-muted">{fechaCorta(celda.fecha)}</span>
    </button>
  )
}
