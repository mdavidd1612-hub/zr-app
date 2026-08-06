'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla, Dato } from '@/components/ui/Editorial'
import { IconoEstudiantes, IconoCandado, IconoCalendario, IconoNotas } from '@/components/ui/Iconos'

interface Estadisticas {
  totalEstudiantes: number
  estudiantesActivos: number
  consentimientosPendientes: number
  cohortes: number
  modulosAprobados: number
}

const ACCESOS = [
  { href: '/consentimientos', titulo: 'Consentimientos', sub: 'Revisar permisos pendientes', Icono: IconoCandado },
  { href: '/cohortes',        titulo: 'Cohortes',         sub: 'Grupos y módulos',           Icono: IconoCalendario },
  { href: '/estudiantes',     titulo: 'Estudiantes',      sub: 'Ver y gestionar registros',  Icono: IconoEstudiantes },
  { href: '/reportes',        titulo: 'Reportes',         sub: 'Asistencia, notas, uso',      Icono: IconoNotas },
]

export default function Panel() {
  const router = useRouter()
  const [stats, setStats] = useState<Estadisticas | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const [
        { count: totalEst },
        { count: activos },
        { count: pendientes },
        { count: numCohortes },
        { count: aprobados },
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'estudiante'),
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('onboarding_status', 'completo'),
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('onboarding_status', 'en_curso'),
        supabase.from('cohorts').select('id', { count: 'exact', head: true }),
        supabase.from('module_enrollments').select('id', { count: 'exact', head: true }).eq('status', 'aprobado'),
      ])

      setStats({
        totalEstudiantes: totalEst ?? 0,
        estudiantesActivos: activos ?? 0,
        consentimientosPendientes: pendientes ?? 0,
        cohortes: numCohortes ?? 0,
        modulosAprobados: aprobados ?? 0,
      })
      setCargando(false)
    }

    cargar()
  }, [router])

  if (cargando || !stats) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Cargando panel…</p>
      </div>
    )
  }

  return (
    <div className="space-y-11 px-5 pt-14">
      <header className="animate-rise">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zr-blue-mid">
          Administración
        </p>
        <h1 className="zr-display mt-3 text-4xl text-zr-text">Panel</h1>
        <p className="mt-3 text-base text-zr-text-muted">Academia ZR Mecademy</p>
      </header>

      <Regla delay={60} />

      <Seccion numero={1} titulo="Estudiantes" delay={120}>
        <div className="grid grid-cols-2 gap-3">
          <Dato valor={stats.totalEstudiantes} etiqueta="Registrados" tono="azul" />
          <Dato valor={stats.estudiantesActivos} etiqueta="Activos" tono="exito" />
        </div>
        {stats.consentimientosPendientes > 0 && (
          <button
            onClick={() => router.push('/consentimientos')}
            className="zr-card w-full border-zr-warning/30 bg-zr-warning/8 p-5 text-left"
          >
            <p className="text-base font-semibold text-zr-text">
              {stats.consentimientosPendientes} consentimiento
              {stats.consentimientosPendientes === 1 ? '' : 's'} pendiente
              {stats.consentimientosPendientes === 1 ? '' : 's'}
            </p>
            <p className="mt-1 text-sm text-zr-text-muted">Toca para revisarlos</p>
          </button>
        )}
      </Seccion>

      <Seccion numero={2} titulo="Académico" delay={200}>
        <div className="grid grid-cols-2 gap-3">
          <Dato valor={stats.cohortes} etiqueta="Cohortes activas" tono="medio" />
          <Dato valor={stats.modulosAprobados} etiqueta="Módulos aprobados" tono="exito" />
        </div>
      </Seccion>

      <Seccion numero={3} titulo="Accesos" delay={280}>
        <div className="space-y-3">
          {ACCESOS.map((a) => (
            <button
              key={a.href}
              onClick={() => router.push(a.href)}
              className="zr-card zr-card-interactive flex w-full items-center gap-4 p-5 text-left"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zr-border text-zr-blue">
                <a.Icono size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-zr-text">{a.titulo}</p>
                <p className="mt-0.5 text-sm text-zr-text-muted">{a.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </Seccion>
    </div>
  )
}
