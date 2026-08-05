'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Encabezado, Seccion, Regla, Dato, Etiqueta } from '@/components/ui/Editorial'

interface Sesion {
  id: string
  fecha: string
  cohorte: string
  modulo: string
  semana: number
  estado: string
  esHoy: boolean
}

interface Resumen {
  presentes: number
  inscritos: number
  refrigerios: number
  porCalificar: number
}

export default function Hoy() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [sesion, setSesion] = useState<Sesion | null>(null)
  const [resumen, setResumen] = useState<Resumen>({ presentes: 0, inscritos: 0, refrigerios: 0, porCalificar: 0 })
  const [nombre, setNombre] = useState('')

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: perfil } = await supabase
        .from('profiles').select('full_name').eq('id', user.id).single()
      if (perfil) setNombre(perfil.full_name)

      const hoy = new Date().toISOString().split('T')[0]

      // La sesión de hoy si existe; si no, la próxima. El profesor abre esta
      // pantalla el sábado a las 7:50 am y también el miércoles para preparar.
      const { data: sesiones } = await supabase
        .from('class_sessions')
        .select('id, session_date, week_number, status, cohort_id, cohorts(name), modules(name)')
        .eq('teacher_id', user.id)
        .gte('session_date', hoy)
        .order('session_date', { ascending: true })
        .limit(1)

      const s = sesiones?.[0] as unknown as {
        id: string; session_date: string; week_number: number; status: string
        cohort_id: string; cohorts: { name: string } | null; modules: { name: string } | null
      } | undefined

      if (s) {
        setSesion({
          id: s.id,
          fecha: s.session_date,
          cohorte: s.cohorts?.name ?? 'Cohorte',
          modulo: s.modules?.name ?? 'Módulo',
          semana: s.week_number,
          estado: s.status,
          esHoy: s.session_date === hoy,
        })

        const [{ count: presentes }, { count: inscritos }, { count: refrigerios }] = await Promise.all([
          supabase.from('attendance_events').select('id', { count: 'exact', head: true }).eq('session_id', s.id),
          supabase.from('students').select('id', { count: 'exact', head: true }).eq('cohort_id', s.cohort_id),
          supabase.from('attendance_events').select('id', { count: 'exact', head: true })
            .eq('session_id', s.id).not('snack_claimed_at', 'is', null),
        ])

        setResumen((r) => ({
          ...r,
          presentes: presentes ?? 0,
          inscritos: inscritos ?? 0,
          refrigerios: refrigerios ?? 0,
        }))
      }

      // Redacciones esperando calificación. Es el número que decide si el
      // profesor tiene trabajo pendiente o puede cerrar el portátil.
      const { count: porCalificar } = await supabase
        .from('exam_answers')
        .select('id', { count: 'exact', head: true })
        .is('awarded_points', null)

      setResumen((r) => ({ ...r, porCalificar: porCalificar ?? 0 }))
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
    <div className="mx-auto max-w-4xl space-y-12 px-6 py-12 lg:px-10 lg:py-16">
      <Encabezado
        sobretitulo="Panel del profesor"
        titulo={nombre || 'Hoy'}
        descripcion="Todo lo que necesitas para el sábado, en una pantalla."
      />

      <Regla delay={80} />

      {/* 01 — LA CLASE */}
      <Seccion numero={1} titulo={sesion?.esHoy ? 'Clase de hoy' : 'Próxima clase'} delay={140}>
        {!sesion ? (
          <div className="zr-card p-10 text-center">
            <p className="text-lg font-semibold text-zr-text">No tienes clases programadas</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-zr-text-muted">
              Cuando administración programe la próxima sesión de tu cohorte, aparecerá aquí con
              el botón para pasar asistencia.
            </p>
          </div>
        ) : (
          <div className="zr-card overflow-hidden">
            <div className="border-b border-zr-border bg-gradient-to-br from-zr-blue-deep to-zr-blue px-7 py-8">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">
                    {fechaLarga}
                  </p>
                  <h2 className="zr-display mt-2 text-2xl text-white">{sesion.cohorte}</h2>
                  <p className="mt-1 text-sm text-white/75">
                    Semana {sesion.semana} · {sesion.modulo}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
                  {sesion.estado}
                </span>
              </div>
            </div>

            <div className="space-y-3 p-7">
              <button
                onClick={() => router.push(`/escanear/${sesion.id}`)}
                className="w-full rounded-lg bg-zr-blue px-6 py-4 text-base font-bold text-white transition-all hover:bg-zr-blue-deep hover:shadow-lg hover:shadow-zr-blue/25"
              >
                Abrir clase y pasar asistencia
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => router.push('/sesiones')}
                  className="rounded-lg border border-zr-border px-4 py-3.5 text-sm font-semibold text-zr-text transition-colors hover:border-zr-blue/45"
                >
                  Mis sesiones
                </button>
                <button
                  onClick={() => router.push('/crear-examen')}
                  className="rounded-lg border border-zr-border px-4 py-3.5 text-sm font-semibold text-zr-text transition-colors hover:border-zr-blue/45"
                >
                  Exámenes
                </button>
              </div>
            </div>
          </div>
        )}
      </Seccion>

      {/* 02 — ASISTENCIA */}
      {sesion && (
        <Seccion numero={2} titulo="Asistencia" delay={220}>
          <div className="grid grid-cols-3 gap-3">
            <Dato valor={resumen.presentes} etiqueta="Presentes" tono="exito" />
            <Dato valor={Math.max(resumen.inscritos - resumen.presentes, 0)} etiqueta="Faltan" tono="medio" />
            <Dato valor={resumen.refrigerios} etiqueta="Refrigerios" tono="azul" />
          </div>
          <p className="text-sm text-zr-text-muted">
            {resumen.inscritos} estudiantes inscritos en esta cohorte. La asistencia no reprueba a
            nadie: es para saber quién necesita ponerse al día.
          </p>
        </Seccion>
      )}

      {/* 03 — PENDIENTE */}
      <Seccion numero={sesion ? 3 : 2} titulo="Pendiente" delay={300}>
        <button
          onClick={() => router.push('/calificar')}
          className="zr-card zr-card-interactive flex w-full items-center justify-between gap-4 p-6 text-left"
        >
          <div className="min-w-0">
            <p className="text-base font-semibold text-zr-text">Redacciones por calificar</p>
            <p className="mt-1 text-sm text-zr-text-muted">
              {resumen.porCalificar === 0
                ? 'Nada esperando. Las objetivas se calificaron solas.'
                : 'Las objetivas ya se calificaron solas. Estas necesitan tu criterio.'}
            </p>
          </div>
          <Etiqueta tono={resumen.porCalificar > 0 ? 'aviso' : 'exito'}>
            {resumen.porCalificar > 0 ? `${resumen.porCalificar} pendientes` : 'Al día'}
          </Etiqueta>
        </button>
      </Seccion>
    </div>
  )
}
