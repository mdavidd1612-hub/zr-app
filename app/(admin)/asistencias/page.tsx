'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Etiqueta, Dato } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'

/**
 * Fase 0 (docs/15_FASE0_PLAN_ADMIN.md, ajuste): asistencia de hoy, filtrada
 * por cohorte, con buscador, marcado manual y descarga en CSV — se reinicia
 * sola cada sábado porque todo se lee por `session_date = hoy`.
 */

interface Cohorte {
  id: string
  nombre: string
}

type EstadoSesion = 'programada' | 'abierta' | 'cerrada' | 'reprogramada' | 'cancelada'

interface Fila {
  id: string
  nombre: string
  cedula: string
  telefono: string | null
  presente: boolean
  hora: string | null
}

const RAZON_MANUAL = 'Registrado a mano desde el panel de administración'

export default function Asistencias() {
  const router = useRouter()
  const [cohortes, setCohortes] = useState<Cohorte[]>([])
  const [cohorteId, setCohorteId] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [estadoSesion, setEstadoSesion] = useState<EstadoSesion | null>(null)
  const [cambiandoEstado, setCambiandoEstado] = useState(false)
  const [filas, setFilas] = useState<Fila[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [cargandoLista, setCargandoLista] = useState(false)
  const [marcando, setMarcando] = useState<string | null>(null)

  const hoyISO = new Date().toISOString().slice(0, 10)

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
  // criterio que "marcar a mano" y que el cron de la migración 077, para que
  // el botón de abrir/cerrar exista aunque el cron aún no haya corrido o la
  // cohorte no tenga profesor asignado.
  async function asegurarSesion(supabase: ReturnType<typeof createClient>): Promise<{ id: string; status: EstadoSesion } | null> {
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

    return nueva as { id: string; status: EstadoSesion } | null
  }

  async function cargarLista() {
    if (!cohorteId) return
    setCargandoLista(true)
    const supabase = createClient()

    const [{ data: sesion }, { data: estudiantes }] = await Promise.all([
      supabase
        .from('class_sessions')
        .select('id, status')
        .eq('cohort_id', cohorteId)
        .eq('session_date', hoyISO)
        .maybeSingle(),
      supabase
        .from('students')
        .select('id, profiles!students_id_fkey(full_name, cedula, phone)')
        .eq('cohort_id', cohorteId),
    ])

    setSessionId(sesion?.id ?? null)
    setEstadoSesion((sesion?.status as EstadoSesion) ?? null)

    const alumnos = (estudiantes ?? []) as unknown as {
      id: string; profiles: { full_name: string; cedula: string; phone: string | null } | null
    }[]

    if (!sesion) {
      setFilas(
        alumnos.map((a) => ({
          id: a.id, nombre: a.profiles?.full_name ?? '', cedula: a.profiles?.cedula ?? '',
          telefono: a.profiles?.phone ?? null, presente: false, hora: null,
        })).sort((x, y) => x.nombre.localeCompare(y.nombre)),
      )
      setCargandoLista(false)
      return
    }

    const { data: presentes } = await supabase
      .from('attendance_events')
      .select('student_id, scanned_at')
      .eq('session_id', sesion.id)

    const porEstudiante = new Map((presentes ?? []).map((p) => [p.student_id, p.scanned_at]))

    setFilas(
      alumnos
        .map((a) => ({
          id: a.id,
          nombre: a.profiles?.full_name ?? '',
          cedula: a.profiles?.cedula ?? '',
          telefono: a.profiles?.phone ?? null,
          presente: porEstudiante.has(a.id),
          hora: porEstudiante.get(a.id)
            ? new Date(porEstudiante.get(a.id)!).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
            : null,
        }))
        .sort((x, y) => Number(y.presente) - Number(x.presente) || x.nombre.localeCompare(y.nombre)),
    )
    setCargandoLista(false)
  }

  useEffect(() => {
    void (async () => {
      await cargarLista()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cohorteId])

  async function marcarAMano(estudianteId: string) {
    setMarcando(estudianteId)
    const supabase = createClient()

    let idSesion = sessionId
    if (!idSesion) {
      // No hay sesión de hoy para esta cohorte todavía: se crea, igual que
      // hace la pantalla de QR — nadie tiene que "abrir clase" a mano.
      const nueva = await asegurarSesion(supabase)
      idSesion = nueva?.id ?? null
      setSessionId(idSesion)
      setEstadoSesion(nueva?.status ?? null)
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

    await cargarLista()
    setMarcando(null)
  }

  // Solo importa para la entrega de refrigerio (claim-snack exige la sesión
  // "abierta"); la asistencia por QR ya funciona con la sesión "programada".
  // Respaldo por si el profesor todavía no tiene cuenta creada un sábado.
  async function abrirOCerrar() {
    setCambiandoEstado(true)
    const supabase = createClient()

    let idSesion = sessionId
    if (!idSesion) {
      const nueva = await asegurarSesion(supabase)
      idSesion = nueva?.id ?? null
      setSessionId(idSesion)
    }
    if (!idSesion) {
      setCambiandoEstado(false)
      return
    }

    const nuevoEstado: EstadoSesion = estadoSesion === 'abierta' ? 'cerrada' : 'abierta'
    await supabase.from('class_sessions').update({ status: nuevoEstado }).eq('id', idSesion)
    setEstadoSesion(nuevoEstado)
    setCambiandoEstado(false)
  }

  // Tabla de Excel sin depender de ninguna librería externa (npm audit marcó
  // la única disponible, `xlsx`/SheetJS, con vulnerabilidades altas sin
  // parche). Excel abre nativamente una tabla HTML con este tipo MIME y
  // extensión .xls — mismo resultado, sin ese riesgo.
  function descargarExcel() {
    const cohorte = cohortes.find((c) => c.id === cohorteId)
    const escapar = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    const filasHTML = filas
      .map((f) => `<tr>
        <td>${escapar(f.nombre)}</td>
        <td>${escapar(f.cedula)}</td>
        <td>${escapar(f.telefono ?? '')}</td>
        <td>${hoyISO}</td>
        <td>${f.presente ? 'Sí' : 'No'}</td>
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
          <thead><tr>
            <th>Nombre y apellido</th><th>Cédula</th><th>Número</th><th>Fecha</th><th>Asistió</th>
          </tr></thead>
          <tbody>${filasHTML}</tbody>
        </table>
      </body>
    </html>`

    const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `asistencia_${(cohorte?.nombre ?? 'programa').replace(/[^a-zA-Z0-9]/g, '_')}_${hoyISO}.xls`
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

  const texto = busqueda.trim().toLowerCase()
  const filasFiltradas = filas.filter(
    (f) => !texto || f.nombre.toLowerCase().includes(texto) || f.cedula.toLowerCase().includes(texto),
  )

  return (
    <div className="space-y-11 px-5 pt-14">
      <BotonVolver href="/panel" />

      <Encabezado sobretitulo="Administración" titulo="Asistencia de hoy" />

      <Regla delay={60} />

      {/* La vista general con filtros e histórico vive aparte para no
          estorbar el flujo del sábado, que es marcar rápido y seguir. */}
      <Link
        href="/asistencias/historico"
        className="flex min-h-14 items-center justify-between rounded-lg border border-zr-border bg-zr-surface px-5 text-base font-bold text-zr-text"
      >
        Ver asistencia general e histórico
        <span aria-hidden className="text-zr-text-muted">›</span>
      </Link>

      <Dato
        valor={filas.filter((f) => f.presente).length}
        etiqueta={`Registrados hoy · ${cohortes.find((c) => c.id === cohorteId)?.nombre ?? 'este programa'}`}
        tono="exito"
      />

      {cohortes.length > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-zr-border bg-zr-surface px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zr-text">
              Sesión {estadoSesion === 'abierta' ? 'abierta' : estadoSesion === 'cerrada' ? 'cerrada' : 'sin abrir'}
            </p>
            <p className="mt-0.5 text-xs text-zr-text-muted">
              Solo hace falta abrirla para entregar refrigerio. El QR de asistencia funciona igual sin esto.
            </p>
          </div>
          <button
            onClick={abrirOCerrar}
            disabled={cambiandoEstado}
            className={`shrink-0 rounded-lg px-4 py-2.5 text-sm font-bold disabled:opacity-50 ${
              estadoSesion === 'abierta'
                ? 'border border-zr-border text-zr-text'
                : 'bg-zr-blue text-white'
            }`}
          >
            {cambiandoEstado ? '…' : estadoSesion === 'abierta' ? 'Cerrar' : 'Abrir'}
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

          {filas.length > 0 && (
            <button
              onClick={descargarExcel}
              className="w-full rounded-lg border border-zr-border py-3 text-sm font-semibold text-zr-text"
            >
              Descargar este programa (Excel)
            </button>
          )}

          {cargandoLista ? (
            <p className="text-sm text-zr-text-muted">Cargando…</p>
          ) : filasFiltradas.length === 0 ? (
            <EstadoVacio
              titulo="Sin resultados"
              explicacion={filas.length === 0 ? 'Este programa todavía no tiene estudiantes.' : 'Nadie coincide con la búsqueda.'}
            />
          ) : (
            <div className="space-y-2">
              {filasFiltradas.map((f) => (
                <div key={f.id} className="zr-card flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zr-text">{f.nombre}</p>
                    <p className="text-xs tabular-nums text-zr-text-muted">{f.cedula}</p>
                  </div>
                  {f.presente ? (
                    <Etiqueta tono="exito">Presente · {f.hora}</Etiqueta>
                  ) : (
                    <button
                      onClick={() => marcarAMano(f.id)}
                      disabled={marcando === f.id}
                      className="shrink-0 rounded-full border border-zr-blue/40 px-3 py-1.5 text-xs font-bold text-zr-blue-mid disabled:opacity-50"
                    >
                      {marcando === f.id ? 'Marcando…' : 'Marcar a mano'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
