'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { esAdmin, esDireccionAcademica } from '@/lib/auth-helpers'
import { BarraFlotante, type ItemBarra } from '@/components/ui/BarraFlotante'
import { Campanita } from '@/components/ui/Campanita'
import {
  IconoPanel, IconoEstudiantes, IconoCandado, IconoPerfil, IconoNotas, IconoPersonal, IconoCheck, IconoExamen,
} from '@/components/ui/Iconos'
import type { UserRole } from '@/lib/types'

// Cuatro botones, igual que en los otros dos roles: spec/04 §0 pide que toda
// acción principal quede a un toque del pulgar.
// Fase 0 (docs/15_FASE0_PLAN_ADMIN.md, Sprint A): Consentimientos sale de la
// barra fija — solo se llega por acceso directo o por el menú ☰. Estudiantes
// pasa a la 2ª posición.
const NAV: ItemBarra[] = [
  { href: '/panel',            label: 'Panel',       Icono: IconoPanel },
  { href: '/estudiantes',      label: 'Estudiantes', Icono: IconoEstudiantes },
  { href: '/perfil-admin',     label: 'Perfil',       Icono: IconoPerfil },
]

// Cohortes y Reportes se retiran del menú (código intacto, se retoman en la
// fase siguiente — mismo criterio que Exámenes/Notas/Progreso en Fase 0
// estudiante). Consentimientos vive solo aquí, en el menú ☰.
//
// "Personal" (dar de alta profesores/admins) ya NO es de admin normal — pasó
// a ser trabajo de Dirección Académica y super_admin (división de trabajo
// acordada: admin es todo lo de ESTUDIANTES, Dirección Académica es todo lo
// de PROFESORES/notas/evaluaciones).
const TODAS: ItemBarra[] = [
  NAV[0],
  NAV[1],
  { href: '/consentimientos', label: 'Consentimientos', Icono: IconoCandado },
  NAV[2],
]

// Dirección Académica: profesores, notas de cualquier cohorte, exámenes —
// pero no Configuración (exclusivo de super_admin).
const TODAS_DIRECCION: ItemBarra[] = [
  ...TODAS.slice(0, 3),
  { href: '/personal',             label: 'Personal',     Icono: IconoPersonal },
  { href: '/solicitudes-profesor', label: 'Solicitudes',  Icono: IconoCheck },
  { href: '/notas-academicas',     label: 'Notas',        Icono: IconoNotas },
  { href: '/examenes-academicos',  label: 'Exámenes',     Icono: IconoExamen },
  TODAS[3],
]

const TODAS_SUPER: ItemBarra[] = [
  ...TODAS.slice(0, 3),
  { href: '/personal',             label: 'Personal',      Icono: IconoPersonal },
  { href: '/solicitudes-profesor', label: 'Solicitudes',   Icono: IconoCheck },
  { href: '/notas-academicas',     label: 'Notas',         Icono: IconoNotas },
  { href: '/examenes-academicos',  label: 'Exámenes',      Icono: IconoExamen },
  { href: '/configuracion',        label: 'Configuración', Icono: IconoPanel },
  TODAS[3],
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
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-zr-bg">
      <div className="fixed right-3 top-3 z-40 rounded-full border border-white/15 bg-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <Campanita />
      </div>
      <div className="pb-28">{children}</div>
      <BarraFlotante
        items={NAV}
        todasLasSecciones={
          rol === 'super_admin' ? TODAS_SUPER : esDireccionAcademica(rol) ? TODAS_DIRECCION : TODAS
        }
      />
    </div>
  )
}
