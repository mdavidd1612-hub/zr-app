'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Tarjeta } from '@/components/ui/Tarjeta'
import { Cargando } from '@/components/ui/Cargando'

interface Estadisticas {
  totalEstudiantes: number
  estudiantesActivos: number
  consentimientosPendientes: number
  cohortes: number
  modulosAprobados: number
}

export default function Panel() {
  const [stats, setStats] = useState<Estadisticas | null>(null)
  const [cargando, setCargando] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    async function cargar() {
      try {
        // Total estudiantes
        const { count: totalEst } = await supabase
          .from('profiles')
          .select('id', { count: 'exact' })
          .eq('role', 'estudiante')

        // Estudiantes activos (onboarding_status = 'completo')
        const { count: activos } = await supabase
          .from('students')
          .select('id', { count: 'exact' })
          .eq('onboarding_status', 'completo')

        // Consentimientos pendientes
        const { count: pendientes } = await supabase
          .from('students')
          .select('id', { count: 'exact' })
          .eq('onboarding_status', 'en_curso')

        // Cohortes
        const { count: numCohortes } = await supabase
          .from('cohorts')
          .select('id', { count: 'exact' })

        // Módulos aprobados
        const { count: aprobados } = await supabase
          .from('module_enrollments')
          .select('id', { count: 'exact' })
          .eq('status', 'aprobado')

        setStats({
          totalEstudiantes: totalEst || 0,
          estudiantesActivos: activos || 0,
          consentimientosPendientes: pendientes || 0,
          cohortes: numCohortes || 0,
          modulosAprobados: aprobados || 0,
        })
      } catch (err) {
        console.error('Error cargando estadísticas:', err)
      } finally {
        setCargando(false)
      }
    }

    cargar()
  }, [supabase])

  if (cargando) return <Cargando texto="Cargando panel..." />

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-zr-blue to-zr-blue-deep bg-clip-text text-transparent">Panel administrativo</h1>
        <p className="text-base text-zr-text-muted mt-2">Gestión de la Academia ZR Mecademy</p>
      </header>

      {/* Estadísticas */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard titulo="Estudiantes" valor={stats.totalEstudiantes} color="blue" />
          <StatCard titulo="Activos" valor={stats.estudiantesActivos} color="green" />
          <StatCard
            titulo="Pendientes"
            valor={stats.consentimientosPendientes}
            color={stats.consentimientosPendientes > 0 ? 'warning' : 'blue'}
          />
          <StatCard titulo="Cohortes" valor={stats.cohortes} color="blue" />
          <StatCard titulo="Módulos aprobados" valor={stats.modulosAprobados} color="blue" />
        </div>
      )}

      {/* Acciones rápidas */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/estudiantes">
          <Tarjeta>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-zr-navy">👥 Estudiantes</h3>
              <p className="text-sm text-zr-text-muted">Ver, agregar, gestionar registros</p>
            </div>
          </Tarjeta>
        </Link>

        <Link href="/consentimientos">
          <Tarjeta
            tono={stats && stats.consentimientosPendientes > 0 ? 'informativa' : undefined}
          >
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-zr-navy">
                ✅ Consentimientos {stats?.consentimientosPendientes ? `(${stats.consentimientosPendientes})` : ''}
              </h3>
              <p className="text-sm text-zr-text-muted">Revisar y aprobar permisos de representantes</p>
            </div>
          </Tarjeta>
        </Link>

        <Link href="/cohortes">
          <Tarjeta>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-zr-navy">👨‍🎓 Cohortes</h3>
              <p className="text-sm text-zr-text-muted">Gestionar grupos y módulos</p>
            </div>
          </Tarjeta>
        </Link>

        <Link href="/reportes">
          <Tarjeta>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-zr-navy">📈 Reportes</h3>
              <p className="text-sm text-zr-text-muted">Asistencia, notas, progreso</p>
            </div>
          </Tarjeta>
        </Link>
      </div>
    </div>
  )
}

function StatCard({
  titulo,
  valor,
  color = 'blue',
}: {
  titulo: string
  valor: number
  color?: 'blue' | 'green' | 'warning'
}) {
  const colorClass = {
    blue: 'border-zr-blue text-zr-navy',
    green: 'border-zr-success text-zr-success',
    warning: 'border-zr-warning text-zr-warning',
  }[color]

  return (
    <div className={`glass rounded-zr border-l-4 p-4 text-center ${colorClass}`}>
      <p className="text-sm font-medium opacity-90">{titulo}</p>
      <p className="text-3xl font-bold mt-2">{valor}</p>
    </div>
  )
}
