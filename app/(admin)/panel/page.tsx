'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla, Dato } from '@/components/ui/Editorial'
import { IconoEstudiantes, IconoCandado, IconoNotas, IconoPanel, IconoPersonal, IconoCheck, IconoExamen, IconoDocumento, IconoCalendario, IconoCarnet } from '@/components/ui/Iconos'
import { esDireccionAcademica } from '@/lib/auth-helpers'
import { leerSimulacionSabado } from '@/lib/demo-sabado'
import type { UserRole } from '@/lib/types'

interface Estadisticas {
  consentimientosPendientes: number
}

interface SesionHoy {
  sessionId: string
  cohorteNombre: string
  registrados: number
  total: number
}

// Fase 0 (docs/15_FASE0_PLAN_ADMIN.md, Sprint A): Cohortes y Reportes se
// retiran de los accesos (código intacto, se retoman después). Consentimientos
// queda como el único acceso directo a esa pantalla — ya no está en la barra.
const ACCESOS = [
  { href: '/consentimientos', titulo: 'Consentimientos', sub: 'Revisar permisos pendientes', Icono: IconoCandado },
  { href: '/estudiantes',     titulo: 'Estudiantes',      sub: 'Ver y gestionar registros',  Icono: IconoEstudiantes },
  { href: '/material',        titulo: 'Material',         sub: 'Subir por cohorte',          Icono: IconoDocumento },
  { href: '/asistencias',     titulo: 'Asistencia',       sub: 'Por cohorte, en vivo',        Icono: IconoCalendario },
  { href: '/qr',              titulo: 'QR de asistencia', sub: 'Mostrar en pantalla',          Icono: IconoCarnet },
]

// Exclusivo de Dirección Académica y super_admin: profesores, notas y
// evaluaciones de CUALQUIER cohorte (no solo la propia).
const ACCESOS_DIRECCION = [
  { href: '/personal',             titulo: 'Personal',                sub: 'Profesores y administradores',      Icono: IconoPersonal },
  { href: '/solicitudes-profesor', titulo: 'Solicitudes de profesor', sub: 'Aprobar o rechazar personal nuevo', Icono: IconoCheck },
  { href: '/notas-academicas',     titulo: 'Notas',                   sub: 'Calificaciones de cualquier cohorte', Icono: IconoNotas },
  { href: '/examenes-academicos',  titulo: 'Exámenes',                sub: 'Supervisar evaluaciones',           Icono: IconoExamen },
]

const ACCESO_CONFIG = { href: '/configuracion', titulo: 'Configuración', sub: 'Umbrales y reglas de negocio', Icono: IconoPanel }

export default function Panel() {
  const router = useRouter()
  const [stats, setStats] = useState<Estadisticas | null>(null)
  const [rol, setRol] = useState<UserRole | null>(null)
  const [sesionesHoy, setSesionesHoy] = useState<SesionHoy[]>([])
  const [cargando, setCargando] = useState(true)
  // PRUEBA TEMPORAL: interruptor de simulación de sábado, controlado desde
  // Perfil (docs/15_FASE0_PLAN_ADMIN.md). Ojo: la fecha que se usa para
  // BUSCAR las sesiones de hoy sigue siendo la real.
  const [simulado, setSimulado] = useState(false)

  const hoy = new Date()
  const esSabado = simulado || hoy.getDay() === 6
  const hoyISO = hoy.toISOString().slice(0, 10)

  useEffect(() => {
    const supabase = createClient()

    async function cargar() {
      setSimulado(leerSimulacionSabado())

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setRol((perfil?.role as UserRole) ?? null)

      // v_students_blocked ya filtra por "menor de edad Y (sin consentimiento
      // O sin verificar)". Contar por onboarding_status daría un número que
      // no corresponde a lo que /consentimientos realmente muestra.
      const { count: pendientes } = await supabase
        .from('v_students_blocked').select('id', { count: 'exact', head: true })

      setStats({ consentimientosPendientes: pendientes ?? 0 })

      // Fase 0 (docs/15_FASE0_PLAN_ADMIN.md, Sprint D): el sábado, calendario
      // de las sesiones de hoy, una tarjeta por cohorte, con registrados
      // (attendance_events de esa sesión) y faltan (estudiantes de la
      // cohorte que todavía no aparecen ahí).
      const { data: sesiones } = await supabase
        .from('class_sessions')
        .select('id, cohort_id, cohorts(name)')
        .eq('session_date', hoyISO)

      const filasSesion = (sesiones ?? []) as unknown as {
        id: string; cohort_id: string; cohorts: { name: string } | null
      }[]

      const conteos = await Promise.all(
        filasSesion.map(async (s) => {
          const [{ count: registrados }, { count: total }] = await Promise.all([
            supabase.from('attendance_events').select('id', { count: 'exact', head: true }).eq('session_id', s.id),
            supabase.from('students').select('id', { count: 'exact', head: true }).eq('cohort_id', s.cohort_id),
          ])
          return {
            sessionId: s.id,
            cohorteNombre: s.cohorts?.name ?? 'Cohorte',
            registrados: registrados ?? 0,
            total: total ?? 0,
          }
        }),
      )

      setSesionesHoy(conteos.sort((a, b) => a.cohorteNombre.localeCompare(b.cohorteNombre)))
      setCargando(false)
    }

    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      {esSabado && (
        <Seccion numero={1} titulo={`Hoy, sábado ${hoy.getDate()}`} delay={120}>
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
          {sesionesHoy.length === 0 ? (
            <div className="zr-card p-6">
              <p className="text-sm text-zr-text-muted">No hay sesiones de clase programadas para hoy.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sesionesHoy.map((s) => (
                <div key={s.sessionId} className="zr-card p-5">
                  <p className="text-sm font-semibold text-zr-blue-mid">{s.cohorteNombre}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Dato valor={s.registrados} etiqueta="Registrados" tono="exito" />
                    <Dato valor={Math.max(s.total - s.registrados, 0)} etiqueta="Faltan" tono="neutro" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Seccion>
      )}

      <Seccion numero={esSabado ? 2 : 1} titulo="Accesos" delay={200}>
        <div className="space-y-3">
          {(
            esDireccionAcademica(rol)
              ? rol === 'super_admin'
                ? [...ACCESOS, ...ACCESOS_DIRECCION, ACCESO_CONFIG]
                : [...ACCESOS, ...ACCESOS_DIRECCION]
              : ACCESOS
          ).map((a) => (
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
