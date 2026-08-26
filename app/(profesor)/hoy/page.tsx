'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Seccion, Regla, Dato } from '@/components/ui/Editorial'

/**
 * Fase 0 (docs/16_FASE0_PLAN_PROFESOR.md, Sprint B): "Tu clase de hoy" con
 * módulo, taller, horario e inscritos (como el HTML de referencia), más
 * "Asistencia en vivo" — llegaron/faltan. El profesor ya NO maneja ningún
 * código QR: eso lo muestra administración. Se quita "Pendiente" (dependía
 * de exámenes, fuera de esta fase).
 */

interface Sesion {
  fecha: string
  modulo: string
  taller: string | null
  horario: string
  esHoy: boolean
}

interface Resumen {
  presentes: number
  inscritos: number
}

export default function Hoy() {
  const [cargando, setCargando] = useState(true)
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [resumen, setResumen] = useState<Resumen>({ presentes: 0, inscritos: 0 })
  const [nombre, setNombre] = useState('')

  useEffect(() => {
    async function cargar() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: perfil } = await supabase
        .from('profiles').select('full_name').eq('id', user.id).single()
      if (perfil) setNombre(perfil.full_name)

      const hoy = new Date().toISOString().split('T')[0]

      const { data: sesiones } = await supabase
        .from('class_sessions')
        .select('id, session_date, cohort_id, cohorts(name, location), modules(name)')
        .eq('teacher_id', user.id)
        .gte('session_date', hoy)
        .order('session_date', { ascending: true })
        .limit(1)

      const s = sesiones?.[0] as unknown as {
        id: string; session_date: string; cohort_id: string
        cohorts: { name: string; location: string | null } | null
        modules: { name: string } | null
      } | undefined

      if (s) {
        // El horario vive dentro del nombre de la cohorte, ej.
        // "Cohorte 2026-A · Sábado 8am" — se toma lo que va después del "·".
        const partes = (s.cohorts?.name ?? '').split('·')
        const horario = partes.length > 1 ? partes[partes.length - 1].trim() : ''

        setSesion({
          fecha: s.session_date,
          modulo: s.modules?.name ?? 'Módulo',
          taller: s.cohorts?.location ?? null,
          horario,
          esHoy: s.session_date === hoy,
        })

        const [{ count: presentes }, { count: inscritos }] = await Promise.all([
          supabase.from('attendance_events').select('id', { count: 'exact', head: true }).eq('session_id', s.id),
          supabase.from('students').select('id', { count: 'exact', head: true }).eq('cohort_id', s.cohort_id),
        ])

        setResumen({ presentes: presentes ?? 0, inscritos: inscritos ?? 0 })
      }

      setCargando(false)
    }

    cargar()
  }, [])

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-zr-text-muted">Preparando la clase…</p>
      </div>
    )
  }

  const fechaLarga = sesion
    ? new Date(sesion.fecha + 'T12:00:00').toLocaleDateString('es-VE', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
    : ''

  return (
    <div className="space-y-11 px-5 pt-14">
      <Encabezado
        sobretitulo="Panel del profesor"
        titulo={nombre || 'Hoy'}
        descripcion="Todo lo que necesitas para el sábado, en una pantalla."
      />

      <Regla delay={80} />

      <Seccion numero={1} titulo={sesion?.esHoy ? 'Tu clase de hoy' : 'Próxima clase'} delay={140}>
        {!sesion ? (
          <div className="zr-card p-10 text-center">
            <p className="text-lg font-semibold text-zr-text">No tienes clases programadas</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-zr-text-muted">
              Cuando administración programe la próxima sesión de tu cohorte, aparecerá aquí.
            </p>
          </div>
        ) : (
          <div className="zr-card overflow-hidden">
            <div className="border-b border-zr-border bg-gradient-to-br from-zr-blue-deep to-zr-blue px-7 py-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">
                {fechaLarga}
              </p>
              <h2 className="zr-display mt-2 text-2xl text-white">{sesion.modulo}</h2>
              <p className="mt-1 text-sm text-white/75">
                {[sesion.taller, sesion.horario, `${resumen.inscritos} inscritos`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>
        )}
      </Seccion>

      {sesion && (
        <Seccion numero={2} titulo="Asistencia en vivo" delay={220}>
          <div className="grid grid-cols-2 gap-3">
            <Dato valor={resumen.presentes} etiqueta="Llegaron" tono="exito" />
            <Dato valor={Math.max(resumen.inscritos - resumen.presentes, 0)} etiqueta="Faltan" tono="medio" />
          </div>
          <p className="text-sm text-zr-text-muted">
            Se registra sola cuando administración muestra el QR y el estudiante lo escanea — tú
            no manejas ningún código.
          </p>
        </Seccion>
      )}
    </div>
  )
}
