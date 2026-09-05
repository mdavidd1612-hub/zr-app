'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Seccion, Regla, Dato } from '@/components/ui/Editorial'
import { IconoEstudiantes, IconoNotas, IconoPanel, IconoPersonal, IconoExamen, IconoDocumento, IconoCalendario, IconoCarnet } from '@/components/ui/Iconos'
import { esDireccionAcademica } from '@/lib/auth-helpers'
import { leerSimulacionSabado } from '@/lib/demo-sabado'
import { activarVistaRecorrido, type VistaRecorrido } from '@/lib/vista-recorrido'
import type { UserRole } from '@/lib/types'

interface SesionHoy {
  sessionId: string
  cohorteNombre: string
  registrados: number
  total: number
}

// Fase 0 (docs/15_FASE0_PLAN_ADMIN.md, Sprint A): Cohortes y Reportes se
// retiran de los accesos (código intacto, se retoman después).
const ACCESOS = [
  { href: '/estudiantes',     titulo: 'Estudiantes',      sub: 'Ver y gestionar registros',  Icono: IconoEstudiantes },
  { href: '/material',        titulo: 'Material',         sub: 'Subir por programa',          Icono: IconoDocumento },
  { href: '/asistencias',     titulo: 'Asistencia',       sub: 'Por programa, en vivo',        Icono: IconoCalendario },
  { href: '/qr',              titulo: 'QR de asistencia', sub: 'Mostrar en pantalla',          Icono: IconoCarnet },
]

// Exclusivo de Dirección Académica y super_admin: profesores, notas y
// evaluaciones de CUALQUIER cohorte (no solo la propia).
//
// "Solicitudes de profesor" (auto-registro + aprobación) se quitó: la única
// vía real para que exista personal es /personal (dado de alta directo por
// Dirección Académica/super_admin) — ese flujo de solicitud nunca se llegó
// a construir del lado del estudiante y quedaba como un enlace muerto.
const ACCESOS_DIRECCION = [
  { href: '/personal',             titulo: 'Personal',                sub: 'Profesores y administradores',      Icono: IconoPersonal },
  { href: '/notas-academicas',     titulo: 'Notas',                   sub: 'Calificaciones de cualquier programa', Icono: IconoNotas },
  { href: '/examenes-academicos',  titulo: 'Exámenes',                sub: 'Supervisar evaluaciones',           Icono: IconoExamen },
]

const ACCESO_CONFIG = { href: '/configuracion', titulo: 'Configuración', sub: 'Umbrales y reglas de negocio', Icono: IconoPanel }

// A pedido explícito del coordinador: entrar a recorrer la app como la ve
// cada rol, sin crear cuentas de prueba aparte. Quién ve cuál (reafirmado en
// audio posterior): administración → estudiante y ventas; dirección
// académica → estudiante y profesor; super_admin → las tres. No hay "vista
// de admin": super_admin ya ve ese mismo menú (y más) con su propia cuenta.
//
// `vista` es la cookie que activarVistaRecorrido() prende antes de navegar
// (lib/vista-recorrido.ts) — bug reportado por el coordinador: sin ella,
// proxy.ts no podía distinguir "elegí ver como estudiante" de "abrí la PWA
// de cero" (su start_url es "/", la misma ruta), así que administración
// siempre terminaba entrando derecho a la vista de estudiante en vez de a
// su panel.
const ACCESO_VENTAS =     { href: '/carga-ventas', titulo: 'Vista de Ventas',      sub: 'Recorrer la app como la ve un vendedor',   Icono: IconoEstudiantes, vista: 'vendedor' as VistaRecorrido }
const ACCESO_ESTUDIANTE = { href: '/',             titulo: 'Vista de Estudiante',  sub: 'Recorrer la app como la ve un estudiante', Icono: IconoCarnet,      vista: 'estudiante' as VistaRecorrido }
const ACCESO_PROFESOR =   { href: '/hoy',          titulo: 'Vista de Profesor',    sub: 'Recorrer la app como la ve un profesor',   Icono: IconoNotas,       vista: 'profesor' as VistaRecorrido }

export default function Panel() {
  const router = useRouter()
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
            cohorteNombre: s.cohorts?.name ?? 'Programa',
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

  if (cargando) {
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
        <h1 className="zr-display mt-3 text-4xl text-zr-text">Panel de administración</h1>
        <p className="mt-3 text-base text-zr-text-muted">Academia ZR Mecademy</p>
      </header>

      <Regla delay={60} />

      {/* Numeración de secciones: algunas son condicionales (sábado, dirección
          académica, super_admin), así que se cuenta en orden en vez de fijar
          números — evitaba que "Vista de recorrido" quedara con un número
          repetido o salteado según el rol. */}
      {(() => {
        let n = 0
        const nHoy = esSabado ? ++n : 0
        const nEstudiantes = ++n
        const nDireccion = esDireccionAcademica(rol) ? ++n : 0
        const nSuper = rol === 'super_admin' ? ++n : 0
        const nRecorrido = ++n
        return (
          <>
            {esSabado && (
              <Seccion numero={nHoy} titulo={`Hoy, sábado ${hoy.getDate()}`} delay={120}>
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

            {/* Agrupado por qué resuelve cada cosa, no una sola lista de once
                botones seguidos — a pedido explícito del coordinador ("no se
                explica para qué"). */}
            <GrupoAccesos numero={nEstudiantes} titulo="Estudiantes" accesos={ACCESOS} delay={200} />

            {esDireccionAcademica(rol) && (
              <GrupoAccesos numero={nDireccion} titulo="Dirección académica" accesos={ACCESOS_DIRECCION} delay={240} />
            )}

            {rol === 'super_admin' && (
              <GrupoAccesos numero={nSuper} titulo="Solo super admin" accesos={[ACCESO_CONFIG]} delay={280} />
            )}

            {/* Vista de recorrido: quién ve cuál, reafirmado explícitamente
                por el coordinador — admin: estudiante y ventas; dirección
                académica: estudiante y profesor; super_admin: las tres. */}
            {rol && (
              <GrupoAccesos
                numero={nRecorrido}
                titulo="Vista de recorrido"
                descripcion="Recorre la app como la ve cada rol, sin crear cuentas de prueba — sigues siendo tú."
                accesos={[
                  ACCESO_ESTUDIANTE,
                  ...(rol === 'admin' || rol === 'super_admin' ? [ACCESO_VENTAS] : []),
                  ...(rol === 'direccion_academica' || rol === 'super_admin' ? [ACCESO_PROFESOR] : []),
                ]}
                delay={320}
              />
            )}
          </>
        )
      })()}
    </div>
  )
}

interface Acceso {
  href: string
  titulo: string
  sub: string
  Icono: (p: { size?: number }) => React.ReactElement
  vista?: VistaRecorrido
}

function GrupoAccesos({
  numero, titulo, descripcion, accesos, delay,
}: {
  numero: number; titulo: string; descripcion?: string; accesos: Acceso[]; delay: number
}) {
  const router = useRouter()
  return (
    <Seccion numero={numero} titulo={titulo} delay={delay}>
      {descripcion && <p className="text-sm text-zr-text-muted">{descripcion}</p>}
      <div className="space-y-3">
        {accesos.map((a) => (
          <button
            key={a.href}
            onClick={() => {
              if (a.vista) activarVistaRecorrido(a.vista)
              router.push(a.href)
            }}
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
  )
}
