'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Regla, Etiqueta } from '@/components/ui/Editorial'
import { BotonVolver } from '@/components/ui/BotonVolver'
import { EstadoVacio } from '@/components/ui/EstadoVacio'

/**
 * Fase 0 (docs/15_FASE0_PLAN_ADMIN.md, Sprint E): asistencia de hoy,
 * filtrada por cohorte — quién ya se registró y quién falta, cohorte por
 * cohorte. Guiado por el HTML de referencia del equipo.
 */

interface Cohorte {
  id: string
  nombre: string
}

interface Fila {
  id: string
  nombre: string
  cedula: string
  presente: boolean
  hora: string | null
}

export default function Asistencias() {
  const router = useRouter()
  const [cohortes, setCohortes] = useState<Cohorte[]>([])
  const [cohorteId, setCohorteId] = useState('')
  const [filas, setFilas] = useState<Fila[]>([])
  const [cargando, setCargando] = useState(true)
  const [cargandoLista, setCargandoLista] = useState(false)

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

  useEffect(() => {
    if (!cohorteId) return

    async function cargarLista() {
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
          .select('id, profiles(full_name, cedula)')
          .eq('cohort_id', cohorteId),
      ])

      const alumnos = (estudiantes ?? []) as unknown as {
        id: string; profiles: { full_name: string; cedula: string } | null
      }[]

      if (!sesion) {
        setFilas(
          alumnos.map((a) => ({
            id: a.id, nombre: a.profiles?.full_name ?? '', cedula: a.profiles?.cedula ?? '',
            presente: false, hora: null,
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
            presente: porEstudiante.has(a.id),
            hora: porEstudiante.get(a.id)
              ? new Date(porEstudiante.get(a.id)!).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
              : null,
          }))
          .sort((x, y) => Number(y.presente) - Number(x.presente) || x.nombre.localeCompare(y.nombre)),
      )
      setCargandoLista(false)
    }

    cargarLista()
  }, [cohorteId, hoyISO])

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando…</p>
      </div>
    )
  }

  const presentesCount = filas.filter((f) => f.presente).length

  return (
    <div className="space-y-11 px-5 pt-14">
      <BotonVolver href="/panel" />

      <Encabezado
        sobretitulo="Administración"
        titulo="Asistencia"
        descripcion={`Hoy · ${presentesCount}/${filas.length} registrados`}
      />

      <Regla delay={60} />

      {cohortes.length === 0 ? (
        <EstadoVacio titulo="Sin cohortes" explicacion="Todavía no hay cohortes creadas." />
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
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

          {cargandoLista ? (
            <p className="text-sm text-zr-text-muted">Cargando…</p>
          ) : filas.length === 0 ? (
            <EstadoVacio titulo="Sin estudiantes" explicacion="Esta cohorte todavía no tiene estudiantes." />
          ) : (
            <div className="space-y-2">
              {filas.map((f) => (
                <div key={f.id} className="zr-card flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zr-text">{f.nombre}</p>
                    <p className="text-xs tabular-nums text-zr-text-muted">{f.cedula}</p>
                  </div>
                  <Etiqueta tono={f.presente ? 'exito' : 'neutro'}>
                    {f.presente ? `Presente · ${f.hora}` : 'Falta'}
                  </Etiqueta>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
