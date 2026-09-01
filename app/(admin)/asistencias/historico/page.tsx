'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Etiqueta, Dato } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'

/**
 * Vista general de asistencia (especificacion-funcional-zrm-academy.md §10.2,
 * Módulo 8): la lista completa, filtrable por programa, módulo, cohorte y
 * rango de fechas, con quién registró cada asistencia y el % por estudiante.
 *
 * NO reemplaza a /asistencias: esa es la pantalla operativa del sábado
 * (marcar a mano, ver quién falta ahora). Esta es la de consulta, la que la
 * spec pide para que administración revise desde su computadora.
 *
 * Estados: por ahora solo presente/ausente. 'tarde' y 'justificado' que pide
 * la spec no existen todavía en `attendance_events` — hace falta una
 * migración aparte, no se inventan aquí.
 */

interface Cohorte { id: string; nombre: string; programaId: string; programa: string }
interface Modulo  { id: string; nombre: string; programaId: string; orden: number }

interface Fila {
  clave: string
  estudianteId: string
  estudiante: string
  cedula: string
  cohorte: string
  modulo: string
  fecha: string
  presente: boolean
  hora: string | null
  registradoPor: string | null
  metodo: string | null
}

// Rango por defecto: el último mes. Suficiente para la revisión semanal sin
// traerse el histórico completo en cada carga.
function haceUnMes(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 10)
}

