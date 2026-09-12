'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { esAdmin, esDireccionAcademica } from '@/lib/auth-helpers'
import { salirDeVistaRecorrido } from '@/lib/vista-recorrido'
import { type ItemBarra } from '@/components/ui/BarraFlotante'
import { Marco } from '@/components/ui/Marco'
import {
  IconoPanel, IconoEstudiantes, IconoPerfil, IconoNotas, IconoPersonal, IconoExamen, IconoDocumento, IconoCalendario, IconoCarnet, IconoProgreso,
} from '@/components/ui/Iconos'
import type { UserRole } from '@/lib/types'

// Fase 0 (docs/15_FASE0_PLAN_ADMIN.md, ajuste): las secciones principales
// del día a día van fijas en la barra — Panel, Asistencia, QR y Perfil.
// Estudiantes se usa menos seguido y queda en el menú ☰.
//
// "Consentimientos" se quitó del todo (pedido del coordinador): el bloqueo
// real por LOPNNA ya se había quitado de la base desde la migración 051 —
// esta pantalla solo quedaba mostrando una cola y un aviso de bloqueo que ya
// no era cierto.
//
// "Material" (pedido explícito del coordinador, sept. 2026): se quita de la
// barra y del menú de administración normal -- queda exclusivo de Dirección
// Académica y super_admin (`NAV_DIRECCION`, más abajo). El propio /material
// además redirige a quien no sea de esos dos roles, por si entra por URL
// directa.
const NAV: ItemBarra[] = [
  { href: '/panel',        label: 'Panel',      Icono: IconoPanel },
  { href: '/asistencias',  label: 'Asistencia', Icono: IconoCalendario },
  { href: '/qr',           label: 'QR',         Icono: IconoCarnet },
  { href: '/perfil-admin', label: 'Perfil',     Icono: IconoPerfil },
]

const MATERIAL: ItemBarra = { href: '/material', label: 'Material', Icono: IconoDocumento }

const NAV_DIRECCION: ItemBarra[] = [NAV[0], NAV[1], NAV[2], MATERIAL, NAV[3]]

// Cohortes y Reportes se retiran del menú (código intacto, se retoman en la
// fase siguiente — mismo criterio que Exámenes/Notas/Progreso en Fase 0
// estudiante).
//
// División de trabajo reafirmada por el coordinador: administración lleva
// estudiantes, asistencia y refrigerios, y valida quién ya firmó su planilla
// en persona; Dirección Académica lleva profesores, material, notas y
// evaluaciones. "Personal" ahora SÍ tiene una entrada de admin normal —
// puede dar de alta y ver otras cuentas de Administración (nada más; ni
// profesores, ni roles, ni sedes de terceros — eso sigue siendo de
// Dirección Académica/super_admin, filtrado dentro de la propia pantalla).
// "Inscribir" (R-17, docs/19_PLAN_CAMBIOS_POST_DIRECTIVA.md): el mismo
// formulario de ventas, como respaldo — admin, Dirección Académica y
// super_admin ya podían llamar a create-student, solo faltaba el enlace.
//
// Cada entrada lleva `grupo` — a pedido explícito del coordinador: once
// botones seguidos sin agrupar en el menú de super_admin "no se explica
// para qué". La hoja ☰ y la barra de escritorio ya saben pintar el
// encabezado de grupo cuando cambia respecto al anterior.
const TODAS: ItemBarra[] = [
  { ...NAV[0], grupo: 'General' },
  { href: '/inscribir',       label: 'Inscribir',       Icono: IconoEstudiantes, grupo: 'Estudiantes' },
  { href: '/estudiantes',     label: 'Estudiantes',     Icono: IconoEstudiantes, grupo: 'Estudiantes' },
  { ...NAV[1], grupo: 'Clase de hoy' },
  { ...NAV[2], grupo: 'Clase de hoy' },
  { href: '/personal',        label: 'Personal',        Icono: IconoPersonal,    grupo: 'Administración' },
  { ...NAV[3], grupo: 'Cuenta' },
]

