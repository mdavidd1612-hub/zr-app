'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { esAdmin, esDireccionAcademica } from '@/lib/auth-helpers'
import { type ItemBarra } from '@/components/ui/BarraFlotante'
import { Marco } from '@/components/ui/Marco'
import {
  IconoPanel, IconoEstudiantes, IconoPerfil, IconoNotas, IconoPersonal, IconoExamen, IconoDocumento, IconoCalendario, IconoCarnet, IconoProgreso,
} from '@/components/ui/Iconos'
import type { UserRole } from '@/lib/types'

// Fase 0 (docs/15_FASE0_PLAN_ADMIN.md, ajuste): las 5 secciones principales
// del día a día van fijas en la barra — Panel, Asistencia, QR, Material y
// Perfil. Estudiantes se usa menos seguido y queda en el menú ☰.
//
// "Consentimientos" se quitó del todo (pedido del coordinador): el bloqueo
// real por LOPNNA ya se había quitado de la base desde la migración 051 —
// esta pantalla solo quedaba mostrando una cola y un aviso de bloqueo que ya
// no era cierto.
const NAV: ItemBarra[] = [
  { href: '/panel',        label: 'Panel',      Icono: IconoPanel },
  { href: '/asistencias',  label: 'Asistencia', Icono: IconoCalendario },
  { href: '/qr',           label: 'QR',         Icono: IconoCarnet },
  { href: '/material',     label: 'Material',   Icono: IconoDocumento },
  { href: '/perfil-admin', label: 'Perfil',     Icono: IconoPerfil },
]

// Cohortes y Reportes se retiran del menú (código intacto, se retoman en la
// fase siguiente — mismo criterio que Exámenes/Notas/Progreso en Fase 0
// estudiante).
//
// "Personal" (dar de alta profesores/admins) ya NO es de admin normal — pasó
// a ser trabajo de Dirección Académica y super_admin (división de trabajo
// acordada: admin es todo lo de ESTUDIANTES, Dirección Académica es todo lo
// de PROFESORES/notas/evaluaciones).
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
  { ...NAV[3], grupo: 'Clase de hoy' },
  { ...NAV[1], grupo: 'Clase de hoy' },
  { ...NAV[2], grupo: 'Clase de hoy' },
  { ...NAV[4], grupo: 'Cuenta' },
]

// Dirección Académica: profesores, notas de cualquier cohorte, exámenes —
// pero no Configuración (exclusivo de super_admin).
const TODAS_DIRECCION: ItemBarra[] = [
  ...TODAS.slice(0, 6),
  { href: '/personal',             label: 'Personal',     Icono: IconoPersonal, grupo: 'Dirección académica' },
  { href: '/notas-academicas',     label: 'Notas',        Icono: IconoNotas,    grupo: 'Dirección académica' },
  { href: '/examenes-academicos',  label: 'Exámenes',     Icono: IconoExamen,   grupo: 'Dirección académica' },
  // Resúmenes de "Mi módulo" (estático, a pedido explícito) — is_academico()
  // ya deja escribir 'modules' a dirección académica y super_admin por igual.
  { href: '/modulos',              label: 'Módulos',      Icono: IconoProgreso, grupo: 'Dirección académica' },
  TODAS[6],
]

const TODAS_SUPER: ItemBarra[] = [
  ...TODAS.slice(0, 6),
  { href: '/personal',             label: 'Personal',      Icono: IconoPersonal, grupo: 'Dirección académica' },
  { href: '/notas-academicas',     label: 'Notas',         Icono: IconoNotas,    grupo: 'Dirección académica' },
  { href: '/examenes-academicos',  label: 'Exámenes',      Icono: IconoExamen,   grupo: 'Dirección académica' },
  { href: '/modulos',              label: 'Módulos',       Icono: IconoProgreso, grupo: 'Dirección académica' },
  // R-20/R-21: crear programas y sedes es exclusivo de super_admin
  // (migración 066) — el enlace solo aparece en este menú.
  { href: '/catalogo',             label: 'Catálogo',      Icono: IconoDocumento, grupo: 'Solo super admin' },
  { href: '/configuracion',        label: 'Configuración', Icono: IconoPanel,     grupo: 'Solo super admin' },
  TODAS[6],
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

  return (
    <Marco
      items={NAV}
      todasLasSecciones={
        rol === 'super_admin' ? TODAS_SUPER : esDireccionAcademica(rol) ? TODAS_DIRECCION : TODAS
      }
      imprimible
    >
      {children}
    </Marco>
  )
}