export default function AsistenciaHistorico() {
  const router = useRouter()

  const [cohortes, setCohortes] = useState<Cohorte[]>([])
  const [modulos, setModulos] = useState<Modulo[]>([])
  const [programas, setProgramas] = useState<{ id: string; nombre: string }[]>([])

  const [programaId, setProgramaId] = useState('')
  const [moduloId, setModuloId] = useState('')
  const [cohorteId, setCohorteId] = useState('')
  const [desde, setDesde] = useState(haceUnMes())
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10))
  const [soloAusentes, setSoloAusentes] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const [filas, setFilas] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(true)
  const [consultando, setConsultando] = useState(false)

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const [{ data: cohs }, { data: mods }] = await Promise.all([
        supabase.from('cohorts').select('id, name, program_id, programs(name)').order('name'),
        supabase.from('modules').select('id, name, program_id, order_index').order('order_index'),
      ])

      const listaCohortes = ((cohs ?? []) as unknown as {
        id: string; name: string; program_id: string; programs: { name: string } | null
      }[]).map((c) => ({
        id: c.id, nombre: c.name, programaId: c.program_id, programa: c.programs?.name ?? '—',
      }))

      const vistos = new Map<string, string>()
      listaCohortes.forEach((c) => vistos.set(c.programaId, c.programa))

      setCohortes(listaCohortes)
      setProgramas([...vistos].map(([id, nombre]) => ({ id, nombre })))
      setModulos((mods ?? []).map((m) => ({
        id: m.id, nombre: m.name, programaId: m.program_id, orden: m.order_index,
      })))
      setCargando(false)
    }
    cargar()
  }, [router])

  const consultar = useCallback(async () => {
    setConsultando(true)
    const supabase = createClient()

    // 1. Sesiones del rango, ya filtradas por programa/módulo/cohorte.
    let q = supabase
      .from('class_sessions')
      .select('id, cohort_id, module_id, session_date, cohorts(name, program_id), modules(name)')
      .gte('session_date', desde)
      .lte('session_date', hasta)
      .order('session_date', { ascending: false })

    if (cohorteId) q = q.eq('cohort_id', cohorteId)
    if (moduloId) q = q.eq('module_id', moduloId)

    const { data: sesionesRaw } = await q

    let sesiones = ((sesionesRaw ?? []) as unknown as {
      id: string; cohort_id: string; module_id: string; session_date: string
      cohorts: { name: string; program_id: string } | null
      modules: { name: string } | null
    }[])

    // El programa no es una columna de class_sessions, así que se filtra
    // sobre lo traído (la relación ya vino en el select).
    if (programaId) sesiones = sesiones.filter((s) => s.cohorts?.program_id === programaId)

    if (sesiones.length === 0) {
      setFilas([])
      setConsultando(false)
      return
    }

    // 2. Estudiantes de las cohortes involucradas y eventos de esas sesiones.
    const cohortIds = [...new Set(sesiones.map((s) => s.cohort_id))]
    const sessionIds = sesiones.map((s) => s.id)

    const [{ data: alumnosRaw }, { data: eventosRaw }] = await Promise.all([
      supabase
        .from('students')
        .select('id, cohort_id, profiles!students_id_fkey(full_name, cedula)')
        .in('cohort_id', cohortIds),
      supabase
        .from('attendance_events')
        .select('session_id, student_id, scanned_at, method, profiles!attendance_events_scanned_by_fkey(full_name)')
        .in('session_id', sessionIds),
    ])

    const alumnos = ((alumnosRaw ?? []) as unknown as {
      id: string; cohort_id: string | null; profiles: { full_name: string; cedula: string } | null
    }[])

    const eventos = ((eventosRaw ?? []) as unknown as {
      session_id: string; student_id: string; scanned_at: string; method: string | null
      profiles: { full_name: string } | null
    }[])

    const porSesionEstudiante = new Map(eventos.map((e) => [`${e.session_id}|${e.student_id}`, e]))
    const porCohorte = new Map<string, typeof alumnos>()
    alumnos.forEach((a) => {
      if (!a.cohort_id) return
      const lista = porCohorte.get(a.cohort_id) ?? []
      lista.push(a)
      porCohorte.set(a.cohort_id, lista)
    })

    // 3. El cruce: cada estudiante de la cohorte × cada sesión del rango. La
    // ausencia no es una fila en la base — es la falta de un evento.
    const resultado: Fila[] = []
    for (const s of sesiones) {
      for (const a of porCohorte.get(s.cohort_id) ?? []) {
        const evento = porSesionEstudiante.get(`${s.id}|${a.id}`)
        resultado.push({
          clave: `${s.id}|${a.id}`,
          estudianteId: a.id,
          estudiante: a.profiles?.full_name ?? '—',
          cedula: a.profiles?.cedula ?? '—',
          cohorte: s.cohorts?.name ?? '—',
          modulo: s.modules?.name ?? '—',
          fecha: s.session_date,
          presente: Boolean(evento),
          hora: evento
            ? new Date(evento.scanned_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
            : null,
          registradoPor: evento?.profiles?.full_name ?? null,
          metodo: evento?.method ?? null,
        })
      }
    }

    setFilas(resultado)
    setConsultando(false)
  }, [programaId, moduloId, cohorteId, desde, hasta])

  // Pequeño retardo antes de consultar: los <input type="date"> disparan un
  // cambio por cada dígito tecleado del año, y sin esto cada uno lanzaría su
  // propia consulta a la base.
  useEffect(() => {
    if (cargando) return
    const t = setTimeout(() => { void consultar() }, 250)
    return () => clearTimeout(t)
  }, [cargando, consultar])

  // Filtro de texto y de ausentes: en memoria, sobre lo ya consultado.
  const filasVisibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    return filas.filter((f) =>
      (!soloAusentes || !f.presente)
      && (!texto || f.estudiante.toLowerCase().includes(texto) || f.cedula.toLowerCase().includes(texto)),
    )
  }, [filas, busqueda, soloAusentes])

  // % de asistencia por estudiante — lo que la spec pide para detectar quién
  // va a necesitar tutoría (§10.2, política de inasistencias).
  const porcentajes = useMemo(() => {
    const acumulado = new Map<string, { nombre: string; cedula: string; total: number; presentes: number }>()
    for (const f of filas) {
      const actual = acumulado.get(f.estudianteId)
        ?? { nombre: f.estudiante, cedula: f.cedula, total: 0, presentes: 0 }
      actual.total += 1
      if (f.presente) actual.presentes += 1
      acumulado.set(f.estudianteId, actual)
    }
    return [...acumulado.values()]
      .map((a) => ({ ...a, pct: a.total ? Math.round((a.presentes / a.total) * 100) : 0 }))
      .sort((x, y) => x.pct - y.pct)
  }, [filas])

  const modulosDelPrograma = programaId
    ? modulos.filter((m) => m.programaId === programaId)
    : modulos
  const cohortesDelPrograma = programaId
    ? cohortes.filter((c) => c.programaId === programaId)
    : cohortes

  function descargarExcel() {
    const escapar = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const cuerpo = filasVisibles.map((f) => `<tr>
      <td>${escapar(f.estudiante)}</td>
      <td>${escapar(f.cedula)}</td>
      <td>${escapar(f.cohorte)}</td>
      <td>${escapar(f.modulo)}</td>
      <td>${f.fecha}</td>
      <td>${f.presente ? 'Presente' : 'Ausente'}</td>
      <td>${f.hora ?? ''}</td>
      <td>${escapar(f.registradoPor ?? '')}</td>
    </tr>`).join('')

    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head>
      <body><table border="1"><thead><tr>
        <th>Estudiante</th><th>Cédula</th><th>Cohorte</th><th>Módulo</th>
        <th>Fecha de la sesión</th><th>Estado</th><th>Hora</th><th>Registrado por</th>
      </tr></thead><tbody>${cuerpo}</tbody></table></body></html>`

    const blob = new Blob(['﻿' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `asistencia_${desde}_a_${hasta}.xls`
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

  const totalPresentes = filas.filter((f) => f.presente).length

  return (
    <div className="space-y-9 px-5 pb-16 pt-14">
      <BotonVolver href="/asistencias" />

      <Encabezado
        sobretitulo="Administración"
        titulo="Asistencia general"
        descripcion="Todo el histórico, filtrable por programa, módulo, cohorte y fechas."
      />

      <Regla delay={60} />

      <div className="grid grid-cols-2 gap-3">
        <Dato valor={totalPresentes} etiqueta="Asistencias registradas" tono="exito" />
        <Dato
          valor={filas.length ? `${Math.round((totalPresentes / filas.length) * 100)}%` : '—'}
          etiqueta="Asistencia del período"
          tono="azul"
        />
      </div>

      {/* ------------------------------ Filtros ------------------------------ */}
      <div className="zr-card space-y-4 p-5">
        <div>
          <label className="mb-2 block text-sm font-semibold text-zr-text">Programa</label>
          <select
            value={programaId}
            onChange={(e) => { setProgramaId(e.target.value); setModuloId(''); setCohorteId('') }}
            className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
          >
            <option value="">Todos los programas</option>
            {programas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-zr-text">Módulo</label>
          <select
            value={moduloId}
            onChange={(e) => setModuloId(e.target.value)}
            className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
          >
            <option value="">Todos los módulos</option>
            {modulosDelPrograma.map((m) => <option key={m.id} value={m.id}>{m.orden}. {m.nombre}</option>)}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-zr-text">Cohorte</label>
          <select
            value={cohorteId}
            onChange={(e) => setCohorteId(e.target.value)}
            className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
          >
            <option value="">Todas las cohortes</option>
            {cohortesDelPrograma.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Desde</label>
            <input
              type="date" value={desde} onChange={(e) => setDesde(e.target.value)}
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-zr-text">Hasta</label>
            <input
              type="date" value={hasta} onChange={(e) => setHasta(e.target.value)}
              className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text focus:border-zr-blue focus:outline-none"
            />
          </div>
        </div>

        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o cédula…"
          className="w-full rounded-lg border border-zr-border bg-zr-bg px-4 py-3.5 text-base text-zr-text placeholder-zr-text-muted focus:border-zr-blue focus:outline-none"
        />

        <button
          onClick={() => setSoloAusentes((v) => !v)}
          className={`min-h-12 w-full rounded-lg border text-sm font-bold transition-colors ${
            soloAusentes ? 'border-zr-error bg-zr-error/12 text-zr-error' : 'border-zr-border text-zr-text-muted'
          }`}
        >
          {soloAusentes ? 'Mostrando solo ausencias' : 'Ver solo ausencias'}
        </button>
      </div>

      {/* ------------------------- % por estudiante -------------------------- */}
      {porcentajes.length > 0 && (
        <section className="space-y-2">
          <p className="text-sm font-bold text-zr-text">Asistencia por estudiante</p>
          <p className="text-xs text-zr-text-muted">
            De menor a mayor. Sirve para ver a quién le toca tutoría según la política de la academia.
          </p>
          <div className="space-y-2 pt-1">
            {porcentajes.slice(0, 10).map((p) => (
              <div key={p.cedula} className="zr-card flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zr-text">{p.nombre}</p>
                  <p className="text-xs tabular-nums text-zr-text-muted">
                    {p.presentes} de {p.total} clases
                  </p>
                </div>
                <Etiqueta tono={p.pct >= 75 ? 'exito' : p.pct >= 50 ? 'aviso' : 'error'}>
                  {p.pct}%
                </Etiqueta>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------ Listado ------------------------------ */}
      {filasVisibles.length > 0 && (
        <button
          onClick={descargarExcel}
          className="w-full rounded-lg border border-zr-border py-3 text-sm font-semibold text-zr-text"
        >
          Descargar lo filtrado (Excel)
        </button>
      )}

      {consultando ? (
        <p className="text-sm text-zr-text-muted">Consultando…</p>
      ) : filasVisibles.length === 0 ? (
        <EstadoVacio
          titulo="Sin registros"
          explicacion="No hay sesiones de clase que coincidan con estos filtros en el rango de fechas elegido."
        />
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-zr-text-muted">{filasVisibles.length} registros</p>
          {filasVisibles.slice(0, 300).map((f) => (
            <div key={f.clave} className="zr-card space-y-1.5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zr-text">{f.estudiante}</p>
                  <p className="text-xs tabular-nums text-zr-text-muted">{f.cedula}</p>
                </div>
                <Etiqueta tono={f.presente ? 'exito' : 'error'}>
                  {f.presente ? `Presente · ${f.hora}` : 'Ausente'}
                </Etiqueta>
              </div>
              <p className="text-xs text-zr-text-muted">
                {f.fecha} · {f.cohorte} · {f.modulo}
              </p>
              {f.presente && (
                <p className="text-xs text-zr-text-muted">
                  Registró: {f.registradoPor ?? '—'}
                  {f.metodo === 'manual' ? ' (a mano)' : ' (escaneo QR)'}
                </p>
              )}
            </div>
          ))}
          {filasVisibles.length > 300 && (
            <p className="pt-1 text-xs text-zr-text-muted">
              Se muestran los primeros 300. Afina los filtros o descarga el Excel para verlos todos.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
