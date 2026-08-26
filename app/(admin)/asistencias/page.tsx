'use client'

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
  const [filas, setFilas] = useState<Fila[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
  const [cargandoLista, setCargandoLista] = useState(false)
  const [marcando, setMarcando] = useState<string | null>(null)
  const [totalHoy, setTotalHoy] = useState(0)

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

      // Conteo global de registrados hoy — todas las cohortes juntas.
      const { data: sesionesHoy } = await supabase.from('class_sessions').select('id').eq('session_date', hoyISO)
      const idsSesiones = (sesionesHoy ?? []).map((s) => s.id)
      if (idsSesiones.length) {
        const { count } = await supabase
          .from('attendance_events').select('id', { count: 'exact', head: true }).in('session_id', idsSesiones)
        setTotalHoy(count ?? 0)
      }

      setCargando(false)
    }
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  async function cargarLista() {
    if (!cohorteId) return
    setCargandoLista(true)
    const supabase = createClient()

    const [{ data: sesion }, { data: estudiantes }] = await Promise.all([
      supabase
        .from('class_sessions')
        .select('id')
        .eq('cohort_id', cohorteId)
        .eq('session_date', hoyISO)
        .maybeSingle(),
      supabase
        .from('students')
        .select('id, profiles(full_name, cedula, phone)')
        .eq('cohort_id', cohorteId),
    ])

    setSessionId(sesion?.id ?? null)

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
      const { data: cohorte } = await supabase
        .from('cohorts').select('current_module_id').eq('id', cohorteId).single()
      if (!cohorte?.current_module_id) {
        setMarcando(null)
        return
      }
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
        .select('id')
        .single()
      idSesion = nueva?.id ?? null
      setSessionId(idSesion)
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
    setTotalHoy((n) => n + 1)
    setMarcando(null)
  }

  function descargarCSV() {
    const cohorte = cohortes.find((c) => c.id === cohorteId)
    const encabezados = ['Nombre y apellido', 'Cédula', 'Número', 'Fecha', 'Asistió']
    const filasCSV = filas.map((f) => [
      f.nombre, f.cedula, f.telefono ?? '', hoyISO, f.presente ? 'Sí' : 'No',
    ])

    const csv = [encabezados, ...filasCSV]
      .map((fila) => fila.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `asistencia_${(cohorte?.nombre ?? 'cohorte').replace(/[^a-zA-Z0-9]/g, '_')}_${hoyISO}.csv`
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

      <Encabezado sobretitulo="Administración" titulo="Asistencia" />

      <Regla delay={60} />

      <Dato valor={totalHoy} etiqueta="Registrados hoy, todas las cohortes" tono="exito" />

      {cohortes.length === 0 ? (
        <EstadoVacio titulo="Sin cohortes" explicacion="Todavía no hay cohortes creadas." />
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
              onClick={descargarCSV}
              className="w-full rounded-lg border border-zr-border py-3 text-sm font-semibold text-zr-text"
            >
              Descargar esta cohorte (CSV)
            </button>
          )}

          {cargandoLista ? (
            <p className="text-sm text-zr-text-muted">Cargando…</p>
          ) : filasFiltradas.length === 0 ? (
            <EstadoVacio
              titulo="Sin resultados"
              explicacion={filas.length === 0 ? 'Esta cohorte todavía no tiene estudiantes.' : 'Nadie coincide con la búsqueda.'}
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