// Dirección Académica: profesores, notas de cualquier cohorte, exámenes,
// Material (exclusivo de estos dos roles y super_admin) — pero no
// Configuración (exclusiva de super_admin).
const TODAS_DIRECCION: ItemBarra[] = [
  TODAS[0], TODAS[1], TODAS[2],
  { ...MATERIAL, grupo: 'Clase de hoy' },
  TODAS[3], TODAS[4],
  { href: '/personal',             label: 'Personal',     Icono: IconoPersonal, grupo: 'Dirección académica' },
  { href: '/cobertura-modulos',    label: 'Cobertura',    Icono: IconoProgreso, grupo: 'Dirección académica' },
  { href: '/notas-academicas',     label: 'Notas',        Icono: IconoNotas,    grupo: 'Dirección académica' },
  { href: '/examenes-academicos',  label: 'Exámenes',     Icono: IconoExamen,   grupo: 'Dirección académica' },
  // Resúmenes de "Mi módulo" (estático, a pedido explícito) — is_academico()
  // ya deja escribir 'modules' a dirección académica y super_admin por igual.
  { href: '/modulos',              label: 'Módulos',      Icono: IconoProgreso, grupo: 'Dirección académica' },
  TODAS[TODAS.length - 1],
]

const TODAS_SUPER: ItemBarra[] = [
  TODAS[0], TODAS[1], TODAS[2],
  { ...MATERIAL, grupo: 'Clase de hoy' },
  TODAS[3], TODAS[4],
  { href: '/personal',             label: 'Personal',      Icono: IconoPersonal, grupo: 'Dirección académica' },
  { href: '/cobertura-modulos',    label: 'Cobertura',     Icono: IconoProgreso, grupo: 'Dirección académica' },
  { href: '/notas-academicas',     label: 'Notas',         Icono: IconoNotas,    grupo: 'Dirección académica' },
  { href: '/examenes-academicos',  label: 'Exámenes',      Icono: IconoExamen,   grupo: 'Dirección académica' },
  { href: '/modulos',              label: 'Módulos',       Icono: IconoProgreso, grupo: 'Dirección académica' },
  // R-20/R-21: crear programas y sedes es exclusivo de super_admin
  // (migración 066) — el enlace solo aparece en este menú.
  { href: '/catalogo',             label: 'Catálogo',      Icono: IconoDocumento, grupo: 'Solo super admin' },
  { href: '/configuracion',        label: 'Configuración', Icono: IconoPanel,     grupo: 'Solo super admin' },
  TODAS[TODAS.length - 1],
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [verificando, setVerificando] = useState(true)
  const [rol, setRol] = useState<UserRole | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function verificarRol() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }

      const { data: perfil } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()

      if (!esAdmin(perfil?.role as UserRole | undefined)) {
        router.replace('/')
        return
      }

      // Llegar aquí (a su propia área real, no de recorrido) significa que
      // ya no está "viendo como" nadie más — se apaga la cookie por si
      // había quedado prendida de una vista de recorrido anterior sin
      // haber tocado "Salir a mi panel" (p. ej. navegó para atrás en vez de
      // usar el botón). Sin esto, la próxima vez que abriera la app podía
      // volver a caer en esa vista vieja en vez de en su panel real.
      salirDeVistaRecorrido()

      setRol((perfil?.role as UserRole) ?? null)
      setVerificando(false)
    }

    verificarRol()
  }, [router])

  if (verificando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-zr-bg">
        <p className="text-sm text-zr-text-muted">Verificando acceso…</p>
      </div>
    )
  }

  const secciones = rol === 'super_admin' ? TODAS_SUPER : esDireccionAcademica(rol) ? TODAS_DIRECCION : TODAS

  return (
    <Marco
      items={esDireccionAcademica(rol) ? NAV_DIRECCION : NAV}
      todasLasSecciones={secciones}
      // Bug real de producción (sept. 2026): `deslizable` viene en `true`
      // por defecto (pensado para la barra del estudiante, donde deslizar
      // cambia de sección). Nadie lo apagó aquí, así que cualquier gesto
      // horizontal en una pantalla de administración -- por ejemplo deslizar
      // la fila de programas (PTMA/PFTA) en Asistencia -- se interpretaba
      // como "cambiar de sección" y mandaba a otra pantalla sin que nadie lo
      // pidiera. El personal nunca pidió deslizar para navegar; se apaga.
      deslizable={false}
      imprimible
    >
      {children}
    </Marco>
  )
}
